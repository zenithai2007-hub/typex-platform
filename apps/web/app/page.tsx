'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, timeAgo } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Agent { id: string; name: string; platformId: string; status: string; lastActiveAt: string; currentTask: string | null }
interface Task { id: string; agentId: string; objective: string; status: string }

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Assalam-o-Alaikum';
  if (h < 17) return 'Dopher bakhair';
  return 'Shaam bakhair';
}

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<number>(0);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const d = await api('/api/agents');
      const list: Agent[] = d.agents ?? [];
      setAgents(list);
      const all: Task[] = [];
      for (const a of list) {
        const t = await api(`/api/agents/${a.id}/tasks`);
        all.push(...(t.tasks ?? []));
      }
      setTasks(all);
      const ap = await api('/api/approvals?pending=1');
      setApprovals((ap.approvals ?? []).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  const running = tasks.filter((t) => ['CREATED', 'RUNNING', 'WAITING', 'WAITING_APPROVAL', 'PAUSED'].includes(t.status)).length;

  return (
    <div>
      <PageHead
        title={`${greeting()}!`}
        sub="TYPE X Control Center — apke agents, tasks aur approvals ek jagah."
        action={
          <button className="tx-btn btn-ghost text-xs" onClick={load}>
            <Icon d={paths.refresh} className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Agents', value: agents?.length ?? '—', href: '/agents', icon: 'agents' },
          { label: 'Chalte hue tasks', value: running, href: '/tasks', icon: 'tasks' },
          { label: 'Pending approvals', value: approvals, href: '/approvals', icon: 'approvals' },
          { label: 'Generate karein', value: '→', href: '/workspace', icon: 'workspace' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="glass p-4 hover:border-txviolet/40 transition">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-extrabold">{s.value}</div>
              <Icon d={paths[s.icon as keyof typeof paths]} className="w-5 h-5 text-txviolet" />
            </div>
            <div className="text-xs text-white/50 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="text-lg font-bold mb-3">Apke Agents</h2>
      {agents === null ? (
        <Spinner label="Agents load ho rahe hain…" />
      ) : agents.length === 0 ? (
        <Empty title="Koi agent nahi mila" hint="Agents page par naya agent banayein." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {agents.map((a) => {
            const live = a.status === 'ACTIVE' || a.status === 'WAITING_APPROVAL';
            const cur = tasks.find((t) => t.id === a.currentTask);
            return (
              <div key={a.id} className="glass p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-lg">{a.name}</div>
                    <div className="text-xs text-white/50 capitalize">{a.platformId.replace('-', ' ')} platform</div>
                  </div>
                  <Pill status={a.status} live={live} />
                </div>
                <div className="text-sm text-white/60 mt-3">
                  <span className="text-white/40">Current task: </span>
                  {cur ? cur.objective : <span className="text-white/35">koi nahi</span>}
                </div>
                <div className="text-xs text-white/40 mt-1">Last activity: {timeAgo(a.lastActiveAt)}</div>
                <div className="flex gap-2 mt-4">
                  {a.status === 'PAUSED' || a.status === 'OFFLINE' ? (
                    <button className="tx-btn btn-ghost text-xs" onClick={async () => { await api(`/api/agents/${a.id}/resume`, { method: 'POST' }); load(); }}>
                      <Icon d={paths.play} className="w-4 h-4" /> Resume
                    </button>
                  ) : (
                    <button className="tx-btn btn-ghost text-xs" onClick={async () => { await api(`/api/agents/${a.id}/pause`, { method: 'POST' }); load(); }}>
                      <Icon d={paths.pause} className="w-4 h-4" /> Pause
                    </button>
                  )}
                  <Link href={`/agents/${a.id}`} className="tx-btn btn-primary text-xs">Open</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
