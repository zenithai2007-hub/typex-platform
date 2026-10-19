import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const to = String(body.to ?? '').trim();
    const text = String(body.text ?? '').trim();
    if (!to) return err('missing_recipient', '"to" (phone number) is required.', 400);
    if (!text) return err('empty_message', '"text" is required.', 400);

    const result = await tx.waAdapter.send({ to, text, name: body.name });
    if (!result.ok) {
      const status =
        result.code === 'not_configured'
          ? 503
          : result.code === 'invalid_recipient' || result.code === 'empty_message'
            ? 400
            : 502;
      return ok({ result }, status);
    }
    return ok({ result });
  } catch (e) {
    return errFrom(e);
  }
}
