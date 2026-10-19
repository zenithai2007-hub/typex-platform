/* ============================================================================
 * @typex/memory — scoped, isolated memory. Keys are namespaced as
 * `${scope}:${scopeId}:${key}` so agent A's memory is never visible to
 * agent B. Scopes never auto-merge. Disabled scopes read as empty and
 * reject writes.
 * ========================================================================== */

import type { MemoryScope } from '@typex/types';

export class ScopedMemory {
  private items = new Map<string, string>();
  private disabled = new Set<MemoryScope>();

  private namespaced(scope: MemoryScope, scopeId: string, key: string): string {
    return `${scope}:${scopeId}:${key}`;
  }

  set(scope: MemoryScope, scopeId: string, key: string, value: string): void {
    if (this.disabled.has(scope)) {
      throw new Error(`memory scope ${scope} is disabled`);
    }
    this.items.set(this.namespaced(scope, scopeId, key), value);
  }

  get(scope: MemoryScope, scopeId: string, key: string): string | undefined {
    if (this.disabled.has(scope)) return undefined;
    return this.items.get(this.namespaced(scope, scopeId, key));
  }

  /** All keys for one (scope, scopeId) — never leaks other scopes' data. */
  list(scope: MemoryScope, scopeId: string): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.disabled.has(scope)) return out;
    const prefix = `${scope}:${scopeId}:`;
    for (const [k, v] of this.items) {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
    }
    return out;
  }

  delete(scope: MemoryScope, scopeId: string, key: string): boolean {
    return this.items.delete(this.namespaced(scope, scopeId, key));
  }

  disableScope(scope: MemoryScope): void {
    this.disabled.add(scope);
  }

  enableScope(scope: MemoryScope): void {
    this.disabled.delete(scope);
  }

  isDisabled(scope: MemoryScope): boolean {
    return this.disabled.has(scope);
  }
}
