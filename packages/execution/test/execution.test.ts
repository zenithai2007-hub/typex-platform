import { describe, it, expect } from 'vitest';
import { ExecutionEngine } from '@typex/execution';
import { PlatformAdapterBase } from '@typex/platforms';
import type { ActionPlan, ExecutionResult } from '@typex/types';

class OkAdapter extends PlatformAdapterBase {
  readonly platformId = 'ok';
  async send(input: { to: string; text: string }): Promise<ExecutionResult> {
    return { ok: true, data: { sent: input } };
  }
}

function plan(over: Partial<ActionPlan>): ActionPlan {
  return {
    id: 'p1', agentId: 'a1', kind: 'send_message', platformId: 'ok',
    payload: { to: '123', text: 'hi' }, mode: 'api',
    requiresApproval: false, createdAt: new Date(), ...over,
  };
}

describe('ExecutionEngine', () => {
  it("mode 'api' dispatches to the real adapter method", async () => {
    const eng = new ExecutionEngine();
    const res = await eng.execute(plan({}), new OkAdapter());
    expect(res.ok).toBe(true);
    expect((res.data as { sent: unknown }).sent).toEqual({ to: '123', text: 'hi' });
  });

  it("mode 'browser' fails honestly with the Phase-2 message", async () => {
    const eng = new ExecutionEngine();
    const res = await eng.execute(plan({ mode: 'browser' }), new OkAdapter());
    expect(res.ok).toBe(false);
    expect(res.code).toBe('phase2');
    expect(res.message).toContain('Assisted Mode');
  });

  it("mode 'keyboard' fails honestly with the companion message", async () => {
    const eng = new ExecutionEngine();
    const res = await eng.execute(plan({ mode: 'keyboard' }), new OkAdapter());
    expect(res.ok).toBe(false);
    expect(res.code).toBe('phase2_keyboard');
  });

  it('generate_text resolves locally without touching the adapter', async () => {
    const eng = new ExecutionEngine();
    const res = await eng.execute(plan({ kind: 'generate_text', payload: { text: 'draft' } }), new OkAdapter());
    expect(res.ok).toBe(true);
    expect((res.data as { text: string }).text).toBe('draft');
  });
});
