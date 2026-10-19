'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Conn { id: string; platformId: string; status: string; credentialsRef?: string; createdAt: string }

export default function ConnectionsPage() {
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [lastResult, setLastResult] = useState<{ ok: boolean; message?: string } | null>(null);

  async function load() {
    setError('');
    try {
      const d = await api('/api/connections');
      setConns(d.connections ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  function latest(platformId: string): Conn | undefined {
    return (conns ?? []).filter((c) => c.platformId === platformId).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
  }

  async function connect(platformId: string) {
    setBusy(platformId);
    setLastResult(null);
    try {
      const d = await api('/api/connections', { method: 'POST', body: { platformId } });
      setLastResult({ ok: true, message: 'Connected — verification kamyab.' });
      await load();
    } catch (e) {
      setLastResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
      await load();
    } finally {
      setBusy('');
    }
  }

  async function disconnect(c: Conn) {
    setBusy(c.platformId);
    try {
      await api(`/api/connections?id=${c.id}`, { method: 'DELETE' });
      setLastResult({ ok: true, message: 'Disconnected.' });
      await load();
    } catch (e) {
      setLastResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy('');
    }
  }

  if (conns === null && !error) return <Spinner label="Connections load ho rahe hain…" />;

  const wa = latest('whatsapp');
  const gw = latest('generic-web');

  return (
    <div>
      <PageHead title="Connections" sub="Real verification — kabhi fake 'connected' nahi." />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}
      {lastResult && (
        <div className={`glass-soft p-3 mb-4 text-sm ${lastResult.ok ? 'text-emerald-300' : 'text-red-300'}`}>
          {lastResult.message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* WhatsApp */}
        <div className="glass p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#25D36622', color: '#25D366' }}>
                <Icon d={paths.chat} className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-lg">WhatsApp</div>
                <div className="text-xs text-white/50">respond.io API v2 — API key server env mein</div>
              </div>
            </div>
            {wa ? <Pill status={wa.status} /> : <Pill status="NEEDS_SETUP" />}
          </div>
          <p className="text-sm text-white/55 mt-4">
            Connect dabane par CLINT X respond.io se <span className="text-white/80 font-semibold">wakae verify</span> karega.
            {wa?.credentialsRef && <span className="block mt-1 font-mono text-xs text-white/40">credentials: {wa.credentialsRef} (key kabhi store nahi hoti)</span>}
          </p>
          <div className="flex gap-2 mt-4">
            <button className="tx-btn btn-action text-xs" disabled={busy === 'whatsapp'} onClick={() => connect('whatsapp')}>
              <Icon d={paths.connections} className="w-4 h-4" />
              {busy === 'whatsapp' ? 'Verifying…' : wa?.status === 'CONNECTED' ? 'Reconnect' : 'Connect'}
            </button>
            {wa && wa.status !== 'DISCONNECTED' && (
              <button className="tx-btn btn-ghost text-xs" disabled={busy === 'whatsapp'} onClick={() => disconnect(wa)}>
                Disconnect
              </button>
            )}
          </div>
          {wa && <div className="text-xs text-white/35 mt-3">Last check: {fmtTime(wa.createdAt)}</div>}
        </div>

        {/* Generic Web */}
        <div className="glass p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#6E56CF22', color: '#A855F7' }}>
                <Icon d={paths.globe} className="w-6 h-6" />
              </div>
              <div>
                <div className="font-bold text-lg">Generic Website</div>
                <div className="text-xs text-white/50">Kisi bhi website ke liye</div>
              </div>
            </div>
            <span className="chip">Phase 2</span>
          </div>
          <p className="text-sm text-white/55 mt-4">
            Browser extension — Phase 2. Abhi <span className="text-white/80 font-semibold">Assisted Mode</span>:
            CLINT X text tayyar karega, aap khud page mein paste karenge.
          </p>
          <div className="flex gap-2 mt-4">
            <button className="tx-btn btn-ghost text-xs" disabled>Extension (Phase 2)</button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="glass p-5 mt-4">
        <h3 className="font-bold mb-3">Connection history</h3>
        {!conns || conns.length === 0 ? (
          <Empty title="Koi connection record nahi" hint="Upar Connect dabayein." />
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {conns.slice().reverse().map((c) => (
              <div key={c.id} className="glass-soft px-3 py-2 flex items-center justify-between text-xs">
                <span className="font-mono text-white/70">{c.platformId}</span>
                <span className="flex items-center gap-2">
                  <Pill status={c.status} />
                  <span className="text-white/35">{fmtTime(c.createdAt)}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
