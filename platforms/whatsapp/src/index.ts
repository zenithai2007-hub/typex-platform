/* ============================================================================
 * @typex/whatsapp — REAL respond.io API v2 integration for the WhatsApp
 * platform adapter. TypeScript port of typex/api/_rio.js, send.js, replies.js.
 *
 * Honest flags (carried over from the original, 2026-10-19 — verify on the
 * first live test against https://docs.respond.io):
 *   - exact query params for searching contacts by phone (we list + match locally)
 *   - conversation list filter params (we list + match locally by contact id)
 *   - exact inbound-message field names (we normalize defensively)
 *
 * RESPONDIO_API_KEY is read lazily on every operation — never at import time,
 * so builds and unit tests run without it. `ok` is only true when respond.io
 * actually confirmed the action.
 * ========================================================================== */

import { Capability, ExecutionResult, Platform } from '@typex/types';
import { PlatformAdapterBase } from '@typex/platforms';

const RIO_BASE = 'https://api.respond.io/v2';

export class RioError extends Error {
  status: number;
  code: string;
  publicMessage: string;
  detail?: unknown;
  constructor(status: number, code: string, publicMessage: string, detail?: unknown) {
    super(publicMessage);
    this.name = 'RioError';
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.detail = detail;
  }
}

/** Read lazily per operation. Throws RioError(not_configured) when missing. */
export function getKey(): string {
  const key = process.env.RESPONDIO_API_KEY;
  if (!key) {
    throw new RioError(
      503,
      'not_configured',
      'RESPONDIO_API_KEY is not set. Add it to the server environment (Vercel → Project Settings → Environment Variables), then redeploy.',
    );
  }
  return key;
}

export function normalizePhone(to: unknown): string | null {
  if (to === undefined || to === null) return null;
  const digits = String(to).replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

interface RioResponse {
  status: number;
  data: unknown;
}

async function rio(path: string, key: string, opts: { method?: string; body?: unknown } = {}): Promise<RioResponse> {
  let res: Response;
  try {
    res = await fetch(RIO_BASE + path, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new RioError(502, 'provider_unreachable', 'Could not reach the respond.io API (network error).', String((e as Error)?.message ?? e));
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, data };
}

function errDetail(r: RioResponse): unknown {
  const d = r.data as { message?: unknown; error?: unknown } | null;
  return d && (d.message || d.error) ? d.message || d.error : r.data;
}

function rioError(action: string, r: RioResponse): RioError {
  const detail = errDetail(r);
  const text = JSON.stringify(detail || '').toLowerCase();
  if (/channel.*(not|isn't|is not).*(connect|active|enabled)|no.*active.*channel|channel not found/i.test(text)) {
    return new RioError(
      502,
      'channel_not_connected',
      'The WhatsApp channel is not connected in respond.io. Connect it first (respond.io → Settings → Channels), then retry.',
      detail,
    );
  }
  if (r.status === 401 || r.status === 403) {
    return new RioError(502, 'provider_auth_failed', 'respond.io rejected the API key. Check RESPONDIO_API_KEY in the server env vars.', detail);
  }
  if (r.status === 429) {
    return new RioError(502, 'provider_rate_limited', 'respond.io rate-limited the request. Wait a minute and retry.', detail);
  }
  if (r.status === 404) {
    return new RioError(
      502,
      'provider_not_found',
      `respond.io ${action} failed: resource not found (HTTP 404). The API shape may have changed — check the endpoint against https://docs.respond.io.`,
      detail,
    );
  }
  return new RioError(502, 'provider_error', `respond.io ${action} failed (HTTP ${r.status}).`, detail);
}

function asList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const d = data as { contacts?: unknown; conversations?: unknown; messages?: unknown; data?: unknown; items?: unknown } | null;
  const l = (d && (d.contacts || d.conversations || d.messages || d.data || d.items)) || [];
  return Array.isArray(l) ? (l as Record<string, unknown>[]) : [];
}

/** Find a contact id by phone: list contacts and match digits locally. */
export async function resolveContactByPhone(key: string, phone: string): Promise<string | null> {
  const r = await rio('/contacts', key);
  if (r.status < 200 || r.status >= 300) throw rioError('list-contacts', r);
  const want = String(phone).replace(/[^\d]/g, '');
  for (const c of asList(r.data)) {
    const channels = Array.isArray(c.channels)
      ? (c.channels as Record<string, unknown>[]).map((ch) => ch.phoneNumber || ch.phone)
      : [];
    const phones = [c.phoneNumber, c.phone, c.mobile, c.whatsapp, ...channels]
      .filter(Boolean)
      .map((p) => String(p).replace(/[^\d]/g, ''));
    if (phones.some((p) => p === want || p.endsWith(want) || want.endsWith(p))) {
      const id = c.id || c.contactId || c._id;
      return id ? String(id) : null;
    }
  }
  return null;
}

export interface NormalizedMessage {
  id: string;
  dir: 'in' | 'out';
  text: string;
  at: number;
}

/** Normalize one message defensively — exact field names are unverified. */
export function normMessage(m: unknown): NormalizedMessage | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  const msgObj = o.message as Record<string, unknown> | undefined;
  const text = (msgObj && msgObj.text) || o.text || o.body || o.content || '';
  if (!String(text).trim()) return null;
  const dirRaw = String(o.direction || o.type || o.from || '').toLowerCase();
  const inbound =
    o.fromContact === true ||
    o.isFromContact === true ||
    /inbound|incoming|received/.test(dirRaw) ||
    dirRaw === 'contact';
  const atRaw = o.createdAt || o.timestamp || o.sentAt || o.created_at || o.time;
  const at = atRaw ? new Date(String(atRaw)).getTime() : 0;
  const rawId = o.id || o.messageId || o._id;
  return {
    id: String(rawId || (at + ':' + String(text)).slice(0, 64)),
    dir: inbound ? 'in' : 'out',
    text: String(text).trim(),
    at: Number.isFinite(at) ? at : 0,
  };
}

function convMatchesContact(c: Record<string, unknown>, contactId: string): boolean {
  const contact = c.contact as Record<string, unknown> | undefined;
  const ids = [c.contactId, contact && contact.id, c.contact_id, c.contactID].filter(Boolean).map(String);
  return ids.includes(String(contactId));
}

async function listConversations(key: string, contactId: string): Promise<Record<string, unknown>[]> {
  // Try a filtered query first (param name unverified), fall back to full list.
  const attempts = ['/conversations?contactId=' + encodeURIComponent(contactId), '/conversations'];
  let last: RioResponse | null = null;
  for (const path of attempts) {
    const r = await rio(path, key);
    if (r.status >= 200 && r.status < 300) {
      const list = asList(r.data);
      // If the API honored the filter, use as-is; otherwise match locally.
      const matched = list.filter((c) => convMatchesContact(c, contactId));
      return matched.length ? matched : list;
    }
    last = r;
  }
  throw rioError('list-conversations', last as RioResponse);
}

function pickConversation(list: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!list.length) return null;
  const sorted = list.slice().sort((a, b) => {
    const ta = new Date(String(a.updatedAt || a.createdAt || 0)).getTime();
    const tb = new Date(String(b.updatedAt || b.createdAt || 0)).getTime();
    return tb - ta;
  });
  const open = sorted.find((c) => {
    const st = String(c.status || c.state || 'open').toLowerCase();
    return st === 'open' || st === 'active';
  });
  return open || sorted[0];
}

