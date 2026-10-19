'use client';

import { useCallback } from 'react';

export async function api(path: string, opts?: { method?: string; body?: unknown }) {
  const res = await fetch(path, {
    method: opts?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && (data as { ok?: boolean }).ok === false && res.status >= 400)) {
    const e = new Error(
      (data as { message?: string }).message || `Request failed (${res.status})`,
    ) as Error & { code?: string };
    e.code = (data as { code?: string }).code;
    throw e;
  }
  return data;
}

export function useApi() {
  return useCallback(api, []);
}

export function fmtTime(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso?: string | Date | null): string {
  if (!iso) return '—';
  const d = +new Date(iso);
  if (!Number.isFinite(d)) return '—';
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'abhi';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} din ago`;
}
