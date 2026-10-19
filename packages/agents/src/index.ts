/* ============================================================================
 * @typex/agents — the Agent Engine. AgentOrchestrator runs the real
 * EVENT → CONTEXT → MEMORY → PLAN → PERMISSIONS → APPROVAL → EXECUTE → AUDIT
 * pipeline. Every stage writes an AuditEvent. Nothing is faked: a send only
 * reports success when the adapter confirms it.
 * ========================================================================== */

import { randomUUID } from 'crypto';
import type {
  ActionPlan,
  Agent,
  AgentStatus,
  AgentTask,
  Approval,
  AuditOutcome,
  ExecutionResult,
  Permission,
  PlatformAdapter,
  TaskStatus,
} from '@typex/types';
import { Permission as Perm } from '@typex/types';
import type { AIProvider, ActionDraft } from '@typex/ai';
import type { PlatformRegistry } from '@typex/platforms';
import type { PolicyEngine } from '@typex/permissions';
import type { ScopedMemory } from '@typex/memory';
import type { ExecutionEngine } from '@typex/execution';
import type { Store } from '@typex/db';
import { DEFAULT_AGENT_PERMISSIONS } from '@typex/permissions';

export interface OrchestratorDeps {
  store: Store;
  ai: AIProvider;
  registry: PlatformRegistry;
  permissions: PolicyEngine;
  memory: ScopedMemory;
  execution: ExecutionEngine;
}

export interface AgentEvent {
  type: string;
  agentId: string;
  payload: Record<string, unknown>;
}

export interface EventResult {
  ok: boolean;
  code?: string;
  message?: string;
  approvalRequired?: boolean;
  approvalId?: string;
  data?: unknown;
}

export interface CreateAgentInput {
  userId: string;
  platformId: string;
  connectionId?: string;
  name: string;
  avatar?: string;
  instructions: string;
  permissions?: Permission[];
}

const ACTIVE_STATES: AgentStatus[] = ['READY', 'ACTIVE'];

