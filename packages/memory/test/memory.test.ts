import { describe, it, expect } from 'vitest';
import { ScopedMemory } from '@typex/memory';

describe('ScopedMemory isolation', () => {
  it("agent A's memory is invisible to agent B", () => {
    const mem = new ScopedMemory();
    mem.set('AGENT', 'agent-a', 'customer_name', 'Ahmed');
    expect(mem.get('AGENT', 'agent-b', 'customer_name')).toBeUndefined();
    expect(mem.list('AGENT', 'agent-b')).toEqual({});
    expect(mem.get('AGENT', 'agent-a', 'customer_name')).toBe('Ahmed');
  });

  it('scopes never auto-merge', () => {
    const mem = new ScopedMemory();
    mem.set('AGENT', 'a1', 'k', 'agent-value');
    mem.set('GLOBAL', 'g', 'k', 'global-value');
    expect(mem.list('AGENT', 'a1')).toEqual({ k: 'agent-value' });
    expect(mem.list('GLOBAL', 'g')).toEqual({ k: 'global-value' });
  });

  it('delete removes only the targeted key', () => {
    const mem = new ScopedMemory();
    mem.set('AGENT', 'a1', 'k1', 'v1');
    mem.set('AGENT', 'a1', 'k2', 'v2');
    expect(mem.delete('AGENT', 'a1', 'k1')).toBe(true);
    expect(mem.get('AGENT', 'a1', 'k1')).toBeUndefined();
    expect(mem.get('AGENT', 'a1', 'k2')).toBe('v2');
  });

  it('disabled scopes read empty and reject writes', () => {
    const mem = new ScopedMemory();
    mem.set('TASK', 't1', 'k', 'v');
    mem.disableScope('TASK');
    expect(mem.isDisabled('TASK')).toBe(true);
    expect(mem.get('TASK', 't1', 'k')).toBeUndefined();
    expect(mem.list('TASK', 't1')).toEqual({});
    expect(() => mem.set('TASK', 't1', 'k2', 'v2')).toThrow(/disabled/);
    mem.enableScope('TASK');
    expect(mem.get('TASK', 't1', 'k')).toBe('v');
  });
});
