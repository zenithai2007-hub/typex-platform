'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, StatusDot, EmptyState, Skeleton, ErrorBox, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Platform {
  id: string; name: string; brandColor: string; connectionType: string;
  authMethod: string; approvalRequired: boolean; status: string;
  adapterRegistered: boolean; adapterCapabilities: string[];
}
interface Conn { id: string; platformId: string; status: string; createdAt: string }

const MATRIX_CAPS = ['READ_CONTEXT', 'READ_MESSAGES', 'GENERATE_REPLY', 'GENERATE_TEXT', 'INSERT_TEXT', 'SEND_MESSAGE', 'FILL_FORM', 'SEARCH', 'UPLOAD', 'POST', 'SCHEDULE', 'MEDIA_SUPPORT'];

export default function ConnectionsPage() {
  const { bump } = useTx();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api('/api/platforms'), api('/api/connections')]);
      setPlatforms(p.platforms ?? []);
      setConns((c.connections ?? []).sort((a: Conn, b: Conn) => +new Date(b.createdAt) - +new Date(a.createdAt)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const latestFor = (pid: string) => conns.find((c) => c.platformId === pid);

  async function connect(pid: string) {
    setBusy(pid);
    setError('');
    try {
      const d = await api('/api/connections', { method: 'POST', body: { platformId: pid } });
      if (d?.result && d.result.ok === false) {
        setError(`Connect failed: ${d.result.message ?? d.result.code ?? 'adapter ne verify nahi kiya.'}`);
      } else {
        setNotice(`${pid} connected — adapter ne verify kiya.`);
      }
      await load();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(c: Conn) {
    setBusy(c.id);
    try {
      await api(`/api/connections?id=${c.id}`, { method: 'DELETE' });
      setNotice(`${c.platformId} disconnected.`);
      await load();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHead title="Connections" sub="Real connection statuses only — adapter verification ke baghair kabhi 'Connected' nahi dikhega." />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {platforms.map((p) => {
            const conn = latestFor(p.id);
            const connected = conn?.status === 'CONNECTED';
            return (
              <div key={p.id} className="card card-pad">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px]" style={{ background: p.brandColor }}>
                      {p.name.slice(0, 1)}
                    </span>
                    <div>
                      <div className="font-semibold text-[14px]">{p.name}</div>
                      <div className="text-[11px] muted">{p.authMethod} · {p.connectionType}</div>
                    </div>
                  </div>
                  <span className="chip">
                    <StatusDot status={conn?.status ?? 'DISCONNECTED'} live={connected} />
                    {conn ? conn.status.replace(/_/g, ' ') : 'Not connected'}
                  </span>
                </div>

                {conn && (
                  <div className="text-[11px] muted mb-2">Last check: {fmtTime(conn.createdAt)}</div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.adapterCapabilities.slice(0, 6).map((c) => (
                    <span key={c} className="chip chip-purple !text-[10px]">{c.replace(/_/g, ' ')}</span>
                  ))}
                  {p.approvalRequired && <span className="chip chip-orange !text-[10px]">Approval required</span>}
                </div>

                <div className="flex gap-1.5">
                  {connected ? (
                    <Btn size="sm" variant="danger" icon="x" disabled={busy === conn.id} onClick={() => disconnect(conn!)}>
                      Disconnect
                    </Btn>
                  ) : (
                    <Btn size="sm" variant="primary" icon="link" disabled={busy === p.id || !p.adapterRegistered} onClick={() => connect(p.id)}>
                      {busy === p.id ? 'Verifying…' : p.adapterRegistered ? 'Connect' : 'No adapter'}
                    </Btn>
                  )}
                  {!p.adapterRegistered && (
                    <span className="text-[11px] muted self-center">Adapter Phase 2 mein</span>
                  )}
                </div>
                {p.id === 'whatsapp' && !connected && (
                  <div className="text-[11.5px] muted mt-2 leading-snug">
                    WhatsApp connect ke liye respond.io mein channel verified hona chahiye aur <span className="font-mono">RESPONDIO_API_KEY</span> set honi chahiye.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* capability matrix */}
      <h2 className="text-[15px] font-bold mt-8 mb-3">Capability matrix</h2>
      <div className="card overflow-x-auto">
        <table className="w-full text-[12px] min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10">
              <th className="text-left font-semibold p-3">Platform</th>
              {MATRIX_CAPS.map((c) => (
                <th key={c} className="font-semibold p-2 text-center text-[10.5px] muted whitespace-nowrap">{c.replace(/_/g, ' ')}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                <td className="p-3 font-semibold capitalize">{p.name}</td>
                {MATRIX_CAPS.map((c) => (
                  <td key={c} className="p-2 text-center">
                    {p.adapterCapabilities.includes(c) ? (
                      <Icon d={paths.check} className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : (
                      <span className="text-slate-300 dark:text-white/20" title="Not supported for this connection">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-3 py-2 text-[11px] muted border-t border-slate-200 dark:border-white/10">
          — = Not supported for this connection.
        </div>
      </div>
    </div>
  );
}
