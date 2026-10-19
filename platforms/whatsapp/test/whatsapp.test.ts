/* WhatsApp adapter tests — fetch is mocked; the adapter logic is real. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhatsAppAdapter, normalizePhone, normMessage, getKey } from '@typex/whatsapp';
import { Capability } from '@typex/types';

type FetchMock = (url: string, init?: RequestInit) => Promise<Response>;

function jsonResponse(status: number, data: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

const realFetch = globalThis.fetch;

beforeEach(() => {
  process.env.RESPONDIO_API_KEY = 'test-key';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.RESPONDIO_API_KEY;
  vi.restoreAllMocks();
});

function mockFetch(routes: { match: (url: string, init?: RequestInit) => boolean; status: number; data: unknown }[]) {
  const fn: FetchMock = async (url, init) => {
    const r = routes.find((x) => x.match(url, init));
    if (!r) throw new Error('unexpected fetch: ' + url);
    return jsonResponse(r.status, r.data);
  };
  globalThis.fetch = fn as typeof fetch;
}

describe('WhatsAppAdapter capabilities', () => {
  it('declares SEND_MESSAGE (and reply/read capabilities)', () => {
    const a = new WhatsAppAdapter();
    expect(a.platformId).toBe('whatsapp');
    expect(a.getCapabilities()).toContain(Capability.SEND_MESSAGE);
    expect(a.getCapabilities()).toContain(Capability.READ_MESSAGES);
    expect(a.getCapabilities()).toContain(Capability.GENERATE_REPLY);
  });
});

describe('honest failures without a key', () => {
  it('send without RESPONDIO_API_KEY → not_configured (never claims success)', async () => {
    delete process.env.RESPONDIO_API_KEY;
    const a = new WhatsAppAdapter();
    const res = await a.send({ to: '923001234567', text: 'hi' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('not_configured');
  });

  it('getKey throws a clear error when unset', () => {
    delete process.env.RESPONDIO_API_KEY;
    expect(() => getKey()).toThrow(/RESPONDIO_API_KEY/);
  });
});

describe('connect()', () => {
  it('verifies the key against the API', async () => {
    mockFetch([{ match: (u) => u.endsWith('/v2/conversations'), status: 200, data: [] }]);
    const res = await new WhatsAppAdapter().connect();
    expect(res.ok).toBe(true);
    expect((res.data as { provider: string }).provider).toBe('respond.io');
  });

  it('maps 401 → provider_auth_failed', async () => {
    mockFetch([{ match: () => true, status: 401, data: { message: 'Unauthorized' } }]);
    const res = await new WhatsAppAdapter().connect();
    expect(res.ok).toBe(false);
    expect(res.code).toBe('provider_auth_failed');
  });
});

describe('send()', () => {
  it('creates the contact then sends; ok only on provider confirmation', async () => {
    const calls: string[] = [];
    mockFetch([
      { match: (u, i) => u.endsWith('/v2/contacts') && i?.method === 'POST', status: 200, data: { id: 'c1' } },
      {
        match: (u, i) => {
          if (u.endsWith('/v2/messages') && i?.method === 'POST') {
            calls.push(String(u));
            return true;
          }
          return false;
        },
        status: 200,
        data: { id: 'm1' },
      },
    ]);
    const res = await new WhatsAppAdapter().send({ to: '+92 300 1234567', text: 'Hello!' });
    expect(res.ok).toBe(true);
    expect((res.data as { messageId: string }).messageId).toBe('m1');
    expect((res.data as { contactId: string }).contactId).toBe('c1');
    expect(calls.length).toBe(1);
  });

  it('resolves an existing contact on 409 duplicate', async () => {
    mockFetch([
      { match: (u, i) => u.endsWith('/v2/contacts') && i?.method === 'POST', status: 409, data: { error: 'already exists' } },
      {
        match: (u, i) => u.endsWith('/v2/contacts') && (!i?.method || i.method === 'GET'),
        status: 200,
        data: [{ id: 'c9', phoneNumber: '+923001234567' }],
      },
      { match: (u, i) => u.endsWith('/v2/messages') && i?.method === 'POST', status: 200, data: { id: 'm2' } },
    ]);
    const res = await new WhatsAppAdapter().send({ to: '923001234567', text: 'Hello again' });
    expect(res.ok).toBe(true);
    expect((res.data as { contactId: string }).contactId).toBe('c9');
  });

  it('surfaces channel_not_connected honestly', async () => {
    mockFetch([
      { match: (u, i) => u.endsWith('/v2/contacts') && i?.method === 'POST', status: 200, data: { id: 'c1' } },
      { match: (u, i) => u.endsWith('/v2/messages') && i?.method === 'POST', status: 400, data: { message: 'Channel is not connected' } },
    ]);
    const res = await new WhatsAppAdapter().send({ to: '923001234567', text: 'hi' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('channel_not_connected');
  });

  it('rejects invalid recipients and empty messages locally', async () => {
    const a = new WhatsAppAdapter();
    expect((await a.send({ to: 'abc', text: 'hi' })).code).toBe('invalid_recipient');
    expect((await a.send({ to: '923001234567', text: '   ' })).code).toBe('empty_message');
  });
});

describe('readContext()', () => {
  it('resolves phone → contact → conversation → normalized messages', async () => {
    mockFetch([
      {
        match: (u, i) => u.endsWith('/v2/contacts') && (!i?.method || i.method === 'GET'),
        status: 200,
        data: [{ id: 'c1', phoneNumber: '923001234567' }],
      },
      {
        match: (u) => u.includes('/v2/conversations?contactId='),
        status: 200,
        data: [{ id: 'conv1', contactId: 'c1', status: 'open', updatedAt: '2026-10-19T10:00:00Z' }],
      },
      {
        match: (u) => u.includes('/v2/conversations/conv1/messages'),
        status: 200,
        data: [
          { id: 'x1', message: { text: 'hello there' }, direction: 'inbound', createdAt: '2026-10-19T10:01:00Z' },
          { id: 'x2', message: { text: 'hi!' }, direction: 'outbound', createdAt: '2026-10-19T10:02:00Z' },
        ],
      },
    ]);
    const res = await new WhatsAppAdapter().readContext({ phone: '923001234567' });
    expect(res.ok).toBe(true);
    const data = res.data as { contactId: string; conversationId: string; messages: { dir: string; text: string }[] };
    expect(data.contactId).toBe('c1');
    expect(data.conversationId).toBe('conv1');
    expect(data.messages.length).toBe(2);
    expect(data.messages[0]).toMatchObject({ dir: 'in', text: 'hello there' });
    expect(data.messages[1]).toMatchObject({ dir: 'out', text: 'hi!' });
  });

  it('contact_not_found when the number is unknown', async () => {
    mockFetch([
      { match: (u) => u.endsWith('/v2/contacts'), status: 200, data: [] },
    ]);
    const res = await new WhatsAppAdapter().readContext({ phone: '923009999999' });
    expect(res.ok).toBe(false);
    expect(res.code).toBe('contact_not_found');
  });
});

describe('helpers', () => {
  it('normalizePhone strips formatting, rejects junk', () => {
    expect(normalizePhone('+92 300 1234567')).toBe('923001234567');
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('123')).toBeNull();
  });

  it('normMessage normalizes defensively and drops empty texts', () => {
    expect(normMessage({ message: { text: ' hi ' }, fromContact: true, createdAt: '2026-10-19T10:00:00Z' })).toMatchObject({
      dir: 'in',
      text: 'hi',
    });
    expect(normMessage({ text: '' })).toBeNull();
    expect(normMessage(null)).toBeNull();
  });
});
