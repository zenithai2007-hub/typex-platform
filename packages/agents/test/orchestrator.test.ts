/* Orchestrator pipeline tests — real core classes, no mocks of the core.
   Only the platform adapter is a test double (a platform is external). */
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentOrchestrator } from '@typex/agents';
import { LocalProvider } from '@typex/ai';
import { PlatformRegistry, PlatformAdapterBase } from '@typex/platforms';
import { PolicyEngine } from '@typex/permissions';
import { ScopedMemory } from '@typex/memory';
import { ExecutionEngine } from '@typex/execution';
import { MemoryStore } from '@typex/db';
import { Capability, Permission } from '@typex/types';
import type { ExecutionResult, Platform } from '@typex/types';

class TestAdapter extends PlatformAdapterBase {
  readonly platformId = 'test-platform';
  sendCalls: { to: string; text: string }[] = [];

  getCapabilities(): Capability[] {
    return [Capability.SEND_MESSAGE, Capability.READ_MESSAGES, Capability.GENERATE_REPLY];
  }
  async getCurrentContext(): Promise<ExecutionResult> {
    return { ok: true, data: { page: 'test' } };
  }
  async send(input: { to: string; text: string }): Promise<ExecutionResult> {
    this.sendCalls.push(input);
    return { ok: true, data: { messageId: 'm1', to: input.to } };
  }
}

const testPlatform: Platform = {
  id: 'test-platform',
  name: 'Test',
  icon: 'test',
  brandColor: '#000',
  connectionType: 'none',
  capabilities: [Capability.SEND_MESSAGE],
  authMethod: 'none',
  supportedActions: ['send'],
  contextExtraction: 'none',
  executionMethod: 'test',
  permissionRequirements: [],
  rateLimits: 'none',
  approvalRequired: true,
  adapterVersion: '0.0.0',
  status: 'active',
};

function buildHarness(adapter?: TestAdapter) {
  const store = new MemoryStore();
  const registry = new PlatformRegistry();
  const testAdapter = adapter ?? new TestAdapter();
  registry.register(testPlatform, testAdapter);
  const orch = new AgentOrchestrator({
    store,
    ai: new LocalProvider(),
    registry,
    permissions: new PolicyEngine(),
    memory: new ScopedMemory(),
    execution: new ExecutionEngine(),
  });
  return { store, orch, adapter: testAdapter };
}

describe('orchestrator pipeline: event → approval → approve → executed', () => {
  it('creates a PENDING approval, parks the agent, then executes on approve', async () => {
    const { store, orch, adapter } = buildHarness();
    const agent = await orch.createAgent({
      userId: 'u1',
      platformId: 'test-platform',
      name: 'Sales',
      instructions: 'You are a sales assistant.',
      permissions: [Permission.READ_CONTEXT, Permission.GENERATE_CONTENT, Permission.SEND_MESSAGE],
    });

    const res = await orch.handleEvent({
      type: 'message',
      agentId: agent.id,
      payload: { text: 'reply to the customer about pricing', to: '923001234567' },
    });

    expect(res.ok).toBe(true);
    expect(res.approvalRequired).toBe(true);
    expect(res.approvalId).toBeTruthy();

    const parked = await orch.getAgent(agent.id);
    expect(parked?.status).toBe('WAITING_APPROVAL');
    const approval = await store.getApproval(res.approvalId as string);
    expect(approval?.status).toBe('PENDING');
    expect(approval?.preview.length).toBeGreaterThan(0);
    // Nothing sent before approval.
    expect(adapter.sendCalls.length).toBe(0);

    const done = await orch.approveAction(res.approvalId as string, 'approved');
    expect(done.ok).toBe(true);
    expect(adapter.sendCalls.length).toBe(1);
    expect(adapter.sendCalls[0].to).toBe('923001234567');

    const approved = await store.getApproval(res.approvalId as string);
    expect(approved?.status).toBe('APPROVED');
    const resumed = await orch.getAgent(agent.id);
    expect(resumed?.status).toBe('READY');

    const audits = await store.listAudit({ agentId: agent.id });
    const outcomes = audits.map((a) => a.outcome);
    expect(outcomes).toContain('PREPARED'); // plan.prepared + approval.requested
    expect(outcomes).toContain('APPROVED'); // approval.decided
    expect(outcomes).toContain('EXECUTED'); // action.executed
    const executed = audits.find((a) => a.action === 'action.executed');
    expect(executed?.outcome).toBe('EXECUTED');
  });

  it('rejecting an approval cancels it without executing', async () => {
    const { store, orch, adapter } = buildHarness();
    const agent = await orch.createAgent({
      userId: 'u1',
      platformId: 'test-platform',
      name: 'Sales',
      instructions: 'x',
      permissions: [Permission.SEND_MESSAGE],
    });
    const res = await orch.handleEvent({
      type: 'message',
      agentId: agent.id,
      payload: { text: 'reply to the customer about pricing', to: '923001234567' },
    });
    const done = await orch.approveAction(res.approvalId as string, 'rejected');
    expect(done.ok).toBe(true);
    expect(done.code).toBe('approval_rejected');
    expect(adapter.sendCalls.length).toBe(0);
    const approval = await store.getApproval(res.approvalId as string);
    expect(approval?.status).toBe('REJECTED');
    const audits = await store.listAudit({ agentId: agent.id });
    expect(audits.some((a) => a.outcome === 'CANCELLED')).toBe(true);
  });
});

