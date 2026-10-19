import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const task = await tx.store.getTask(params.id);
    if (!task) return err('task_not_found', `Task not found: ${params.id}`, 404);
    return ok({ task });
  } catch (e) {
    return errFrom(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (typeof body.objective === 'string') patch.objective = body.objective;
    if (typeof body.instructions === 'string') patch.instructions = body.instructions;
    if (typeof body.status === 'string') patch.status = body.status;
    const task = await tx.orch.updateTask(params.id, patch);
    return ok({ task });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err('task_update_failed', message, 400);
  }
}

/** DELETE = honest soft-delete: tasks move to CANCELLED (no silent data loss). */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const task = await tx.store.getTask(params.id);
    if (!task) return err('task_not_found', `Task not found: ${params.id}`, 404);
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      return ok({ task, deleted: true });
    }
    const updated = await tx.orch.updateTask(params.id, { status: 'CANCELLED' });
    return ok({ task: updated, deleted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err('task_delete_failed', message, 400);
  }
}
