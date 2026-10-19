import { describe, it, expect } from 'vitest';
import { GenericWebAdapter } from '@typex/generic-web';
import { Capability } from '@typex/types';

describe('GenericWebAdapter', () => {
  it('does NOT declare SEND_MESSAGE', () => {
    const a = new GenericWebAdapter();
    expect(a.getCapabilities()).not.toContain(Capability.SEND_MESSAGE);
    expect(a.getCapabilities()).toContain(Capability.READ_PAGE_CONTEXT);
  });

  it('send() is honestly unsupported', async () => {
    const res = await new GenericWebAdapter().send({ to: 'x', text: 'y' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('unsupported');
    expect(res.message).toBe('Not supported for this connection.');
  });

  it('readContext() requires the Phase-2 extension (Assisted Mode)', async () => {
    const res = await new GenericWebAdapter().readContext();
    expect(res.ok).toBe(false);
    expect(res.code).toBe('extension_required');
    expect(res.message).toContain('Assisted Mode');
  });
});