describe('permission denial blocks execution', () => {
  it('SEND_MESSAGE without a grant → denied, nothing executed, DENIED audit', async () => {
    const { store, orch, adapter } = buildHarness();
    const agent = await orch.createAgent({
      userId: 'u1',
      platformId: 'test-platform',
      name: 'Locked',
      instructions: 'x',
      // default permissions only: READ_CONTEXT + GENERATE_CONTENT
    });
    const res = await orch.handleEvent({
      type: 'message',
      agentId: agent.id,
      payload: { text: 'reply to the customer about pricing', to: '923001234567' },
    });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('permission_denied');
    expect(res.message).toContain('explicit grant');
    expect(adapter.sendCalls.length).toBe(0);
    const audits = await store.listAudit({ agentId: agent.id });
    const denied = audits.find((a) => a.outcome === 'DENIED');
    expect(denied).toBeTruthy();
    expect(denied?.action).toBe('permission.check');
    expect(denied?.detail?.permission).toBe('SEND_MESSAGE');
  });
});

describe('task lifecycle', () => {
  it('enforces legal transitions and rejects illegal ones', async () => {
    const { orch } = buildHarness();
    const agent = await orch.createAgent({
      userId: 'u1',
      platformId: 'test-platform',
      name: 'T',
      instructions: 'x',
    });
    const task = await orch.createTask(agent.id, 'Do the thing', 'do it');
    expect(task.status).toBe('CREATED');
    const running = await orch.updateTask(task.id, { status: 'RUNNING' });
    expect(running.status).toBe('RUNNING');
    await expect(orch.updateTask(task.id, { status: 'CREATED' })).rejects.toThrow(/Illegal task transition/);
  });

  it('generate_text events run without approval and complete the task', async () => {
    const { store, orch } = buildHarness();
    const agent = await orch.createAgent({
      userId: 'u1',
      platformId: 'test-platform',
      name: 'Writer',
      instructions: 'x',
      permissions: [Permission.GENERATE_TEXT],
    });
    const task = await orch.createTask(agent.id, 'Summarize', 'summarize the notes');
    const res = await orch.handleEvent({
      type: 'instruction',
      agentId: agent.id,
      payload: { text: 'summarize the meeting notes', taskId: task.id },
    });
    expect(res.ok).toBe(true);
    expect(res.approvalRequired).toBeFalsy();
    const done = await store.getTask(task.id);
    expect(done?.status).toBe('COMPLETED');
  });
});

describe('agent status gate', () => {
  it('paused agents do not process events', async () => {
    const { orch } = buildHarness();
    const agent = await orch.createAgent({ userId: 'u1', platformId: 'test-platform', name: 'P', instructions: 'x' });
    await orch.pauseAgent(agent.id);
    const res = await orch.handleEvent({ type: 'message', agentId: agent.id, payload: { text: 'hello' } });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('agent_not_active');
  });
});
