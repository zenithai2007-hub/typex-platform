'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Evt { id: string; agentId: string; taskId?: string; action: string; outcome: string; createdAt: string; detail?: Record<string, unknown> }
interface Agent { id: string; name: string }

const OUTCOMES = ['ALL', 'PREPARED', 'APPROVED', 'EXECUTED', 'FAILED', 'CANCELLED', 'DENIED'];

function detailText(detail: Record<string, unknown>): string {
  const v = detail.message ?? detail.code ?? '';
  return typeof v === 'string' ? v : JSON.stringify(v);
}

export default function ActivityPage() {
  const [events, setEvents] = useState<Evt[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  const [agentId, setAgentId] = useState('');
  const [outcome, setOutcome] = useState('ALL');

  async function load() {
    setError('');
    try {
      const a = await api('/api/agents');
      setAgents(a.agents ?? []);
      const q = new URLSearchParams();
      if (agentId) q.set('agentId', agentId);
      if (outcome !== 'ALL') q.set('outcome', outcome);
      const d = await api(`/api/activity?${q.toString()}`);
      setEvents(d.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { load(); }, [agentId, outcome]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);

  return (
    <div>
      <PageHead
        title="Activity"
        sub="Audit timeline — har stage likha jata hai: PREPARED, APPROVED, EXECUTED, FAILED, CANCELLED, DENIED."
        action={
          <div className="flex gap-2">
            <select className="tx-input !w-auto text-xs" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Sab agents</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <select className="tx-input !w-auto text-xs" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {OUTCOMES.map((o) => <option key={o} value={o}>{o === 'ALL' ? 'Sab outcomes' : o}</option>)}
            </select>
            <button className="tx-btn btn-ghost text-xs" onClick={load}>
              <Icon d={paths.refresh} className="w-4 h-4" />
            </button>
          </div>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {events === null ? (
        <Spinner label="Audit load ho raha hai…" />
      ) : events.length === 0 ? (
        <Empty title="Koi audit event nahi" hint="Filter badal kar dekhein." />
      ) : (
        <div className="relative">
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-txviolet/25" />
          <div className="space-y-2">
            {events.map((e) => (
              <div key={e.id} className="relative pl-8">
                <span className="absolute left-[5px] top-3 w-2.5 h-2.5 rounded-full bg-txviolet border border-txbg" />
                <div className="glass-soft p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-[200px]">
                    <span className="font-mono text-white/80">{e.action}</span>
                    <span className="text-white/40 ml-2">{agentName(e.agentId)}</span>
                    {e.detail && Boolean(e.detail.code || e.detail.message) && (
                      <div className="text-white/45 mt-1 break-words">
                        {detailText(e.detail)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill status={e.outcome} />
                    <span className="text-white/35">{fmtTime(e.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
