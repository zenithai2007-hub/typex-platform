import { getTx, OWNER_ID } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

/** POST { leadId, text, name? } — NEVER sends directly. Creates a PENDING
 *  approval on the matching agent; the /approvals page decides. */
export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const leadId = String(body.leadId ?? '').trim();
    const text = String(body.text ?? '').trim();
    if (!leadId) return err('missing_lead', 'leadId is required.', 400);
    if (!text) return err('empty_message', 'text is required.', 400);

    const item = await tx.store.getMemoryItem('GLOBAL', 'global', 'lead:' + leadId);
    if (!item) return err('lead_not_found', `Lead not found: ${leadId}`, 404);
    const lead = JSON.parse(item.value) as { name?: string; contact?: string; platform?: string };

    const platformId = (lead.platform || 'whatsapp').toLowerCase() === 'whatsapp' ? 'whatsapp' : 'generic-web';
    const agents = await tx.orch.listAgents(OWNER_ID);
    const agent = agents.find((a) => a.platformId === platformId) ?? agents[0];
    if (!agent) return err('no_agent', 'No agent exists to own this send.', 500);

    const plan = {
      id: 'plan-' + Date.now(),
      agentId: agent.id,
      kind: 'send_message',
      platformId: agent.platformId,
      payload: { to: lead.contact, text, name: body.name ?? lead.name },
      mode: 'api' as const,
      requiresApproval: false,
      createdAt: new Date(),
    };
    const approval = await tx.store.createApproval({
      agentId: agent.id,
      action: 'send_message',
      preview: text,
      payload: JSON.parse(JSON.stringify(plan)) as Record<string, unknown>,
      status: 'PENDING',
    });
    await tx.store.logAudit({
      agentId: agent.id,
      action: 'approval.requested',
      outcome: 'PREPARED',
      detail: { approvalId: approval.id, leadId, leadName: lead.name },
    });
    return ok({ approvalId: approval.id, agentId: agent.id, status: 'PENDING' }, 201);
  } catch (e) {
    return errFrom(e);
  }
}
