# @typex/ai

AI provider abstraction for TYPE X Core.

## Providers

| Provider | Key needed | Notes |
|---|---|---|
| `LocalProvider` | none | Real offline engine (task detection, tones, EN / Roman Urdu / Urdu, translation dictionary). |
| `OpenAIProvider` | `OPENAI_API_KEY` | Throws `ConfigurationError` without a key. |
| `AnthropicProvider` | `ANTHROPIC_API_KEY` | Throws `ConfigurationError` without a key. |

## Server-only keys

API keys are read from the **server environment** (`process.env`) or passed to the
constructor — never from client-side code. The web app must keep these providers
behind API routes; never bundle keys into the browser build.

## Interface

```ts
import { LocalProvider } from '@typex/ai';

const ai = new LocalProvider();
await ai.generate({ instruction: 'reply to the customer about pricing', style: { language: 'Roman Urdu' } });
await ai.classify('write an email about pricing'); // → 'email'
await ai.planAction('reply to the customer', { to: '923001234567' });
// → { kind: 'send_message', requiresApproval: true, permission: 'SEND_MESSAGE', preview, payload }
```

`planAction` maps outbound intents (reply/message/email/follow-up) to `send_message`
(requires approval + `SEND_MESSAGE` grant); everything else becomes `generate_text`.
For `send_message` kinds it drafts the real text immediately so the approval
preview shows exactly what would be sent.
