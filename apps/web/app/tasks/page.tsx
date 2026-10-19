'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead, ConfirmButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Task { id: string; agentId: string; objective: string; instructions?: string; status: string; createdAt: string }
interface Agent { id: string; name: string }

const ACTIVE = ['CREATED', 'RUNNING', 'WAITING', 'WAITING_APPROVAL', 'PAUSED'];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

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
      all.sort((x, y) => +new Date(y.createdAt) - +new Date(x.createdAt));
      setTasks(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function setStatus(t: Task, status: string) {
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(t: Task) {
    try {
      await api(`/api/tasks/${t.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  const shown = (tasks ?? []).filter((t) => filter === 'ALL' || (filter === 'ACTIVE' ? ACTIVE.includes(t.status) : t.status === filter));

  return (
    <div>
      <PageHead
        title="Tasks"
        sub="Persistent task lifecycle — CREATED se COMPLETED tak, har transition audited."
        action={
          <div className="flex gap-2">
            <select className="tx-input !w-auto text-xs" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ALL">Sab</option>
              <option value="ACTIVE">Active</option>
              <option value="CREATED">Created</option>
              <option value="RUNNING">Running</option>
              <option value="WAITING_APPROVAL">Waiting approval</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className="tx-btn btn-ghost text-xs" onClick={load}>
              <Icon d={paths.refresh} className="w-4 h-4" /> Refresh
            </button>
          </div>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {tasks === null ? (
        <Spinner label="Tasks load ho rahe hain…" />
      ) : shown.length === 0 ? (
        <Empty title="Koi task nahi" hint="Agent detail page se naya task banayein." />
      ) : (
        <div className="space-y-2.5">
          {shown.map((t) => (
            <div key={t.id} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-[220px]">
                  <div className="font-semibold">{t.objective}</div>
                  {t.instructions && <div className="text-xs text-white/45 mt-1 line-clamp-2">{t.instructions}</div>}
                  <div className="text-xs text-white/35 mt-1.5">{agentName(t.agentId)} · {fmtTime(t.createdAt)}</div>
                </div>
                <Pill status={t.status} live={['RUNNING', 'WAITING_APPROVAL'].includes(t.status)} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {t.status === 'PAUSED' && <button className="tx-btn btn-ghost text-xs !px-3" onClick={() => setStatus(t, 'RUNNING')}>Resume</button>}
                {ACTIVE.includes(t.status) && t.status !== 'PAUSED' && <button className="tx-btn btn-ghost text-xs !px-3" onClick={() => setStatus(t, 'PAUSED')}>Pause</button>}
                {['FAILED'].includes(t.status) && <button className="tx-btn btn-ghost text-xs !px-3" onClick={() => setStatus(t, 'RUNNING')}>Retry</button>}
                {!['COMPLETED', 'CANCELLED'].includes(t.status) && <button className="tx-btn btn-ghost text-xs !px-3" onClick={() => setStatus(t, 'CANCELLED')}>Stop</button>}
                <ConfirmButton label={<><Icon d={paths.trash} className="w-3.5 h-3.5" /> Delete</>} confirmLabel="Delete pakka?" onConfirm={() => remove(t)} className="text-xs !px-3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
