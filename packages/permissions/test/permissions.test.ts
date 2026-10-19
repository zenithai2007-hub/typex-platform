import { describe, it, expect } from 'vitest';
import { PolicyEngine } from '@typex/permissions';
import { Permission } from '@typex/types';

describe('PolicyEngine', () => {
  it('new agents get READ_CONTEXT + GENERATE_CONTENT by default', () => {
    const pe = new PolicyEngine();
    expect(pe.checkPermissions('new-agent', Permission.READ_CONTEXT).allowed).toBe(true);
    expect(pe.checkPermissions('new-agent', Permission.GENERATE_CONTENT).allowed).toBe(true);
  });

  it('SEND_MESSAGE / POST / DELETE / UPLOAD default to explicit-grant denial', () => {
    const pe = new PolicyEngine();
    for (const p of [Permission.SEND_MESSAGE, Permission.POST, Permission.DELETE, Permission.UPLOAD]) {
      const c = pe.checkPermissions('new-agent', p);
      expect(c.allowed).toBe(false);
      expect(c.reason).toContain('explicit grant');
    }
  });

  it('explicit grants allow, and getPermissions reflects them', () => {
    const pe = new PolicyEngine();
    pe.setPermissions('a1', [Permission.SEND_MESSAGE, Permission.READ_MESSAGES]);
    expect(pe.checkPermissions('a1', Permission.SEND_MESSAGE)).toEqual({ allowed: true, reason: 'explicitly granted' });
    expect(pe.checkPermissions('a1', Permission.POST).allowed).toBe(false);
    expect(pe.getPermissions('a1')).toContain(Permission.SEND_MESSAGE);
  });

  it('grants are per-agent (no leak between agents)', () => {
    const pe = new PolicyEngine();
    pe.setPermissions('a1', [Permission.SEND_MESSAGE]);
    expect(pe.checkPermissions('a2', Permission.SEND_MESSAGE).allowed).toBe(false);
  });
});
