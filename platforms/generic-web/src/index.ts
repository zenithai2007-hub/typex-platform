/* ============================================================================
 * @typex/generic-web — adapter for any website before the Phase-2 browser
 * extension exists. Honest by design: context reads need the extension
 * (Assisted Mode until then); everything else is unsupported.
 * ========================================================================== */

import { Capability, Platform } from '@typex/types';
import { PlatformAdapterBase } from '@typex/platforms';

export const genericWebPlatform: Platform = {
  id: 'generic-web',
  name: 'Generic Website',
  icon: 'globe',
  brandColor: '#6E56CF',
  connectionType: 'extension',
  capabilities: [Capability.READ_PAGE_CONTEXT, Capability.GENERATE_TEXT, Capability.INSERT_TEXT],
  authMethod: 'browser extension (Phase 2)',
  supportedActions: ['readContext (extension)', 'generateText'],
  contextExtraction: 'browser extension DOM read (Phase 2)',
  executionMethod: 'assisted (copy prepared output)',
  permissionRequirements: ['INSERT_TEXT is assisted-only until the extension ships'],
  rateLimits: 'n/a',
  approvalRequired: false,
  adapterVersion: '1.0.0',
  status: 'beta',
};

export class GenericWebAdapter extends PlatformAdapterBase {
  readonly platformId = 'generic-web';

  getCapabilities(): Capability[] {
    return [Capability.READ_PAGE_CONTEXT, Capability.GENERATE_TEXT, Capability.INSERT_TEXT];
  }

  async readContext(_input?: unknown) {
    return {
      ok: false,
      code: 'extension_required',
      message: 'Browser extension ships in Phase 2 — use Assisted Mode (copy the prepared output).',
    };
  }

  async insertText(_text: string) {
    return {
      ok: false,
      code: 'assisted',
      message: 'INSERT_TEXT on the web is assisted — copy the prepared text into the target page.',
    };
  }
}
