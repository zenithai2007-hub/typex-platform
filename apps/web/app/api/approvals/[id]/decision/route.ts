import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const decision = String(body.decision ?? '').trim();
    if (!['approved', 'rejected', 'cancelled'].includes(decision)) {
      return err('invalid_decision', 'decision must be approved, rejected or cancelled.', 400);
    }
    const result = await tx.orch.approveAction(
      params.id,
      decision as 'approved' | 'rejected' | 'cancelled',
    );
    return ok({ result });
  } catch (e) {
    return errFrom(e);
  }
}
