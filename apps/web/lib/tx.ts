/* CLINT X server core — lazy singleton (serverless-safe). Builds the real
 * stack once: registry (whatsapp + generic-web adapters), store (DEMO MODE
 * memory store when DATABASE_URL is unset), policy engine, scoped memory,
 * AI provider (local, or OpenAI/Anthropic when keys are set — server-side),
 * execution engine and the AgentOrchestrator. */

import { AgentOrchestrator } from '@typex/agents';
import {
  AnthropicProvider,
  LocalProvider,
  OpenAIProvider,
  type AIProvider,
} from '@typex/ai';
import { getStore, type Store } from '@typex/db';
import { ExecutionEngine } from '@typex/execution';
import { ScopedMemory } from '@typex/memory';
import { PolicyEngine, DEFAULT_AGENT_PERMISSIONS } from '@typex/permissions';
import { PlatformRegistry } from '@typex/platforms';
import { GenericWebAdapter, genericWebPlatform } from '@typex/generic-web';
import { WhatsAppAdapter, whatsappPlatform } from '@typex/whatsapp';

export interface TxStack {
  store: Store;
  ai: AIProvider;
  aiProviderName: string;
  registry: PlatformRegistry;
  permissions: PolicyEngine;
  memory: ScopedMemory;
  execution: ExecutionEngine;
  orch: AgentOrchestrator;
  waAdapter: WhatsAppAdapter;
  gwAdapter: GenericWebAdapter;
  demoMode: boolean;
}

export const OWNER_ID = 'owner';

let stack: TxStack | null = null;
let seeded = false;

function pickProvider(): { ai: AIProvider; name: string } {
  if (process.env.OPENAI_API_KEY) {
    return { ai: new OpenAIProvider(process.env.OPENAI_API_KEY), name: 'openai' };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { ai: new AnthropicProvider(process.env.ANTHROPIC_API_KEY), name: 'anthropic' };
  }
  return { ai: new LocalProvider(), name: 'local' };
}

async function seedIfEmpty(store: Store, orch: AgentOrchestrator): Promise<void> {
  const existing = await store.listAgents(OWNER_ID);
  if (existing.length > 0) return;
  await orch.createAgent({
    userId: OWNER_ID,
    platformId: 'whatsapp',
    name: 'WhatsApp Agent',
    instructions:
      'You are the user\'s WhatsApp assistant. Answer clearly in Roman Urdu or English, matching the language the user uses. ' +
      'Never send a message without explicit approval unless the task was pre-approved.',
    permissions: [...DEFAULT_AGENT_PERMISSIONS],
  });
  await orch.createAgent({
    userId: OWNER_ID,
    platformId: 'generic-web',
    name: 'Generic Web Agent',
    instructions:
      'You are the user\'s web assistant. Draft content for any website. INSERT_TEXT is assisted: prepare the text, ' +
      'the human copies it into the target page (browser extension ships in Phase 2).',
    permissions: [...DEFAULT_AGENT_PERMISSIONS],
  });
}

export async function getTx(): Promise<TxStack> {
  if (stack) {
    if (!seeded) {
      seeded = true;
      await seedIfEmpty(stack.store, stack.orch).catch((e) =>
        console.error('[typex] seed failed:', e),
      );
    }
    return stack;
  }
  const registry = new PlatformRegistry();
  const waAdapter = new WhatsAppAdapter();
  const gwAdapter = new GenericWebAdapter();
  registry.register(whatsappPlatform, waAdapter);
  registry.register(genericWebPlatform, gwAdapter);

  const store = getStore();
  const permissions = new PolicyEngine();
  const memory = new ScopedMemory();
  const execution = new ExecutionEngine();
  const { ai, name } = pickProvider();
  const orch = new AgentOrchestrator({ store, ai, registry, permissions, memory, execution });

  stack = {
    store,
    ai,
    aiProviderName: name,
    registry,
    permissions,
    memory,
    execution,
    orch,
    waAdapter,
    gwAdapter,
    demoMode: !process.env.DATABASE_URL,
  };
  seeded = true;
  await seedIfEmpty(store, orch).catch((e) => console.error('[typex] seed failed:', e));
  return stack;
}
