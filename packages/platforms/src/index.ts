/* ============================================================================
 * @typex/platforms — platform registry + honest adapter base class.
 * Adding a platform = registry.register(descriptor, adapter). Core is never
 * touched to add one.
 * ========================================================================== */

import type { Capability, ExecutionResult, Platform, PlatformAdapter } from '@typex/types';

export interface RegistryEntry {
  platform: Platform;
  adapter?: PlatformAdapter;
}

export class PlatformRegistry {
  private entries = new Map<string, RegistryEntry>();

  register(platform: Platform, adapter?: PlatformAdapter): void {
    this.entries.set(platform.id, { platform, adapter });
  }

  /** Returns true if a platform was actually removed. */
  unregister(id: string): boolean {
    return this.entries.delete(id);
  }

  get(id: string): RegistryEntry | undefined {
    return this.entries.get(id);
  }

  getAdapter(id: string): PlatformAdapter | undefined {
    return this.entries.get(id)?.adapter;
  }

  list(): Platform[] {
    return [...this.entries.values()].map((e) => e.platform);
  }

  listByCapability(cap: Capability): Platform[] {
    return this.list().filter((p) => p.capabilities.includes(cap));
  }
}

/** Every adapter method defaults to an honest "not supported" — concrete
 *  adapters override only what they genuinely implement. */
export abstract class PlatformAdapterBase implements PlatformAdapter {
  abstract readonly platformId: string;

  protected notSupported(): ExecutionResult {
    return { ok: false, code: 'unsupported', message: 'Not supported for this connection.' };
  }

  getCapabilities(): Capability[] {
    return [];
  }

  async connect(): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async disconnect(): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async authenticate(_credentials: Record<string, string>): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async getCurrentContext(): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async readContext(_input?: unknown): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async search(_query: string): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async generateAction(_instruction: string, _context: unknown): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async prepareAction(_plan: import('@typex/types').ActionPlan): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async executeAction(_plan: import('@typex/types').ActionPlan): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async send(_input: { to: string; text: string; name?: string }): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async insertText(_text: string): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async upload(_input: { file: unknown; name?: string }): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async schedule(_input: { at: string; action: unknown }): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async stop(): Promise<ExecutionResult> {
    return this.notSupported();
  }
  async pause(): Promise<ExecutionResult> {
    return this.notSupported();
  }
}
