import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const tasks = await tx.store.listTasks(params.id);
    return ok({ tasks });
  } catch (e) {
    return errFrom(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const objective = String(body.objective ?? '').trim();
    if (!objective) return err('missing_objective', 'objective is required.', 400);
    const agent = await tx.orch.getAgent(params.id);
    if (!agent) return err('agent_not_found', `Agent not found: ${params.id}`, 404);
    const task = await tx.orch.createTask(
      params.id,
      objective,
      String(body.instructions ?? ''),
      { trigger: body.trigger, schedule: body.schedule, permissions: body.permissions },
    );
    return ok({ task }, 201);
  } catch (e) {
    return errFrom(e);
  }
}
