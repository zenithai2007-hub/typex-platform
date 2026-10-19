import { getTx, OWNER_ID } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';
import type { ConnectionStatus } from '@typex/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tx = await getTx();
    const connections = await tx.store.listConnections(OWNER_ID);
    return ok({ connections });
  } catch (e) {
    return errFrom(e);
  }
}

/** POST { platformId } — runs the REAL adapter verification. Honest statuses only.
 *  Connection records are append-only status history; the newest entry per
 *  platform is the current state. */
export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const platformId = String(body.platformId ?? '').trim();
    if (!platformId) return err('missing_platform', 'platformId is required.', 400);
    const adapter = tx.registry.getAdapter(platformId);
    if (!adapter) return err('no_adapter', `No adapter registered for "${platformId}".`, 400);

    const result = await adapter.connect();
    const status: ConnectionStatus = result.ok ? 'CONNECTED' : 'ERROR';
    const connection = await tx.store.createConnection({
      userId: OWNER_ID,
      platformId,
      status,
      // Reference only — keys live in server env, never in the store.
      credentialsRef: platformId === 'whatsapp' ? 'env:RESPONDIO_API_KEY' : 'phase2',
    });
    if (!result.ok) {
      return ok({ connection, result }, 502);
    }
    return ok({ connection, result });
  } catch (e) {
    return errFrom(e);
  }
}

/** DELETE ?id= — runs the real adapter disconnect and records DISCONNECTED. */
export async function DELETE(req: Request) {
  try {
    const tx = await getTx();
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return err('missing_id', 'id is required.', 400);
    const connection = await tx.store.getConnection(id);
    if (!connection) return err('connection_not_found', `Connection not found: ${id}`, 404);
    const adapter = tx.registry.getAdapter(connection.platformId);
    const adapterResult = adapter ? await adapter.disconnect() : { ok: true };
    const closed = await tx.store.createConnection({
      userId: OWNER_ID,
      platformId: connection.platformId,
      status: 'DISCONNECTED',
      credentialsRef: connection.credentialsRef,
    });
    return ok({ connection: closed, adapterResult });
  } catch (e) {
    return errFrom(e);
  }
}
