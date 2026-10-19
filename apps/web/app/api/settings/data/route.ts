import { getTx } from '@/lib/tx';
import { ok, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

/** DELETE — removes user data kept as GLOBAL memory items: styles, leads,
 *  saved workspace outputs and settings. Agents, tasks and the audit log
 *  are append-only by design and are NOT deleted here. */
export async function DELETE() {
  try {
    const tx = await getTx();
    const items = await tx.store.listMemoryItems('GLOBAL', 'global');
    let deleted = 0;
    for (const i of items) {
      await tx.store.deleteMemoryItem('GLOBAL', 'global', i.key);
      deleted += 1;
    }
    return ok({ deleted });
  } catch (e) {
    return errFrom(e);
  }
}
