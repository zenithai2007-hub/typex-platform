import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const tx = await getTx();
    const agent = await tx.orch.stopAgent(params.id);
    return ok({ agent });
  } catch (e) {
    return errFrom(e);
  }
}
