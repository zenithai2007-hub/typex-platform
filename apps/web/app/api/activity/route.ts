import { getTx } from '@/lib/tx';
import { ok, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId') || undefined;
    const taskId = url.searchParams.get('taskId') || undefined;
    const outcome = url.searchParams.get('outcome') || undefined;
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));
    let events = await tx.store.listAudit({ agentId, taskId });
    if (outcome) events = events.filter((e) => e.outcome === outcome);
    events.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return ok({ events: events.slice(0, limit), total: events.length });
  } catch (e) {
    return errFrom(e);
  }
}
