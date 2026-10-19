/* ============================================================================
 * @typex/execution — runs an ActionPlan against a platform adapter.
 * mode 'api' calls the real adapter. 'browser' and 'keyboard' are Phase 2
 * and fail honestly with an Assisted-Mode message — never a fake success.
 * ========================================================================== */

import type { ActionPlan, ExecutionResult, PlatformAdapter } from '@typex/types';

export class ExecutionEngine {
  async execute(plan: ActionPlan, adapter: PlatformAdapter): Promise<ExecutionResult> {
    if (plan.mode === 'browser') {
      return {
        ok: false,
        code: 'phase2',
        message:
          'Browser extension ships in Phase 2 — Assisted Mode: copy the prepared output and complete the action in the target tab.',
      };
    }
    if (plan.mode === 'keyboard') {
      return {
        ok: false,
        code: 'phase2_keyboard',
        message:
          'Keyboard companion ships in Phase 2 — Assisted Mode: copy the prepared output; the companion will type it once installed.',
      };
    }
    try {
      switch (plan.kind) {
        case 'send_message':
          return await adapter.send({
            to: String(plan.payload.to ?? ''),
            text: String(plan.payload.text ?? ''),
            name: plan.payload.name as string | undefined,
          });
        case 'insert_text':
          return await adapter.insertText(String(plan.payload.text ?? ''));
        case 'upload':
          return await adapter.upload({
            file: plan.payload.file,
            name: plan.payload.name as string | undefined,
          });
        case 'schedule':
          return await adapter.schedule({
            at: String(plan.payload.at ?? ''),
            action: plan.payload.action,
          });
        case 'generate_text':
          // Text is generated locally by the AI provider before the plan is
          // built; nothing platform-side to execute.
          return { ok: true, data: { text: plan.payload.text } };
        default:
          return await adapter.executeAction(plan);
      }
    } catch (e) {
      return {
        ok: false,
        code: 'execution_error',
        message: String((e as Error)?.message ?? e),
      };
    }
  }
}
