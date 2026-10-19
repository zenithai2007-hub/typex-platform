import { describe, it, expect } from 'vitest';
import { PlatformRegistry, PlatformAdapterBase } from '@typex/platforms';
import { Capability } from '@typex/types';
import type { Platform } from '@typex/types';

class DummyAdapter extends PlatformAdapterBase {
  readonly platformId = 'dummy';
}

function dummyPlatform(id: string, caps: Capability[]): Platform {
  return {
    id, name: id, icon: 'x', brandColor: '#000', connectionType: 'none',
    capabilities: caps, authMethod: 'none', supportedActions: [],
    contextExtraction: 'none', executionMethod: 'none', permissionRequirements: [],
    rateLimits: 'none', approvalRequired: false, adapterVersion: '0.0.0', status: 'active',
  };
}

describe('PlatformRegistry', () => {
  it('registers, lists, filters by capability, and unregisters without touching core', () => {
    const reg = new PlatformRegistry();
    reg.register(dummyPlatform('chat-x', [Capability.SEND_MESSAGE, Capability.READ_MESSAGES]), new DummyAdapter());
    reg.register(dummyPlatform('site-y', [Capability.READ_PAGE_CONTEXT]));

    expect(reg.get('chat-x')?.platform.name).toBe('chat-x');
    expect(reg.list().map((p) => p.id)).toContain('chat-x');
    expect(reg.listByCapability(Capability.SEND_MESSAGE).map((p) => p.id)).toEqual(['chat-x']);
    expect(reg.listByCapability(Capability.POST)).toEqual([]);

    expect(reg.unregister('site-y')).toBe(true);
    expect(reg.get('site-y')).toBeUndefined();
    expect(reg.unregister('nope')).toBe(false);
  });

  it('getAdapter returns the registered adapter', () => {
    const reg = new PlatformRegistry();
    const adapter = new DummyAdapter();
    reg.register(dummyPlatform('dummy', []), adapter);
    expect(reg.getAdapter('dummy')).toBe(adapter);
    expect(reg.getAdapter('missing')).toBeUndefined();
  });
});
