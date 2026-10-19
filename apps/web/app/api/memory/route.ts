import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';
import type { MemoryScope } from '@typex/types';

export const dynamic = 'force-dynamic';

const SCOPES: MemoryScope[] = ['GLOBAL', 'PLATFORM', 'AGENT', 'TASK', 'CONVERSATION'];

function asScope(v: unknown): MemoryScope | null {
  return typeof v === 'string' && (SCOPES as string[]).includes(v) ? (v as MemoryScope) : null;
}

export async function GET(req: Request) {
  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const scope = asScope(url.searchParams.get('scope'));
    const scopeId = (url.searchParams.get('scopeId') || '').trim();
    if (!scope) return err('missing_scope', 'scope is required (GLOBAL|PLATFORM|AGENT|TASK|CONVERSATION).', 400);
    if (!scopeId) return err('missing_scope_id', 'scopeId is required.', 400);
    const items = await tx.store.listMemoryItems(scope, scopeId);
    return ok({ items });
  } catch (e) {
    return errFrom(e);
  }
}

/** POST { scope, scopeId, key, value } — create or update (upsert by key). */
export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const scope = asScope(body.scope);
    const scopeId = String(body.scopeId ?? '').trim();
    const key = String(body.key ?? '').trim();
    const value = String(body.value ?? '');
    if (!scope) return err('missing_scope', 'scope is required.', 400);
    if (!scopeId) return err('missing_scope_id', 'scopeId is required.', 400);
    if (!key) return err('missing_key', 'key is required.', 400);
    const item = await tx.store.createMemoryItem({ scope, scopeId, key, value });
    return ok({ item }, 201);
  } catch (e) {
    return errFrom(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const scope = asScope(url.searchParams.get('scope'));
    const scopeId = (url.searchParams.get('scopeId') || '').trim();
    const key = (url.searchParams.get('key') || '').trim();
    if (!scope || !scopeId || !key) {
      return err('missing_params', 'scope, scopeId and key are required.', 400);
    }
    await tx.store.deleteMemoryItem(scope, scopeId, key);
    return ok({ deleted: true });
  } catch (e) {
    return errFrom(e);
  }
}
