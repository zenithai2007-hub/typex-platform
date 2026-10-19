'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Approval { id: string; agentId: string; action: string; preview: string; status: string; createdAt: string; payload?: Record<string, unknown> }
interface Agent { id: string; name: string }

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  async function load() {
    setError('');
    try {
      const d = await api('/api/approvals?pending=1');
      setApprovals(d.approvals ?? []);
      const a = await api('/api/agents');
      setAgents(a.agents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function decide(id: string, decision: 'approved' | 'rejected' | 'cancelled', editedPreview?: string) {
    setBusy(id);
    setError('');
    try {
      if (editedPreview !== undefined) {
        // Edit = cancel this one, create a fresh approval with the edited text
        // (recipient and other payload fields preserved).
        const orig = approvals?.find((x) => x.id === id);
        if (orig) {
          await api(`/api/approvals/${id}/decision`, { method: 'POST', body: { decision: 'cancelled' } });
          const base = (orig.payload ?? {}) as Record<string, unknown>;
          const inner = (base.payload ?? {}) as Record<string, unknown>;
          await api('/api/approvals', {
            method: 'POST',
            body: {
              agentId: orig.agentId,
              action: orig.action,
              preview: editedPreview,
              payload: { ...base, payload: { ...inner, text: editedPreview } },
            },
          });
          setEditing(null);
          await load();
          return;
        }
      }
      const d = await api(`/api/approvals/${id}/decision`, { method: 'POST', body: { decision } });
      const res = d.result ?? {};
      if (!res.ok) {
        setError(res.message ?? 'Decision failed.');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);

  return (
    <div>
      <PageHead
        title="Approvals"
        sub="CLINT X ne ye action tayyar kiya. Aapki ijazat ke baghair kuch send nahi hoga."
        action={<button className="tx-btn btn-ghost text-xs" onClick={load}><Icon d={paths.refresh} className="w-4 h-4" /> Refresh</button>}
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {approvals === null ? (
        <Spinner label="Approvals load ho rahe hain…" />
      ) : approvals.length === 0 ? (
        <Empty title="Koi pending approval nahi" hint="Sab clear hai." />
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => (
            <div key={a.id} className="glass p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold">CLINT X prepared this action.</div>
                  <div className="text-xs text-white/50 mt-1 font-mono">
                    {a.action} · agent: {agentName(a.agentId)} · {fmtTime(a.createdAt)}
                  </div>
                </div>
                <Pill status={a.status} live />
              </div>

              {editing === a.id ? (
                <div className="mt-4">
                  <textarea className="tx-input" rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex gap-2 mt-2">
                    <button className="tx-btn btn-primary text-xs" disabled={busy === a.id} onClick={() => decide(a.id, 'approved', editText)}>
                      Save as new approval
                    </button>
                    <button className="tx-btn btn-ghost text-xs" onClick={() => setEditing(null)}>Radd</button>
                  </div>
                </div>
              ) : (
                <div className="glass-soft p-4 mt-4 text-sm whitespace-pre-wrap">{a.preview}</div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  className="tx-btn btn-action text-xs"
                  disabled={busy === a.id || editing === a.id}
                  onClick={() => decide(a.id, 'approved')}
                >
                  <Icon d={paths.check} className="w-4 h-4" />
                  {busy === a.id ? 'Chal raha…' : 'Approve'}
                </button>
                <button
                  className="tx-btn btn-ghost text-xs"
                  disabled={busy === a.id}
                  onClick={() => { setEditText(a.preview); setEditing(a.id); }}
                >
                  <Icon d={paths.edit} className="w-4 h-4" /> Edit
                </button>
                <button
                  className="tx-btn btn-ghost text-xs"
                  disabled={busy === a.id || editing === a.id}
                  onClick={() => decide(a.id, 'cancelled')}
                >
                  <Icon d={paths.x} className="w-4 h-4" /> Cancel
                </button>
              </div>
              <p className="text-xs text-white/40 mt-3">
                Approve par hi action chalega — adapter ki confirmation ke baghair "success" kabhi nahi dikhega.
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