function toResult(e: RioError): ExecutionResult {
  return { ok: false, code: e.code, message: e.publicMessage, data: e.detail };
}

export const whatsappPlatform: Platform = {
  id: 'whatsapp',
  name: 'WhatsApp',
  icon: 'whatsapp',
  brandColor: '#25D366',
  connectionType: 'api_key',
  capabilities: [Capability.READ_MESSAGES, Capability.GENERATE_REPLY, Capability.SEND_MESSAGE, Capability.INSERT_TEXT],
  authMethod: 'respond.io API key (server env RESPONDIO_API_KEY)',
  supportedActions: ['send', 'readContext'],
  contextExtraction: 'respond.io conversations API — latest open conversation per contact',
  executionMethod: 'respond.io API v2',
  permissionRequirements: ['SEND_MESSAGE requires explicit grant'],
  rateLimits: 'respond.io plan limits apply',
  approvalRequired: true,
  adapterVersion: '1.0.0',
  status: 'beta',
};

export class WhatsAppAdapter extends PlatformAdapterBase {
  readonly platformId = 'whatsapp';

  getCapabilities(): Capability[] {
    return [Capability.READ_MESSAGES, Capability.GENERATE_REPLY, Capability.SEND_MESSAGE, Capability.INSERT_TEXT];
  }

  /** Verifies the API key and that respond.io answers. NOTE: whether a
   *  WhatsApp channel is actually connected still needs the first live test
   *  (no live key yet) — channel_not_connected is surfaced from send/read. */
  async connect(): Promise<ExecutionResult> {
    let key: string;
    try {
      key = getKey();
    } catch (e) {
      return toResult(e as RioError);
    }
    try {
      const r = await rio('/conversations', key);
      if (r.status < 200 || r.status >= 300) throw rioError('verify-key', r);
      return { ok: true, data: { provider: 'respond.io', api: 'v2' } };
    } catch (e) {
      return toResult(e as RioError);
    }
  }

  async disconnect(): Promise<ExecutionResult> {
    return { ok: true, message: 'API-key connections hold no session — nothing to disconnect.' };
  }

