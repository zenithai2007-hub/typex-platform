/* Outreach module — honest by design. Manual lead import only; every send
 * goes through the approval queue (no bulk spam tooling). Leads are stored
 * as durable GLOBAL memory items (key prefix "lead:") — same store, no
 * dedicated entity in core yet. */

import { getTx, OWNER_ID } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const PREFIX = 'lead:';

export interface Lead {
  id: string;
  name: string;
  contact: string;
  platform: string;
  company?: string;
  notes?: string;
  source: string;
  status: 'NEW' | 'MESSAGED' | 'REPLIED' | 'WON' | 'LOST';
  createdAt: string;
}

async function loadLeads(tx: Awaited<ReturnType<typeof getTx>>): Promise<Lead[]> {
  const items = await tx.store.listMemoryItems('GLOBAL', 'global');
  return items
    .filter((i) => i.key.startsWith(PREFIX))
    .map((i) => JSON.parse(i.value) as Lead)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function saveLead(tx: Awaited<ReturnType<typeof getTx>>, lead: Lead) {
  await tx.store.createMemoryItem({
    scope: 'GLOBAL', scopeId: 'global', key: PREFIX + lead.id, value: JSON.stringify(lead),
  });
}

export async function GET() {
  try {
    const tx = await getTx();
    return ok({ leads: await loadLeads(tx) });
  } catch (e) {
    return errFrom(e);
  }
}

/** POST — manual lead import. source/consent is REQUIRED. */
export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const contact = String(body.contact ?? '').trim();
    const platform = String(body.platform ?? '').trim();
    const source = String(body.source ?? '').trim();
    if (!name) return err('missing_name', 'name is required.', 400);
    if (!contact) return err('missing_contact', 'contact is required.', 400);
    if (!platform) return err('missing_platform', 'platform is required.', 400);
    if (!source) {
      return err('missing_source', 'source/consent is required — say where this contact came from and why you may reach out.', 400);
    }
    const lead: Lead = {
      id: randomUUID(),
      name, contact, platform,
      company: body.company ? String(body.company) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      source,
      status: 'NEW',
      createdAt: new Date().toISOString(),
    };
    await saveLead(tx, lead);
    return ok({ lead }, 201);
  } catch (e) {
    return errFrom(e);
  }
}

/** PATCH — update fields / status. */
export async function PATCH(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? '').trim();
    if (!id) return err('missing_id', 'id is required.', 400);
    const item = await tx.store.getMemoryItem('GLOBAL', 'global', PREFIX + id);
    if (!item) return err('lead_not_found', `Lead not found: ${id}`, 404);
    const lead = JSON.parse(item.value) as Lead;
    const next: Lead = {
      ...lead,
      name: body.name !== undefined ? String(body.name) : lead.name,
      contact: body.contact !== undefined ? String(body.contact) : lead.contact,
      platform: body.platform !== undefined ? String(body.platform) : lead.platform,
      company: body.company !== undefined ? String(body.company) || undefined : lead.company,
      notes: body.notes !== undefined ? String(body.notes) || undefined : lead.notes,
      source: body.source !== undefined ? String(body.source) : lead.source,
      status: body.status !== undefined ? body.status : lead.status,
    };
    if (!['NEW', 'MESSAGED', 'REPLIED', 'WON', 'LOST'].includes(next.status)) {
      return err('invalid_status', 'Invalid lead status.', 400);
    }
    await saveLead(tx, next);
    return ok({ lead: next });
  } catch (e) {
    return errFrom(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const tx = await getTx();
    const id = (new URL(req.url).searchParams.get('id') || '').trim();
    if (!id) return err('missing_id', 'id is required.', 400);
    await tx.store.deleteMemoryItem('GLOBAL', 'global', PREFIX + id);
    return ok({ deleted: true });
  } catch (e) {
    return errFrom(e);
  }
}
