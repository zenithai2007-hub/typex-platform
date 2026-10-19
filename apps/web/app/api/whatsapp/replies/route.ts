import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const to = (url.searchParams.get('to') || '').trim();
    if (!to) return err('missing_recipient', '"to" (phone number) is required.', 400);
    const sinceRaw = url.searchParams.get('since');
    const since = sinceRaw ? Number(sinceRaw) : 0;
    const result = await tx.waAdapter.readContext({
      phone: to,
      since: Number.isFinite(since) ? since : 0,
      limit: 20,
    });
    if (!result.ok) {
      const status = result.code === 'not_configured' ? 503 : 502;
      return ok({ result }, status);
    }
    return ok({ result });
  } catch (e) {
    return errFrom(e);
  }
}