  async send(input: { to: string; text: string; name?: string }): Promise<ExecutionResult> {
    let key: string;
    try {
      key = getKey();
    } catch (e) {
      return toResult(e as RioError);
    }
    const phone = normalizePhone(input.to);
    if (!phone) {
      return { ok: false, code: 'invalid_recipient', message: '"to" must be a phone number (7–15 digits).' };
    }
    const text = (input.text || '').trim();
    if (!text) return { ok: false, code: 'empty_message', message: '"message" must be a non-empty string.' };
    if (text.length > 4000) return { ok: false, code: 'message_too_long', message: '"message" exceeds 4000 characters.' };

    try {
      const channelId = process.env.RESPONDIO_WHATSAPP_CHANNEL_ID || undefined;
      const phoneNumber = '+' + phone;

      // 1. Resolve the contact (create, or resolve existing by phone on duplicate).
      let contactId: string | null = null;
      const created = await rio('/contacts', key, {
        method: 'POST',
        body: { ...(channelId ? { channelId } : {}), ...(input.name ? { name: input.name } : {}), phoneNumber },
      });
      if (created.status >= 200 && created.status < 300) {
        const d = created.data as Record<string, unknown>;
        contactId = (d && (d.id || d.contactId) ? String(d.id || d.contactId) : null) as string | null;
      } else {
        const dup = JSON.stringify(created.data || '').toLowerCase();
        if (/already exists|duplicate|conflict/.test(dup) || created.status === 409) {
          contactId = await resolveContactByPhone(key, phone);
          if (!contactId) {
            return {
              ok: false,
              code: 'contact_not_resolved',
              message:
                'This number is already a respond.io contact but its id could not be resolved. ' +
                'Find the contact id in respond.io → Contacts and retry with that id.',
            };
          }
        } else {
          throw rioError('create-contact', created);
        }
      }
      if (!contactId) {
        return { ok: false, code: 'provider_error', message: 'respond.io did not return a contact id.' };
      }

      // 2. Send the message — ok:true ONLY when respond.io confirms.
      const sent = await rio('/messages', key, {
        method: 'POST',
        body: { ...(channelId ? { channelId } : {}), contactId, message: { text } },
      });
      if (sent.status < 200 || sent.status >= 300) throw rioError('send-message', sent);
      const sd = sent.data as Record<string, unknown>;
      return {
        ok: true,
        data: {
          messageId: (sd && (sd.id || sd.messageId) ? String(sd.id || sd.messageId) : null) as string | null,
          contactId,
          to: phone,
        },
      };
    } catch (e) {
      return toResult(e as RioError);
    }
  }

  /** Polls respond.io for messages from one contact (newest conversation first). */
  async readContext(input?: { phone?: string; contactId?: string; since?: number; limit?: number }): Promise<ExecutionResult> {
    let key: string;
    try {
      key = getKey();
    } catch (e) {
      return toResult(e as RioError);
    }
    try {
      let contactId = input?.contactId || null;
      if (!contactId) {
        const phone = normalizePhone(input?.phone);
        if (!phone) {
          return { ok: false, code: 'missing_recipient', message: 'Provide { contactId } or { phone }.' };
        }
        contactId = await resolveContactByPhone(key, phone);
        if (!contactId) {
          return {
            ok: false,
            code: 'contact_not_found',
            message: 'No respond.io contact found for this number. Send them a first message first.',
          };
        }
      }
      const convs = await listConversations(key, contactId);
      const conv = pickConversation(convs);
      if (!conv) {
        return { ok: true, data: { contactId, conversationId: null, checkedAt: Date.now(), messages: [] } };
      }
      const convId = conv.id || conv.conversationId || conv._id;
      if (!convId) {
        return { ok: false, code: 'provider_error', message: 'respond.io returned a conversation without an id.', data: conv };
      }
      const mr = await rio('/conversations/' + encodeURIComponent(String(convId)) + '/messages', key);
      if (mr.status < 200 || mr.status >= 300) throw rioError('list-messages', mr);
      const since = typeof input?.since === 'number' && Number.isFinite(input.since) ? input.since : 0;
      const limit = Math.min(50, Math.max(1, input?.limit || 20));
      const messages = asList(mr.data)
        .map(normMessage)
        .filter((m): m is NormalizedMessage => m !== null)
        .filter((m) => m.at >= since)
        .sort((a, b) => a.at - b.at)
        .slice(-limit);
      return {
        ok: true,
        data: { contactId: String(contactId), conversationId: String(convId), checkedAt: Date.now(), messages },
      };
    } catch (e) {
      return toResult(e as RioError);
    }
  }

  async getCurrentContext(): Promise<ExecutionResult> {
    return {
      ok: false,
      code: 'needs_recipient',
      message: 'WhatsApp context needs a recipient — call readContext({ phone }) to load a conversation.',
    };
  }

  /** INSERT_TEXT on WhatsApp is assisted: TYPE X prepares the text, the human
   *  (or keyboard companion in Phase 2) pastes/sends it. */
  async insertText(_text: string): Promise<ExecutionResult> {
    return {
      ok: false,
      code: 'assisted',
      message: 'INSERT_TEXT on WhatsApp is assisted — copy the prepared text into the WhatsApp client.',
    };
  }
}
