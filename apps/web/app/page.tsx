'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import type { AgentLite } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Stat, StatusChip, EmptyState, Skeleton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Agent extends AgentLite { currentTask?: string | null }

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const { agents, refreshAgents, setActiveAgentId, bump } = useTx();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ executed: 0, approved: 0, pending: 0, outputs: 0 });

  useEffect(() => {
    Promise.all([refreshAgents(), api('/api/activity?limit=500'), api('/api/approvals?pending=1')])
      .then(([, act, ap]) => {
        const ev: { outcome: string; action: string }[] = act.events ?? [];
        setStats({
          executed: ev.filter((e) => e.outcome === 'EXECUTED').length,
          approved: ev.filter((e) => e.outcome === 'APPROVED').length,
          pending: (ap.approvals ?? []).length,
          outputs: ev.filter((e) => e.action.includes('generat') || e.action.includes('plan.prepared')).length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshAgents]);

  async function togglePause(a: AgentLite) {
    const kind = a.status === 'PAUSED' ? 'resume' : 'pause';
    await api(`/api/agents/${a.id}/${kind}`, { method: 'POST' }).catch(() => {});
    await refreshAgents();
    bump();
  }

  const active = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'WAITING_APPROVAL');

  return (
    <div>
      <PageHead
        title={`${greeting()} — Clint X ready hai.`}
        sub="Apne agents dekhein, tasks banayein, approvals handle karein — sab kuch yahin se."
        actions={
          <Link href="/workspace"><span className="tx-btn btn-primary"><Icon d={paths.workspace} className="w-4 h-4" /> Open Workspace</span></Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="Active agents" value={active.length} icon="agents" />
        <Stat label="Outputs generated" value={stats.outputs} icon="sparkle" />
        <Stat label="Approved actions" value={stats.approved} icon="approvals" />
        <Stat label="Executed" value={stats.executed} icon="zap" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold">Agents</h2>
        <Link href="/agents" className="text-[13px] font-semibold text-txpurple hover:underline">Manage all</Link>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon="agents"
          title="No agents yet."
          sub="Create your first agent — pick a platform, set instructions, and let Clint X work."
          action={<Link href="/agents"><span className="tx-btn btn-primary">Create agent</span></Link>}
        />
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(agents as Agent[]).map((a) => (
            <div key={a.id} className="card card-pad card-hover">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-txpurple/20 text-txpurple dark:text-violet-300 flex items-center justify-center font-bold shrink-0">
                    {a.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] truncate">{a.name}</div>
                    <div className="text-[11.5px] muted capitalize">{a.platformId.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <StatusChip status={a.status} />
              </div>
              {a.currentTask && <div className="text-[12px] muted mt-2 line-clamp-2">Task: {a.currentTask}</div>}
              <div className="flex gap-1.5 mt-3">
                <Link href={`/agents/${a.id}`} onClick={() => setActiveAgentId(a.id)}>
                  <span className="tx-btn btn-ghost btn-sm">Open</span>
                </Link>
                <Link href="/workspace" onClick={() => setActiveAgentId(a.id)}>
                  <span className="tx-btn btn-ghost btn-sm">Workspace</span>
                </Link>
                <Btn size="sm" icon={a.status === 'PAUSED' ? 'play' : 'pause'} onClick={() => togglePause(a)} className="ml-auto">
                  {a.status === 'PAUSED' ? 'Resume' : 'Pause'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
