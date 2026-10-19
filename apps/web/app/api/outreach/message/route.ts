import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';
import type { AIStyle } from '@typex/ai';

export const dynamic = 'force-dynamic';

/** POST { lead, objective?, style? } — draft a personalized message (no send). */
export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const lead = body.lead as { name?: string; contact?: string; platform?: string; company?: string; notes?: string } | undefined;
    if (!lead || !lead.name) return err('missing_lead', 'lead (with name) is required.', 400);
    const objective = String(body.objective ?? 'Introduce TYPE X and start a conversation').trim();
    const style = (body.style ?? {}) as AIStyle;
    const instruction =
      `Write a short, personal first message (max 60 words) to a potential client.\n` +
      `Name: ${lead.name}\n` +
      (lead.company ? `Company: ${lead.company}\n` : '') +
      (lead.notes ? `Notes: ${lead.notes}\n` : '') +
      `Platform: ${lead.platform ?? 'whatsapp'}\n` +
      `Goal: ${objective}\n` +
      `Rules: friendly, specific, no spammy hype, end with one short question.`;
    const text = await tx.ai.generate({ instruction, style });
    return ok({ ok: true, text, provider: tx.aiProviderName });
  } catch (e) {
    return errFrom(e);
  }
}