/** Enforced task lifecycle transitions. */
const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['WAITING', 'WAITING_APPROVAL', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  WAITING: ['RUNNING', 'CANCELLED'],
  WAITING_APPROVAL: ['RUNNING', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['RUNNING'],
  CANCELLED: [],
};

export class AgentOrchestrator {
  constructor(private deps: OrchestratorDeps) {}

  private async audit(
    agentId: string,
    action: string,
    outcome: AuditOutcome,
    taskId?: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.store.logAudit({ agentId, taskId, action, outcome, detail });
  }

  /* ------------------------------ agents ------------------------------ */

  async createAgent(input: CreateAgentInput): Promise<Agent> {
    const perms = input.permissions ?? [...DEFAULT_AGENT_PERMISSIONS];
    const agent = await this.deps.store.createAgent({
      userId: input.userId,
      platformId: input.platformId,
      connectionId: input.connectionId ?? null,
      name: input.name,
      avatar: input.avatar,
      status: 'READY',
      instructions: input.instructions,
      memoryScope: 'AGENT',
      currentTask: null,
      permissions: perms,
    });
    this.deps.permissions.setPermissions(agent.id, perms);
    await this.audit(agent.id, 'agent.created', 'EXECUTED', undefined, { platformId: input.platformId });
    return agent;
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.deps.store.getAgent(id);
  }

  async listAgents(userId?: string): Promise<Agent[]> {
    return this.deps.store.listAgents(userId);
  }

  async updateAgent(id: string, patch: Partial<Agent>): Promise<Agent> {
    const agent = await this.deps.store.updateAgent(id, patch);
    if (patch.permissions) this.deps.permissions.setPermissions(id, patch.permissions);
    await this.audit(id, 'agent.updated', 'EXECUTED');
    return agent;
  }

  async pauseAgent(id: string): Promise<Agent> {
    const agent = await this.deps.store.updateAgent(id, { status: 'PAUSED' });
    await this.audit(id, 'agent.paused', 'EXECUTED');
    return agent;
  }

  async resumeAgent(id: string): Promise<Agent> {
    const agent = await this.deps.store.updateAgent(id, { status: 'READY' });
    await this.audit(id, 'agent.resumed', 'EXECUTED');
    return agent;
  }

  async stopAgent(id: string): Promise<Agent> {
    const agent = await this.deps.store.updateAgent(id, { status: 'OFFLINE' });
    await this.audit(id, 'agent.stopped', 'EXECUTED');
    return agent;
  }

  /* ------------------------------- tasks ------------------------------ */

  async createTask(agentId: string, objective: string, instructions: string, opts: { trigger?: string; schedule?: string; permissions?: Permission[] } = {}): Promise<AgentTask> {
    const task = await this.deps.store.createTask({
      agentId,
      objective,
      instructions,
      trigger: opts.trigger,
      status: 'CREATED',
      schedule: opts.schedule,
      permissions: opts.permissions ?? [],
    });
    await this.audit(agentId, 'task.created', 'EXECUTED', task.id, { objective: objective.slice(0, 120) });
    return task;
  }

  async updateTask(id: string, patch: Partial<AgentTask>): Promise<AgentTask> {
    const task = await this.deps.store.getTask(id);
    if (!task) throw new Error(`Task not found: ${id}`);
    if (patch.status && patch.status !== task.status) {
      const allowed = TASK_TRANSITIONS[task.status] || [];
      if (!allowed.includes(patch.status)) {
        throw new Error(`Illegal task transition: ${task.status} → ${patch.status}`);
      }
    }
    const next = await this.deps.store.updateTask(id, patch);
    await this.audit(next.agentId, 'task.updated', 'EXECUTED', id, { status: patch.status });
    return next;
  }

  /* --------------------------- event pipeline -------------------------- */

  async handleEvent(event: AgentEvent): Promise<EventResult> {
    const { store, ai, registry, permissions, memory, execution } = this.deps;

    // 1. Load agent.
    const agent = await store.getAgent(event.agentId);
    if (!agent) {
      return { ok: false, code: 'agent_not_found', message: `Agent not found: ${event.agentId}` };
    }
    await this.audit(agent.id, 'event.received', 'EXECUTED', this.taskIdOf(event), { type: event.type });

    // 2. Status check — only READY/ACTIVE agents process events.
    if (!ACTIVE_STATES.includes(agent.status)) {
      await this.audit(agent.id, 'pipeline.status_check', 'FAILED', this.taskIdOf(event), {
        status: agent.status,
        reason: 'agent is not active',
      });
      return { ok: false, code: 'agent_not_active', message: `Agent is ${agent.status}; resume it first.` };
    }
    await store.updateAgent(agent.id, { status: 'ACTIVE', lastActiveAt: new Date() });

    // 3. Adapter from the registry.
    const adapter: PlatformAdapter | undefined = registry.getAdapter(agent.platformId);
    if (!adapter) {
      await this.audit(agent.id, 'pipeline.adapter', 'FAILED', this.taskIdOf(event), {
        platformId: agent.platformId,
        reason: 'no adapter registered for this platform',
      });
      await store.updateAgent(agent.id, { status: 'READY' });
      return { ok: false, code: 'adapter_missing', message: `No adapter registered for platform "${agent.platformId}".` };
    }

    // 4. Platform context (best-effort — a context failure never blocks planning).
    let context: Record<string, unknown> = {};
    try {
      const cur = await adapter.getCurrentContext();
      if (cur.ok) context.current = cur.data;
      if (event.payload.phone || event.payload.contactId) {
        const read = await adapter.readContext({
          phone: event.payload.phone as string | undefined,
          contactId: event.payload.contactId as string | undefined,
          since: event.payload.since as number | undefined,
        });
        if (read.ok) context.conversation = read.data;
        else context.contextNote = read.message;
      }
    } catch (e) {
      context.contextNote = String((e as Error)?.message ?? e);
    }
    await this.audit(agent.id, 'context.loaded', 'EXECUTED', this.taskIdOf(event), {
      hasConversation: Boolean(context.conversation),
    });

    // 5. Scoped memory — namespaced per agent, never cross-agent.
    const mem: Record<string, unknown> = {
      agent: memory.list('AGENT', agent.id),
    };
    if (event.payload.conversationId) {
      mem.conversation = memory.list('CONVERSATION', String(event.payload.conversationId));
    }

    // 6. Plan via the AI provider.
    const instruction = String(event.payload.text ?? event.payload.instruction ?? event.type);
    const fullInstruction = [agent.instructions, instruction].filter(Boolean).join('\n\nInstruction: ');
    let draft: ActionDraft;
    try {
      draft = await ai.planAction(fullInstruction, { ...context, memory: mem, to: event.payload.to, phone: event.payload.phone, name: event.payload.name });
    } catch (e) {
      await this.audit(agent.id, 'plan.failed', 'FAILED', this.taskIdOf(event), { error: String((e as Error)?.message ?? e) });
      await store.updateAgent(agent.id, { status: 'READY' });
      return { ok: false, code: 'plan_failed', message: 'The AI provider could not plan this action.' };
    }

    // 7. Permission gate — explicit denial, auditable, no execution.
    const check = permissions.checkPermissions(agent.id, draft.permission);
    if (!check.allowed) {
      await this.audit(agent.id, 'permission.check', 'DENIED', this.taskIdOf(event), {
        permission: draft.permission,
        reason: check.reason,
        kind: draft.kind,
      });
      await store.updateAgent(agent.id, { status: 'READY' });
      return { ok: false, code: 'permission_denied', message: check.reason };
    }

    // 8. Build the ActionPlan.
    const plan: ActionPlan = {
      id: randomUUID(),
      agentId: agent.id,
      kind: draft.kind,
      platformId: agent.platformId,
      payload: {
        ...draft.payload,
        ...(event.payload.to ? { to: event.payload.to } : {}),
        ...(event.payload.phone && !draft.payload.to ? { to: event.payload.phone } : {}),
      },
      mode: draft.mode,
      requiresApproval: draft.requiresApproval,
      createdAt: new Date(),
    };
    await this.audit(agent.id, 'plan.prepared', 'PREPARED', this.taskIdOf(event), {
      kind: plan.kind,
      mode: plan.mode,
      requiresApproval: plan.requiresApproval,
      permission: draft.permission,
    });

    // 9. Task lifecycle → RUNNING.
    const taskId = this.taskIdOf(event);
    if (taskId) {
      try {
        await this.updateTask(taskId, { status: 'RUNNING' });
      } catch {
        /* task may already be RUNNING — not fatal */
      }
    }

    // 10. Approval gate.
    if (plan.requiresApproval && !event.payload.preApproved) {
      const approval: Approval = await store.createApproval({
        agentId: agent.id,
        action: plan.kind,
        preview: draft.preview,
        payload: JSON.parse(JSON.stringify(plan)) as Record<string, unknown>,
        status: 'PENDING',
      });
      await store.updateAgent(agent.id, { status: 'WAITING_APPROVAL', currentTask: taskId ?? null });
      if (taskId) {
        try {
          await this.updateTask(taskId, { status: 'WAITING_APPROVAL' });
        } catch {
          /* ignore illegal-transition noise */
        }
      }
      await this.audit(agent.id, 'approval.requested', 'PREPARED', taskId, {
        approvalId: approval.id,
        preview: draft.preview.slice(0, 120),
      });
      return { ok: true, approvalRequired: true, approvalId: approval.id, data: { preview: draft.preview } };
    }

    // 11. Execute.
    return this.runPlan(agent, adapter, plan, taskId);
  }

  private async runPlan(agent: Agent, adapter: PlatformAdapter, plan: ActionPlan, taskId?: string): Promise<EventResult> {
    const { store, execution } = this.deps;
    let result: ExecutionResult;
    try {
      result = await execution.execute(plan, adapter);
    } catch (e) {
      result = { ok: false, code: 'execution_error', message: String((e as Error)?.message ?? e) };
    }
    const outcome: AuditOutcome = result.ok ? 'EXECUTED' : 'FAILED';
    await this.audit(agent.id, result.ok ? 'action.executed' : 'action.failed', outcome, taskId, {
      kind: plan.kind,
      code: result.code,
      message: result.message,
    });
    await store.updateAgent(agent.id, { status: 'READY', lastActiveAt: new Date() });
    if (taskId) {
      try {
        await this.updateTask(taskId, { status: result.ok ? 'COMPLETED' : 'FAILED' });
      } catch {
        /* ignore */
      }
    }
    return { ok: result.ok, code: result.code, message: result.message, data: result.data };
  }

  /* ----------------------------- approvals ----------------------------- */

  async approveAction(approvalId: string, decision: 'approved' | 'rejected' | 'cancelled'): Promise<EventResult> {
    const { store, registry } = this.deps;
    const approval = await store.getApproval(approvalId);
    if (!approval) return { ok: false, code: 'approval_not_found', message: `Approval not found: ${approvalId}` };
    if (approval.status !== 'PENDING') {
      return { ok: false, code: 'approval_not_pending', message: `Approval is already ${approval.status}.` };
    }
    const agent = await store.getAgent(approval.agentId);
    if (!agent) return { ok: false, code: 'agent_not_found', message: `Agent not found: ${approval.agentId}` };

    const decidedAt = new Date();
    if (decision === 'approved') {
      await store.updateApproval(approvalId, { status: 'APPROVED', decidedAt });
      await this.audit(agent.id, 'approval.decided', 'APPROVED', agent.currentTask ?? undefined, { approvalId });
      const adapter = registry.getAdapter(agent.platformId);
      if (!adapter) {
        await store.updateAgent(agent.id, { status: 'READY' });
        return { ok: false, code: 'adapter_missing', message: `No adapter registered for platform "${agent.platformId}".` };
      }
      // Rebuild the plan from the stored approval payload (dates revived).
      const raw = (approval.payload ?? {}) as Record<string, unknown>;
      const plan: ActionPlan = {
        id: String(raw.id ?? randomUUID()),
        agentId: agent.id,
        kind: String(raw.kind ?? approval.action),
        platformId: String(raw.platformId ?? agent.platformId),
        payload: (raw.payload as Record<string, unknown>) ?? {},
        mode: (raw.mode as ActionPlan['mode']) ?? 'api',
        requiresApproval: false,
        createdAt: raw.createdAt ? new Date(String(raw.createdAt)) : new Date(),
      };
      await store.updateAgent(agent.id, { status: 'ACTIVE' });
      const res = await this.runPlan(agent, adapter, plan, agent.currentTask ?? undefined);
      return { ...res, approvalId };
    }

    // rejected / cancelled
    const status = decision === 'rejected' ? 'REJECTED' : 'CANCELLED';
    await store.updateApproval(approvalId, { status, decidedAt });
    await this.audit(agent.id, 'approval.decided', 'CANCELLED', agent.currentTask ?? undefined, { approvalId, decision });
    await store.updateAgent(agent.id, { status: 'READY', currentTask: null });
    if (agent.currentTask) {
      try {
        await this.updateTask(agent.currentTask, { status: 'CANCELLED' });
      } catch {
        /* ignore */
      }
    }
    return { ok: true, code: 'approval_' + decision, message: `Action ${decision}.`, approvalId };
  }

  private taskIdOf(event: AgentEvent): string | undefined {
    const t = event.payload.taskId;
    return typeof t === 'string' ? t : undefined;
  }
}

// Re-export the permission used for default grants so web-app code has one import.
export { Perm as Permission };
