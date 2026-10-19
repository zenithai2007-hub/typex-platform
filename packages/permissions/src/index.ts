/* ============================================================================
 * @typex/permissions — explicit, auditable permission policy per agent.
 * New agents start with read+generate only; SEND_MESSAGE, POST, DELETE and
 * UPLOAD require an explicit grant. Denials always carry a reason.
 * ========================================================================== */

import { Permission } from '@typex/types';

export interface PermissionCheck {
  allowed: boolean;
  reason: string;
}

/** Granted to a brand-new agent when no explicit setPermissions call happens. */
export const DEFAULT_AGENT_PERMISSIONS: Permission[] = [
  Permission.READ_CONTEXT,
  Permission.GENERATE_CONTENT,
];

/** Sensitive actions never get an implicit grant. */
export const SENSITIVE_PERMISSIONS: Permission[] = [
  Permission.SEND_MESSAGE,
  Permission.POST,
  Permission.DELETE,
  Permission.UPLOAD,
];

export class PolicyEngine {
  private grants = new Map<string, Set<Permission>>();

  setPermissions(agentId: string, perms: Permission[]): void {
    this.grants.set(agentId, new Set(perms));
  }

  getPermissions(agentId: string): Permission[] {
    const g = this.grants.get(agentId);
    return g ? [...g] : [...DEFAULT_AGENT_PERMISSIONS];
  }

  checkPermissions(agentId: string, action: Permission): PermissionCheck {
    const held = this.grants.get(agentId);
    if (held && held.has(action)) {
      return { allowed: true, reason: 'explicitly granted' };
    }
    if (!held && DEFAULT_AGENT_PERMISSIONS.includes(action)) {
      return { allowed: true, reason: 'default grant' };
    }
    const why = SENSITIVE_PERMISSIONS.includes(action)
      ? `${action} denied: requires explicit grant`
      : `${action} denied: not granted`;
    return { allowed: false, reason: why };
  }
}
