'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { PageHead, Btn, OutcomeChip, EmptyState, Skeleton, ErrorBox, TextArea } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Approval {
  id: string; agentId: string; action: string; preview: string;
  payload?: Record<string, unknown>; status: string; createdAt: string; decidedAt?: string;
}

export default function ApprovalsPage() {
  const { agents, bump } = useTx();
  const [list, setList] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api('/api/approvals');
      const arr: Approval[] = (d.approvals ?? []).sort(
        (a: Approval, b: Approval) => +new Date(b.createdAt) - +new Date(a.createdAt),
      );
      setList(arr);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Agent';

  async function decide(a: Approval, decision: 'approved' | 'rejected' | 'cancelled', editedPreview?: string) {
    setDeciding(a.id);
    setError('');
    try {
      if (editedPreview !== undefined) {
        await api('/api/approvals', {
          method: 'POST',
          body: { agentId: a.agentId, action: a.action, preview: editedPreview, payload: a.payload ?? {} },
        });
        await api(`/api/approvals/${a.id}/decision`, { method: 'POST', body: { decision: 'cancelled' } });
      } else {
        const r = await api(`/api/approvals/${a.id}/decision`, { method: 'POST', body: { decision } });
        if (decision === 'approved' && r?.result && r.result.ok === false) {
          setError(`Execution failed: ${r.result.message ?? r.result.code ?? 'adapter ne confirm nahi kiya.'}`);
        }
      }
      setEditId(null);
      await load();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeciding(null);
    }
  }

  const shown = filter === 'pending' ? list.filter((a) => a.status === 'PENDING') : list;

  return (
    <div>
      <PageHead
        title="Approvals"
        sub="External action se pehle Clint X yahan rukta hai — aapki permission ke baghair kuch execute nahi hota."
        actions={
          <div className="flex gap-1.5">
            {(['pending', 'all'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`chip !py-1.5 !px-3 !text-[12px] cursor-pointer capitalize ${filter === f ? 'chip-orange' : ''}`}>
                {f}
              </button>
            ))}
          </div>
        }
      />
      <ErrorBox msg={error} onClose={() => setError('')} />

      {loading ? (
        <div className="space-y-2.5">{[0, 1].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon="shield"
          title={filter === 'pending' ? 'No pending approvals.' : 'No approvals yet.'}
          sub="Jab agent koi external action prepare karega, woh yahan aapki approval ka wait karega."
        />
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <div key={a.id} className={`card card-pad ${a.status === 'PENDING' ? 'border-orange-200 dark:border-orange-500/30' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <OutcomeChip outcome={a.status} />
                <span className="text-[12px] muted">{agentName(a.agentId)} · <span className="font-mono">{a.action}</span></span>
                <span className="text-[11px] muted ml-auto">{fmtTime(a.createdAt)}</span>
              </div>
              <div className="text-[12px] font-bold uppercase tracking-wide muted mb-1.5">Clint X prepared this action.</div>
              {editId === a.id ? (
                <div className="space-y-2">
                  <TextArea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex gap-1.5">
                    <Btn size="sm" variant="action" disabled={deciding === a.id || !editText.trim()} onClick={() => decide(a, 'approved', editText.trim())}>
                      Save & approve
                    </Btn>
                    <Btn size="sm" onClick={() => setEditId(null)}>Cancel</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[13.5px] bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3 whitespace-pre-wrap mb-3">
                    {a.preview}
                  </p>
                  {a.status === 'PENDING' && (
                    <div className="flex flex-wrap gap-1.5">
                      <Btn size="sm" variant="action" icon="check" disabled={deciding === a.id} onClick={() => decide(a, 'approved')}>
                        Approve
                      </Btn>
                      <Btn size="sm" icon="edit" onClick={() => { setEditId(a.id); setEditText(a.preview); }}>Edit</Btn>
                      <Btn size="sm" variant="danger" disabled={deciding === a.id} onClick={() => decide(a, 'cancelled')}>Cancel</Btn>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
