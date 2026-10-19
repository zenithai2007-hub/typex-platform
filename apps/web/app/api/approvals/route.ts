import { getTx, OWNER_ID } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const agentId = url.searchParams.get('agentId') || undefined;
    const pendingOnly = url.searchParams.get('pending') === '1';
    let approvals = await tx.store.listApprovals(agentId);
    if (pendingOnly) approvals = approvals.filter((a) => a.status === 'PENDING');
    approvals.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return ok({ approvals });
  } catch (e) {
    return errFrom(e);
  }
}

/** POST { agentId?, action, preview, payload, platformId? } — create a PENDING
 *  approval directly (e.g. workspace EXECUTE). Never executes on creation. */
export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const preview = String(body.preview ?? '').trim();
    if (!preview) return err('missing_preview', 'preview is required.', 400);
    const action = String(body.action ?? 'send_message').trim();
    const payload = (body.payload ?? {}) as Record<string, unknown>;

    let agentId = String(body.agentId ?? '').trim();
    if (!agentId) {
      const agents = await tx.orch.listAgents(OWNER_ID);
      const platformId = String(body.platformId ?? 'whatsapp');
      const agent = agents.find((a) => a.platformId === platformId) ?? agents[0];
      if (!agent) return err('no_agent', 'No agent exists to own this action.', 500);
      agentId = agent.id;
    } else {
      const agent = await tx.orch.getAgent(agentId);
      if (!agent) return err('agent_not_found', `Agent not found: ${agentId}`, 404);
    }

    const approval = await tx.store.createApproval({
      agentId,
      action,
      preview,
      payload,
      status: 'PENDING',
    });
    await tx.store.logAudit({
      agentId,
      action: 'approval.requested',
      outcome: 'PREPARED',
      detail: { approvalId: approval.id, action },
    });
    return ok({ approval }, 201);
  } catch (e) {
    return errFrom(e);
  }
}
