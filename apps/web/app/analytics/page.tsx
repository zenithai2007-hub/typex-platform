'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { PageHead, Stat, EmptyState, Skeleton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Ev { outcome: string; action: string; agentId: string; createdAt: string }

/** Real data only — aggregates the audit log. Empty state when no data. */
export default function AnalyticsPage() {
  const { agents } = useTx();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Ev[]>([]);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    Promise.all([api('/api/activity?limit=500'), api('/api/approvals?pending=1')])
      .then(([a, p]) => {
        setEvents(a.events ?? []);
        setPending((p.approvals ?? []).length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const count = (fn: (e: Ev) => boolean) => events.filter(fn).length;
  const byAgent = agents.map((a) => ({
    name: a.name,
    executed: count((e) => e.agentId === a.id && e.outcome === 'EXECUTED'),
    prepared: count((e) => e.agentId === a.id && e.outcome === 'PREPARED'),
  }));

  const hasData = events.length > 0;

  return (
    <div>
      <PageHead title="Analytics" sub="Real audit data se — fake numbers kabhi nahi." />
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !hasData ? (
        <EmptyState icon="analytics" title="No activity yet." sub="Agents kaam karenge to real metrics yahan ayenge." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Outputs prepared" value={count((e) => e.outcome === 'PREPARED')} icon="sparkle" />
            <Stat label="Actions approved" value={count((e) => e.outcome === 'APPROVED')} icon="approvals" />
            <Stat label="Actions executed" value={count((e) => e.outcome === 'EXECUTED')} icon="zap" />
            <Stat label="Pending approvals" value={pending} icon="clock" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Stat label="Failed" value={count((e) => e.outcome === 'FAILED')} icon="alert" />
            <Stat label="Denied by policy" value={count((e) => e.outcome === 'DENIED')} icon="shield" />
            <Stat label="Cancelled" value={count((e) => e.outcome === 'CANCELLED')} icon="x" />
            <Stat label="Total events" value={events.length} icon="activity" />
          </div>
          <h2 className="text-[15px] font-bold mb-3">Per-agent activity</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-[13px] min-w-[480px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10 text-left">
                  <th className="font-semibold p-3 text-[12px] muted">Agent</th>
                  <th className="font-semibold p-3 text-[12px] muted text-right">Prepared</th>
                  <th className="font-semibold p-3 text-[12px] muted text-right">Executed</th>
                </tr>
              </thead>
              <tbody>
                {byAgent.map((r) => (
                  <tr key={r.name} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 text-right">{r.prepared}</td>
                    <td className="p-3 text-right">{r.executed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
