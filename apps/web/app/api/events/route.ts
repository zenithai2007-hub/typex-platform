import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const type = String(body.type ?? '').trim();
    const agentId = String(body.agentId ?? '').trim();
    if (!type) return err('missing_type', 'type is required.', 400);
    if (!agentId) return err('missing_agent', 'agentId is required.', 400);
    const result = await tx.orch.handleEvent({
      type,
      agentId,
      payload: (body.payload ?? {}) as Record<string, unknown>,
    });
    return ok({ result });
  } catch (e) {
    return errFrom(e);
  }
}
