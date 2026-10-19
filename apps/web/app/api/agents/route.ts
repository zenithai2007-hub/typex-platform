import { getTx, OWNER_ID } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tx = await getTx();
    const agents = await tx.orch.listAgents(OWNER_ID);
    return ok({ agents });
  } catch (e) {
    return errFrom(e);
  }
}

export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    const platformId = String(body.platformId ?? '').trim();
    const instructions = String(body.instructions ?? '').trim();
    if (!name) return err('missing_name', 'name is required.', 400);
    if (!platformId) return err('missing_platform', 'platformId is required.', 400);
    if (!tx.registry.get(platformId)) {
      return err('unknown_platform', `Platform "${platformId}" is not registered.`, 400);
    }
    const agent = await tx.orch.createAgent({
      userId: OWNER_ID,
      platformId,
      name,
      instructions: instructions || 'General assistant.',
      permissions: body.permissions,
    });
    return ok({ agent }, 201);
  } catch (e) {
    return errFrom(e);
  }
}
