import { getTx } from '@/lib/tx';
import { ok, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tx = await getTx();
    const platforms = tx.registry.list().map((p) => {
      const adapter = tx.registry.getAdapter(p.id);
      return {
        ...p,
        adapterRegistered: Boolean(adapter),
        adapterCapabilities: adapter ? adapter.getCapabilities() : [],
      };
    });
    return ok({ platforms });
  } catch (e) {
    return errFrom(e);
  }
}
