'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, timeAgo } from '@/lib/client';
import { useTx } from './tx-store';
import { Icon, paths } from './icons';
import { Btn, StatusDot, OutcomeChip, Spinner, TextArea } from './ui';

interface AuditEvent {
  id: string;
  agentId: string;
  action: string;
  outcome: string;
  createdAt: string;
  detail?: Record<string, unknown>;
}
interface Approval {
  id: string;
  agentId: string;
  action: string;
  preview: string;
  payload?: Record<string, unknown>;
  status: string;
  createdAt: string;
}
interface Conn {
  id: string;
  platformId: string;
  status: string;
}

const TABS = [
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'approvals', label: 'Approvals', icon: 'approvals' },
  { id: 'connections', label: 'Connections', icon: 'connections' },
] as const;

export default function RightPanel({ onNavigate }: { onNavigate?: () => void }) {
  const { rightTab, setRightTab, tick, bump, agents, setRightOpen } = useTx();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, p, c] = await Promise.all([
        api('/api/activity?limit=30'),
        api('/api/approvals?pending=1'),
        api('/api/connections'),
      ]);
      setEvents(a.events ?? []);
      setApprovals(p.approvals ?? []);
      setConns(c.connections ?? []);
    } catch {
      /* keep stale */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load, tick]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Agent';

  async function decide(id: string, decision: 'approved' | 'rejected' | 'cancelled', editedPreview?: string) {
    setDeciding(id);
    try {
      if (editedPreview !== undefined) {
        // No in-place edit endpoint: create a corrected approval, cancel the old one.
        const old = approvals.find((x) => x.id === id);
        if (old) {
          await api('/api/approvals', {
            method: 'POST',
            body: { agentId: old.agentId, action: old.action, preview: editedPreview, payload: old.payload ?? {} },
          });
          await api(`/api/approvals/${id}/decision`, { method: 'POST', body: { decision: 'cancelled' } });
        }
      } else {
        const r = await api(`/api/approvals/${id}/decision`, { method: 'POST', body: { decision } });
        if (decision === 'approved' && r?.result && r.result.ok === false) {
          alert(`Execution failed: ${r.result.message ?? r.result.code ?? 'unknown error'}`);
        }
      }
      setEditId(null);
      await load();
      bump();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDeciding(null);
    }
  }

  const pending = approvals.filter((a) => a.status === 'PENDING');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-3 pt-3 pb-2 border-b border-slate-200 dark:border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setRightTab(t.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition ${
              rightTab === t.id
                ? 'bg-purple-50 text-txpurple dark:bg-txpurple/15 dark:text-violet-300'
                : 'muted hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Icon d={paths[t.icon]} className="w-3.5 h-3.5" />
            {t.label}
            {t.id === 'approvals' && pending.length > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-txorange text-white text-[10px] font-bold flex items-center justify-center">
                {pending.length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setRightOpen(false)}
          className="ml-auto p-1.5 rounded-lg muted hover:bg-slate-100 dark:hover:bg-white/10"
          aria-label="Close panel"
        >
          <Icon d={paths.chevronRight} className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 muted"><Spinner /></div>
        ) : rightTab === 'activity' ? (
          events.length === 0 ? (
            <Empty label="No activity yet." hint="Agent events, generations and executions will stream here live." />
          ) : (
            <ol className="relative space-y-3 before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-white/10">
              {events.map((e) => (
                <li key={e.id} className="relative pl-5">
                  <span className="absolute left-0 top-1.5 dot" style={{ background: outcomeColor(e.outcome) }} />
                  <div className="text-[12.5px] leading-snug">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{agentName(e.agentId)}</span>{' '}
                    <span className="muted">{prettyAction(e.action)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <OutcomeChip outcome={e.outcome} />
                    <span className="text-[11px] muted">{timeAgo(e.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ol>
          )
        ) : rightTab === 'approvals' ? (
          pending.length === 0 ? (
            <Empty label="No pending approvals." hint="When an agent prepares an external action, it will wait for you here." />
          ) : (
            pending.map((a) => (
              <div key={a.id} className="card card-pad !p-3 border-orange-200 dark:border-orange-500/30">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400 mb-1.5">
                  <Icon d={paths.shield} className="w-3.5 h-3.5" />
                  Approval request
                </div>
                <div className="text-[12px] muted mb-1">
                  {agentName(a.agentId)} · <span className="font-mono">{a.action}</span>
                </div>
                {editId === a.id ? (
                  <div className="space-y-2">
                    <TextArea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                    <div className="flex gap-1.5">
                      <Btn size="xs" variant="action" disabled={deciding === a.id || !editText.trim()} onClick={() => decide(a.id, 'approved', editText.trim())}>
                        {deciding === a.id ? <Spinner className="w-3 h-3" /> : 'Save & approve'}
                      </Btn>
                      <Btn size="xs" onClick={() => setEditId(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-2 mb-2 whitespace-pre-wrap">
                      {a.preview}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Btn size="xs" variant="action" icon="check" disabled={deciding === a.id} onClick={() => decide(a.id, 'approved')}>
                        {deciding === a.id ? <Spinner className="w-3 h-3" /> : 'Approve'}
                      </Btn>
                      <Btn size="xs" icon="edit" onClick={() => { setEditId(a.id); setEditText(a.preview); }}>Edit</Btn>
                      <Btn size="xs" variant="danger" disabled={deciding === a.id} onClick={() => decide(a.id, 'cancelled')}>Cancel</Btn>
                    </div>
                  </>
                )}
              </div>
            ))
          )
        ) : (
          <div className="space-y-2">
            {conns.length === 0 && (
              <Empty label="No connections yet." hint="Connect a platform to let agents act through it." />
            )}
            {conns.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 card card-pad !py-2.5">
                <StatusDot status={c.status} live />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold capitalize">{c.platformId}</div>
                  <div className="text-[11px] muted">{c.status.replace(/_/g, ' ')}</div>
                </div>
                <Link href="/connections" onClick={onNavigate} className="text-[12px] font-semibold text-txpurple hover:underline">
                  Manage
                </Link>
              </div>
            ))}
            <Link href="/connections" onClick={onNavigate}>
              <span className="tx-btn btn-ghost btn-sm w-full mt-1">Open Connections</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-[13px] font-semibold">{label}</div>
      <div className="text-[12px] muted mt-1">{hint}</div>
    </div>
  );
}

function outcomeColor(o: string): string {
  const m: Record<string, string> = {
    EXECUTED: '#16a34a',
    APPROVED: '#16a34a',
    PREPARED: '#7c3aed',
    FAILED: '#dc2626',
    DENIED: '#dc2626',
    CANCELLED: '#9ca3af',
  };
  return m[o] ?? '#7c3aed';
}

function prettyAction(a: string): string {
  return a.replace(/\./g, ' ').replace(/_/g, ' ');
}
