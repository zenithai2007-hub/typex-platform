import { describe, it, expect } from 'vitest';
import { MemoryStore, getStore, __resetStore } from '@typex/db';

describe('MemoryStore', () => {
  it('round-trips agents, tasks, approvals, audit, memory, conversations', async () => {
    const s = new MemoryStore();
    const agent = await s.createAgent({
      userId: 'u1', platformId: 'whatsapp', connectionId: null, name: 'A',
      status: 'READY', instructions: 'x', memoryScope: 'AGENT', currentTask: null, permissions: [],
    });
    expect((await s.getAgent(agent.id))?.name).toBe('A');
    expect(await s.listAgents('u1')).toHaveLength(1);

    const task = await s.createTask({ agentId: agent.id, objective: 'o', instructions: 'i', status: 'CREATED', permissions: [] });
    await s.updateTask(task.id, { status: 'RUNNING' });
    expect((await s.getTask(task.id))?.status).toBe('RUNNING');

    const ap = await s.createApproval({ agentId: agent.id, action: 'send_message', preview: 'p', status: 'PENDING' });
    await s.updateApproval(ap.id, { status: 'APPROVED', decidedAt: new Date() });
    expect((await s.getApproval(ap.id))?.status).toBe('APPROVED');

    await s.logAudit({ agentId: agent.id, taskId: task.id, action: 'plan.prepared', outcome: 'PREPARED' });
    const audits = await s.listAudit({ agentId: agent.id });
    expect(audits).toHaveLength(1);
    expect(audits[0].outcome).toBe('PREPARED');

    await s.createMemoryItem({ scope: 'AGENT', scopeId: agent.id, key: 'k', value: 'v' });
    expect((await s.getMemoryItem('AGENT', agent.id, 'k'))?.value).toBe('v');
    await s.deleteMemoryItem('AGENT', agent.id, 'k');
    expect(await s.getMemoryItem('AGENT', agent.id, 'k')).toBeNull();

    const conn = await s.createConnection({ userId: 'u1', platformId: 'whatsapp', status: 'CONNECTED' });
    const conv = await s.createConversation({ agentId: agent.id, connectionId: conn.id, platformId: 'whatsapp' });
    await s.addMessage({ conversationId: conv.id, dir: 'in', text: 'hello' });
    expect(await s.listMessages(conv.id)).toHaveLength(1);
  });
});

describe('getStore', () => {
  it('returns MemoryStore with a DEMO MODE warning when DATABASE_URL is unset', () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    __resetStore();
    const warned: string[] = [];
    const orig = console.warn;
    console.warn = (m: string) => warned.push(m);
    try {
      const s = getStore();
      expect(s).toBeInstanceOf(MemoryStore);
      expect(warned.some((w) => w.includes('DEMO MODE'))).toBe(true);
      expect(getStore()).toBe(s); // singleton
    } finally {
      console.warn = orig;
      __resetStore();
      if (saved !== undefined) process.env.DATABASE_URL = saved;
    }
  });
});
