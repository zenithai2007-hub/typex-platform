/* Styles are stored as durable GLOBAL memory items (key prefix "style:").
 * Simplification: the core Store has no dedicated styles entity yet, so the
 * web layer persists presets as namespaced memory — same durable store. */

import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const PREFIX = 'style:';
const ACTIVE_KEY = 'style:active';

export interface StylePreset {
  id: string;
  name: string;
  tone?: string;
  language?: string;
  length?: string;
  format?: string;
}

async function loadStyles(tx: Awaited<ReturnType<typeof getTx>>) {
  const items = await tx.store.listMemoryItems('GLOBAL', 'global');
  return items
    .filter((i) => i.key.startsWith(PREFIX))
    .map((i) => ({ ...(JSON.parse(i.value) as StylePreset), _itemKey: i.key }));
}

export async function GET() {
  try {
    const tx = await getTx();
    const styles = await loadStyles(tx);
    const activeItem = await tx.store.getMemoryItem('GLOBAL', 'global', ACTIVE_KEY);
    const activeId = activeItem?.value ?? null;
    return ok({ styles, activeId });
  } catch (e) {
    return errFrom(e);
  }
}

export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    if (!name) return err('missing_name', 'name is required.', 400);
    const style: StylePreset = {
      id: String(body.id ?? randomUUID()),
      name,
      tone: body.tone, language: body.language, length: body.length, format: body.format,
    };
    const key = PREFIX + style.id;
    const existing = await tx.store.getMemoryItem('GLOBAL', 'global', key);
    if (!existing && body.id) {
      // Explicit id for a create that doesn't exist → treat as create with given id.
    }
    await tx.store.createMemoryItem({ scope: 'GLOBAL', scopeId: 'global', key, value: JSON.stringify(style) });
    if (body.activate) {
      await tx.store.createMemoryItem({ scope: 'GLOBAL', scopeId: 'global', key: ACTIVE_KEY, value: style.id });
    }
    return ok({ style });
  } catch (e) {
    return errFrom(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const id = (url.searchParams.get('id') || '').trim();
    if (!id) return err('missing_id', 'id is required.', 400);
    await tx.store.deleteMemoryItem('GLOBAL', 'global', PREFIX + id);
    const activeItem = await tx.store.getMemoryItem('GLOBAL', 'global', ACTIVE_KEY);
    if (activeItem?.value === id) {
      await tx.store.deleteMemoryItem('GLOBAL', 'global', ACTIVE_KEY);
    }
    return ok({ deleted: true });
  } catch (e) {
    return errFrom(e);
  }
}
