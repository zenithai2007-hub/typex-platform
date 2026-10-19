/* ============================================================================
 * @typex/db — storage layer for TYPE X Core.
 *
 * Store: the interface every engine talks to (agents, tasks, approvals,
 * audit events, memory items, connections, conversations/messages).
 *
 * MemoryStore: full Map-based implementation. Used in DEMO MODE and tests.
 * PrismaStore: same interface over PrismaClient (Postgres/Neon).
 *   - Constructed ONLY when DATABASE_URL is set.
 *   - PrismaClient is instantiated LAZILY (never at import time), so builds
 *     and serverless cold starts never crash without a database.
 *
 * getStore(): singleton — PrismaStore when DATABASE_URL is set, otherwise
 * MemoryStore with a console warning ("TYPE X DEMO MODE").
 * ========================================================================== */

import { randomUUID } from 'crypto';
import type {
  ActionPlan,
  Agent,
  AgentTask,
  Approval,
  AuditEvent,
  AuditOutcome,
  Connection,
  Conversation,
  MemoryItem,
  MemoryScope,
  Message,
  Permission,
  TaskStatus,
} from '@typex/types';

export interface Store {
  // agents
  createAgent(a: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'lastActiveAt'>): Promise<Agent>;
  getAgent(id: string): Promise<Agent | null>;
  listAgents(userId?: string): Promise<Agent[]>;
  updateAgent(id: string, patch: Partial<Agent>): Promise<Agent>;
  // tasks
  createTask(t: Omit<AgentTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentTask>;
  getTask(id: string): Promise<AgentTask | null>;
  listTasks(agentId: string): Promise<AgentTask[]>;
  updateTask(id: string, patch: Partial<AgentTask>): Promise<AgentTask>;
  // approvals
  createApproval(a: Omit<Approval, 'id' | 'createdAt'>): Promise<Approval>;
  getApproval(id: string): Promise<Approval | null>;
  listApprovals(agentId?: string): Promise<Approval[]>;
  updateApproval(id: string, patch: Partial<Approval>): Promise<Approval>;
  // audit
  logAudit(e: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent>;
  listAudit(filter?: { agentId?: string; taskId?: string }): Promise<AuditEvent[]>;
  // memory items (durable view of scoped memory)
  createMemoryItem(i: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem>;
  getMemoryItem(scope: MemoryScope, scopeId: string, key: string): Promise<MemoryItem | null>;
  listMemoryItems(scope: MemoryScope, scopeId: string): Promise<MemoryItem[]>;
  deleteMemoryItem(scope: MemoryScope, scopeId: string, key: string): Promise<void>;
  // connections
  createConnection(c: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection>;
  getConnection(id: string): Promise<Connection | null>;
  listConnections(userId?: string): Promise<Connection[]>;
  // conversations / messages
  createConversation(c: Omit<Conversation, 'id' | 'createdAt'>): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  addMessage(m: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  listMessages(conversationId: string): Promise<Message[]>;
}

/* ============================== MemoryStore ============================= */

export class MemoryStore implements Store {
  private agents = new Map<string, Agent>();
  private tasks = new Map<string, AgentTask>();
  private approvals = new Map<string, Approval>();
  private audit: AuditEvent[] = [];
  private memory = new Map<string, MemoryItem>();
  private connections = new Map<string, Connection>();
  private conversations = new Map<string, Conversation>();
  private messages = new Map<string, Message[]>();

  private notFound(kind: string, id: string): Error {
    return new Error(`${kind} not found: ${id}`);
  }

  async createAgent(a: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'lastActiveAt'>): Promise<Agent> {
    const now = new Date();
    const agent: Agent = { ...a, id: randomUUID(), createdAt: now, updatedAt: now, lastActiveAt: now };
    this.agents.set(agent.id, agent);
    return agent;
  }
  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.get(id) ?? null;
  }
  async listAgents(userId?: string): Promise<Agent[]> {
    return [...this.agents.values()].filter((a) => !userId || a.userId === userId);
  }
  async updateAgent(id: string, patch: Partial<Agent>): Promise<Agent> {
    const a = this.agents.get(id);
    if (!a) throw this.notFound('Agent', id);
    const next = { ...a, ...patch, id: a.id, updatedAt: new Date() };
    this.agents.set(id, next);
    return next;
  }

  async createTask(t: Omit<AgentTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentTask> {
    const now = new Date();
    const task: AgentTask = { ...t, id: randomUUID(), createdAt: now, updatedAt: now };
    this.tasks.set(task.id, task);
    return task;
  }
  async getTask(id: string): Promise<AgentTask | null> {
    return this.tasks.get(id) ?? null;
  }
  async listTasks(agentId: string): Promise<AgentTask[]> {
    return [...this.tasks.values()].filter((t) => t.agentId === agentId);
  }
  async updateTask(id: string, patch: Partial<AgentTask>): Promise<AgentTask> {
    const t = this.tasks.get(id);
    if (!t) throw this.notFound('Task', id);
    const next = { ...t, ...patch, id: t.id, updatedAt: new Date() };
    this.tasks.set(id, next);
    return next;
  }

  async createApproval(a: Omit<Approval, 'id' | 'createdAt'>): Promise<Approval> {
    const approval: Approval = { ...a, id: randomUUID(), createdAt: new Date() };
    this.approvals.set(approval.id, approval);
    return approval;
  }
  async getApproval(id: string): Promise<Approval | null> {
    return this.approvals.get(id) ?? null;
  }
  async listApprovals(agentId?: string): Promise<Approval[]> {
    return [...this.approvals.values()].filter((a) => !agentId || a.agentId === agentId);
  }
  async updateApproval(id: string, patch: Partial<Approval>): Promise<Approval> {
    const a = this.approvals.get(id);
    if (!a) throw this.notFound('Approval', id);
    const next = { ...a, ...patch, id: a.id };
    this.approvals.set(id, next);
    return next;
  }

  async logAudit(e: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const ev: AuditEvent = { ...e, id: randomUUID(), createdAt: new Date() };
    this.audit.push(ev);
    return ev;
  }
  async listAudit(filter?: { agentId?: string; taskId?: string }): Promise<AuditEvent[]> {
    return this.audit.filter(
      (e) => (!filter?.agentId || e.agentId === filter.agentId) && (!filter?.taskId || e.taskId === filter.taskId),
    );
  }

  private memKey(scope: MemoryScope, scopeId: string, key: string): string {
    return `${scope}:${scopeId}:${key}`;
  }
  async createMemoryItem(i: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> {
    const now = new Date();
    const item: MemoryItem = { ...i, id: randomUUID(), createdAt: now, updatedAt: now };
    this.memory.set(this.memKey(i.scope, i.scopeId, i.key), item);
    return item;
  }
  async getMemoryItem(scope: MemoryScope, scopeId: string, key: string): Promise<MemoryItem | null> {
    return this.memory.get(this.memKey(scope, scopeId, key)) ?? null;
  }
  async listMemoryItems(scope: MemoryScope, scopeId: string): Promise<MemoryItem[]> {
    const prefix = `${scope}:${scopeId}:`;
    return [...this.memory.entries()].filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);
  }
  async deleteMemoryItem(scope: MemoryScope, scopeId: string, key: string): Promise<void> {
    this.memory.delete(this.memKey(scope, scopeId, key));
  }

  async createConnection(c: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection> {
    const now = new Date();
    const conn: Connection = { ...c, id: randomUUID(), createdAt: now, updatedAt: now };
    this.connections.set(conn.id, conn);
    return conn;
  }
  async getConnection(id: string): Promise<Connection | null> {
    return this.connections.get(id) ?? null;
  }
  async listConnections(userId?: string): Promise<Connection[]> {
    return [...this.connections.values()].filter((c) => !userId || c.userId === userId);
  }

  async createConversation(c: Omit<Conversation, 'id' | 'createdAt'>): Promise<Conversation> {
    const conv: Conversation = { ...c, id: randomUUID(), createdAt: new Date() };
    this.conversations.set(conv.id, conv);
    this.messages.set(conv.id, []);
    return conv;
  }
  async getConversation(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }
  async addMessage(m: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const msg: Message = { ...m, id: randomUUID(), createdAt: new Date() };
    const list = this.messages.get(m.conversationId) ?? [];
    list.push(msg);
    this.messages.set(m.conversationId, list);
    return msg;
  }
  async listMessages(conversationId: string): Promise<Message[]> {
    return this.messages.get(conversationId) ?? [];
  }
}

/* ============================== PrismaStore ============================= */

// PrismaClient is imported lazily (never at module load) so importing this
// module without DATABASE_URL / without a generated client never crashes.
type PrismaClientLike = {
  agent: any; agentTask: any; approval: any; auditLog: any;
  agentMemory: any; memoryItem: any; platformConnection: any;
  conversation: any; message: any; permissionGrant: any;
};

export class PrismaStore implements Store {
  private client: PrismaClientLike | null = null;

  private async db(): Promise<PrismaClientLike> {
    if (!process.env.DATABASE_URL) {
      throw new Error('PrismaStore requires DATABASE_URL.');
    }
    if (!this.client) {
      const mod = (await import('@prisma/client')) as unknown as {
        PrismaClient?: new () => unknown;
        default?: { PrismaClient?: new () => unknown };
      };
      const Ctor = mod.PrismaClient ?? mod.default?.PrismaClient;
      if (!Ctor) {
        throw new Error('@prisma/client is not generated — run `npm run db:generate` first.');
      }
      this.client = new Ctor() as unknown as PrismaClientLike;
    }
    return this.client;
  }

  private toAgent(row: any, permissions: Permission[]): Agent {
    return {
      id: row.id, userId: row.userId, platformId: row.platformId,
      connectionId: row.connectionId ?? null, name: row.name,
      avatar: row.avatar ?? undefined, status: row.status,
      instructions: row.instructions, memoryScope: row.memoryScope,
      currentTask: row.currentTaskId ?? null, permissions,
      createdAt: row.createdAt, updatedAt: row.updatedAt, lastActiveAt: row.lastActiveAt,
    };
  }

  private async agentPermissions(db: PrismaClientLike, agentId: string): Promise<Permission[]> {
    const grants = await db.permissionGrant.findMany({ where: { agentId, granted: true } });
    return grants.map((g: any) => g.permission as Permission);
  }

  async createAgent(a: Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'lastActiveAt'>): Promise<Agent> {
    const db = await this.db();
    const row = await db.agent.create({
      data: {
        userId: a.userId, platformId: a.platformId, connectionId: a.connectionId,
        name: a.name, avatar: a.avatar, status: a.status,
        instructions: a.instructions, memoryScope: a.memoryScope,
        currentTaskId: a.currentTask ?? null,
        permissionGrants: { create: a.permissions.map((p) => ({ permission: p, granted: true })) },
      },
    });
    return this.toAgent(row, [...a.permissions]);
  }
  async getAgent(id: string): Promise<Agent | null> {
    const db = await this.db();
    const row = await db.agent.findUnique({ where: { id } });
    if (!row) return null;
    return this.toAgent(row, await this.agentPermissions(db, id));
  }
  async listAgents(userId?: string): Promise<Agent[]> {
    const db = await this.db();
    const rows = await db.agent.findMany({ where: userId ? { userId } : undefined });
    return Promise.all(rows.map(async (r: any) => this.toAgent(r, await this.agentPermissions(db, r.id))));
  }
  async updateAgent(id: string, patch: Partial<Agent>): Promise<Agent> {
    const db = await this.db();
    const data: any = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.avatar !== undefined) data.avatar = patch.avatar;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.instructions !== undefined) data.instructions = patch.instructions;
    if (patch.memoryScope !== undefined) data.memoryScope = patch.memoryScope;
    if (patch.currentTask !== undefined) data.currentTaskId = patch.currentTask;
    if (patch.connectionId !== undefined) data.connectionId = patch.connectionId;
    if (patch.lastActiveAt !== undefined) data.lastActiveAt = patch.lastActiveAt;
    const row = await db.agent.update({ where: { id }, data });
    if (patch.permissions) {
      await db.permissionGrant.deleteMany({ where: { agentId: id } });
      await db.permissionGrant.createMany({ data: patch.permissions.map((p) => ({ agentId: id, permission: p, granted: true })) });
    }
    return this.toAgent(row, await this.agentPermissions(db, id));
  }

  async createTask(t: Omit<AgentTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentTask> {
    const db = await this.db();
    const row = await db.agentTask.create({
      data: {
        agentId: t.agentId, objective: t.objective, instructions: t.instructions,
        trigger: t.trigger, status: t.status, scheduleSpec: t.schedule,
        permissions: t.permissions,
      },
    });
    return this.toTask(row);
  }
  private toTask(row: any): AgentTask {
    return {
      id: row.id, agentId: row.agentId, objective: row.objective,
      instructions: row.instructions, trigger: row.trigger ?? undefined,
      status: row.status as TaskStatus, schedule: row.scheduleSpec ?? undefined,
      permissions: (row.permissions as Permission[]) ?? [],
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }
  async getTask(id: string): Promise<AgentTask | null> {
    const db = await this.db();
    const row = await db.agentTask.findUnique({ where: { id } });
    return row ? this.toTask(row) : null;
  }
  async listTasks(agentId: string): Promise<AgentTask[]> {
    const db = await this.db();
    const rows = await db.agentTask.findMany({ where: { agentId } });
    return rows.map((r: any) => this.toTask(r));
  }
  async updateTask(id: string, patch: Partial<AgentTask>): Promise<AgentTask> {
    const db = await this.db();
    const data: any = {};
    if (patch.objective !== undefined) data.objective = patch.objective;
    if (patch.instructions !== undefined) data.instructions = patch.instructions;
    if (patch.trigger !== undefined) data.trigger = patch.trigger;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.schedule !== undefined) data.scheduleSpec = patch.schedule;
    if (patch.permissions !== undefined) data.permissions = patch.permissions;
    const row = await db.agentTask.update({ where: { id }, data });
    return this.toTask(row);
  }

  async createApproval(a: Omit<Approval, 'id' | 'createdAt'>): Promise<Approval> {
    const db = await this.db();
    const row = await db.approval.create({
      data: { agentId: a.agentId, action: a.action, preview: a.preview, payload: (a.payload ?? null) as any, status: a.status },
    });
    return this.toApproval(row);
  }
  private toApproval(row: any): Approval {
    return {
      id: row.id, agentId: row.agentId, action: row.action, preview: row.preview,
      payload: (row.payload as Record<string, unknown>) ?? undefined,
      status: row.status, createdAt: row.createdAt, decidedAt: row.decidedAt ?? undefined,
    };
  }
  async getApproval(id: string): Promise<Approval | null> {
    const db = await this.db();
    const row = await db.approval.findUnique({ where: { id } });
    return row ? this.toApproval(row) : null;
  }
  async listApprovals(agentId?: string): Promise<Approval[]> {
    const db = await this.db();
    const rows = await db.approval.findMany({ where: agentId ? { agentId } : undefined });
    return rows.map((r: any) => this.toApproval(r));
  }
  async updateApproval(id: string, patch: Partial<Approval>): Promise<Approval> {
    const db = await this.db();
    const data: any = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.decidedAt !== undefined) data.decidedAt = patch.decidedAt;
    if (patch.preview !== undefined) data.preview = patch.preview;
    const row = await db.approval.update({ where: { id }, data });
    return this.toApproval(row);
  }

  async logAudit(e: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const db = await this.db();
    const row = await db.auditLog.create({
      data: {
        agentId: e.agentId, taskId: e.taskId ?? null, action: e.action,
        outcome: e.outcome as string, detail: (e.detail ?? null) as any,
      },
    });
    return {
      id: row.id, agentId: row.agentId ?? e.agentId, taskId: row.taskId ?? undefined,
      action: row.action, outcome: row.outcome as AuditOutcome,
      detail: (row.detail as Record<string, unknown>) ?? undefined, createdAt: row.createdAt,
    };
  }
  async listAudit(filter?: { agentId?: string; taskId?: string }): Promise<AuditEvent[]> {
    const db = await this.db();
    const rows = await db.auditLog.findMany({
      where: {
        ...(filter?.agentId ? { agentId: filter.agentId } : {}),
        ...(filter?.taskId ? { taskId: filter.taskId } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r: any) => ({
      id: r.id, agentId: r.agentId ?? '', taskId: r.taskId ?? undefined,
      action: r.action, outcome: r.outcome as AuditOutcome,
      detail: (r.detail as Record<string, unknown>) ?? undefined, createdAt: r.createdAt,
    }));
  }

  private async ensureMemory(db: PrismaClientLike, scope: MemoryScope, scopeId: string, agentId: string): Promise<string> {
    const existing = await db.agentMemory.findUnique({ where: { agentId_scope_scopeId: { agentId, scope, scopeId } } });
    if (existing) return existing.id;
    const created = await db.agentMemory.create({ data: { agentId, scope, scopeId } });
    return created.id;
  }

  async createMemoryItem(i: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryItem> {
    const db = await this.db();
    // NOTE: durable memory items are namespaced under the AGENT scope row when
    // scopeId refers to an agent; global items need an owner agent — callers
    // pass scopeId accordingly. We use the first agent as owner for GLOBAL.
    const ownerAgentId = i.scope === 'AGENT' ? i.scopeId : await this.firstAgentId(db);
    const memoryId = await this.ensureMemory(db, i.scope, i.scopeId, ownerAgentId);
    const row = await db.memoryItem.upsert({
      where: { memoryId_key: { memoryId, key: i.key } },
      update: { value: i.value },
      create: { memoryId, key: i.key, value: i.value },
    });
    return { id: row.id, scope: i.scope, scopeId: i.scopeId, key: row.key, value: row.value, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }
  private async firstAgentId(db: PrismaClientLike): Promise<string> {
    const a = await db.agent.findFirst({ select: { id: true } });
    if (!a) throw new Error('No agent exists to own GLOBAL memory.');
    return a.id;
  }
  private async findMemoryId(db: PrismaClientLike, scope: MemoryScope, scopeId: string): Promise<string | null> {
    const ownerAgentId = scope === 'AGENT' ? scopeId : await this.firstAgentId(db);
    const m = await db.agentMemory.findUnique({ where: { agentId_scope_scopeId: { agentId: ownerAgentId, scope, scopeId } } });
    return m ? m.id : null;
  }
  async getMemoryItem(scope: MemoryScope, scopeId: string, key: string): Promise<MemoryItem | null> {
    const db = await this.db();
    const memoryId = await this.findMemoryId(db, scope, scopeId);
    if (!memoryId) return null;
    const row = await db.memoryItem.findUnique({ where: { memoryId_key: { memoryId, key } } });
    return row ? { id: row.id, scope, scopeId, key: row.key, value: row.value, createdAt: row.createdAt, updatedAt: row.updatedAt } : null;
  }
  async listMemoryItems(scope: MemoryScope, scopeId: string): Promise<MemoryItem[]> {
    const db = await this.db();
    const memoryId = await this.findMemoryId(db, scope, scopeId);
    if (!memoryId) return [];
    const rows = await db.memoryItem.findMany({ where: { memoryId } });
    return rows.map((r: any) => ({ id: r.id, scope, scopeId, key: r.key, value: r.value, createdAt: r.createdAt, updatedAt: r.updatedAt }));
  }
  async deleteMemoryItem(scope: MemoryScope, scopeId: string, key: string): Promise<void> {
    const db = await this.db();
    const memoryId = await this.findMemoryId(db, scope, scopeId);
    if (!memoryId) return;
    await db.memoryItem.deleteMany({ where: { memoryId, key } });
  }

  async createConnection(c: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>): Promise<Connection> {
    const db = await this.db();
    const row = await db.platformConnection.create({
      data: { userId: c.userId, platformId: c.platformId, status: c.status, credentialsRef: c.credentialsRef },
    });
    return this.toConnection(row);
  }
  private toConnection(row: any): Connection {
    return {
      id: row.id, userId: row.userId, platformId: row.platformId, status: row.status,
      credentialsRef: row.credentialsRef ?? undefined, createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }
  async getConnection(id: string): Promise<Connection | null> {
    const db = await this.db();
    const row = await db.platformConnection.findUnique({ where: { id } });
    return row ? this.toConnection(row) : null;
  }
  async listConnections(userId?: string): Promise<Connection[]> {
    const db = await this.db();
    const rows = await db.platformConnection.findMany({ where: userId ? { userId } : undefined });
    return rows.map((r: any) => this.toConnection(r));
  }

  async createConversation(c: Omit<Conversation, 'id' | 'createdAt'>): Promise<Conversation> {
    const db = await this.db();
    const row = await db.conversation.create({
      data: { agentId: c.agentId ?? null, connectionId: c.connectionId, platformId: c.platformId, externalId: c.externalId },
    });
    return { id: row.id, agentId: row.agentId ?? undefined, connectionId: row.connectionId, platformId: row.platformId, externalId: row.externalId ?? undefined, createdAt: row.createdAt };
  }
  async getConversation(id: string): Promise<Conversation | null> {
    const db = await this.db();
    const row = await db.conversation.findUnique({ where: { id } });
    return row
      ? { id: row.id, agentId: row.agentId ?? undefined, connectionId: row.connectionId, platformId: row.platformId, externalId: row.externalId ?? undefined, createdAt: row.createdAt }
      : null;
  }
  async addMessage(m: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const db = await this.db();
    const row = await db.message.create({
      data: { conversationId: m.conversationId, dir: m.dir, text: m.text, externalId: m.externalId },
    });
    return { id: row.id, conversationId: row.conversationId, dir: row.dir as 'in' | 'out', text: row.text, externalId: row.externalId ?? undefined, createdAt: row.createdAt };
  }
  async listMessages(conversationId: string): Promise<Message[]> {
    const db = await this.db();
    const rows = await db.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
    return rows.map((r: any) => ({ id: r.id, conversationId: r.conversationId, dir: r.dir as 'in' | 'out', text: r.text, externalId: r.externalId ?? undefined, createdAt: r.createdAt }));
  }
}

/* ============================== getStore ============================== */

let singleton: Store | null = null;

/** PrismaStore when DATABASE_URL is set, otherwise MemoryStore (DEMO MODE). */
export function getStore(): Store {
  if (singleton) return singleton;
  if (process.env.DATABASE_URL) {
    singleton = new PrismaStore();
  } else {
    // eslint-disable-next-line no-console
    console.warn('TYPE X DEMO MODE — no DATABASE_URL; using local in-memory store. Data will not persist.');
    singleton = new MemoryStore();
  }
  return singleton;
}

/** Reset the singleton (tests). */
export function __resetStore(): void {
  singleton = null;
}

// Re-export so consumers only need @typex/db for plan payloads.
export type { ActionPlan };
