import { getTx } from '@/lib/tx';
import { ok } from '@/lib/respond';

export const dynamic = 'force-dynamic';

export async function GET() {
  const tx = await getTx();
  return ok({
    demoMode: tx.demoMode,
    whatsappConfigured: Boolean(process.env.RESPONDIO_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    aiProvider: tx.aiProviderName,
  });
}
