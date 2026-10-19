import { getTx } from '@/lib/tx';
import { ok, err, errFrom } from '@/lib/respond';
import type { AIStyle } from '@typex/ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const tx = await getTx();
    const body = await req.json().catch(() => ({}));
    const instruction = String(body.instruction ?? '').trim();
    if (!instruction) return err('missing_instruction', 'instruction is required.', 400);
    const style = (body.style ?? {}) as AIStyle;

    if (body.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (obj: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          try {
            const text = await tx.ai.generate({
              instruction,
              contextText: body.contextText,
              style,
              onToken: (t: string) => send({ token: t }),
            });
            send({ done: true, text });
          } catch (e) {
            send({ error: e instanceof Error ? e.message : String(e) });
          }
          controller.close();
        },
      });
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    const text = await tx.ai.generate({ instruction, contextText: body.contextText, style });
    return ok({ ok: true, text, provider: tx.aiProviderName });
  } catch (e) {
    return errFrom(e);
  }
}
