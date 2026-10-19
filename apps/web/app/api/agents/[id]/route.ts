import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const agent = await tx.orch.getAgent(params.id);
    if (!agent) return err('agent_not_found', `Agent not found: ${params.id}`, 404);
    const tasks = await tx.store.listTasks(params.id);
    const audit = await tx.store.listAudit({ agentId: params.id });
    const approvals = await tx.store.listApprovals(params.id);
    const permissions = tx.permissions.getPermissions(params.id);
    return ok({ agent, tasks, audit, approvals, permissions });
  } catch (e) {
    return errFrom(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.instructions === 'string') patch.instructions = body.instructions;
    if (Array.isArray(body.permissions)) patch.permissions = body.permissions;
    const agent = await tx.orch.updateAgent(params.id, patch);
    return ok({ agent });
  } catch (e) {
    return errFrom(e);
  }
}
