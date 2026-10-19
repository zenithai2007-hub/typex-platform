'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { PageHead, OutcomeChip, EmptyState, Skeleton, ErrorBox, TextInput, Select } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Ev {
  id: string; agentId: string; taskId?: string; action: string; outcome: string;
  createdAt: string; detail?: Record<string, unknown>;
}

const OUTCOMES = ['ALL', 'PREPARED', 'APPROVED', 'EXECUTED', 'FAILED', 'CANCELLED', 'DENIED'] as const;

export default function HistoryPage() {
  const { agents } = useTx();
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('ALL');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (outcome !== 'ALL') params.set('outcome', outcome);
      if (agentFilter !== 'ALL') params.set('agentId', agentFilter);
      const d = await api(`/api/activity?${params}`);
      setEvents(d.events ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [outcome, agentFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const shown = events.filter((e) =>
    q.trim() === '' ||
    e.action.toLowerCase().includes(q.toLowerCase()) ||
    agentName(e.agentId).toLowerCase().includes(q.toLowerCase()) ||
    JSON.stringify(e.detail ?? {}).toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHead title="History" sub="Har important action ka audit trail — PREPARED se EXECUTED tak." />
      <ErrorBox msg={error} onClose={() => setError('')} />

      <div className="card card-pad mb-4 flex flex-wrap gap-2.5 items-end">
        <div className="w-44">
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as (typeof OUTCOMES)[number])} aria-label="Outcome filter">
            {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
          </Select>
        </div>
        <div className="w-44">
          <Select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} aria-label="Agent filter">
            <option value="ALL">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <TextInput placeholder='Search — "Ahmed", "approved", "whatsapp"…' value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState icon="history" title="No activity yet." sub="Agents kaam karenge to har event yahan log hoga." />
      ) : (
        <div className="card card-pad">
          <ol className="space-y-1">
            {shown.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-white/5 last:border-0 text-[13px]">
                <OutcomeChip outcome={e.outcome} />
                <div className="flex-1 min-w-0">
                  <span className="font-semibold">{agentName(e.agentId)}</span>
                  <span className="muted"> — {e.action.replace(/\./g, ' ')}</span>
                </div>
                <span className="text-[11px] muted shrink-0">{fmtTime(e.createdAt)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
