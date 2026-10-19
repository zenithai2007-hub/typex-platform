'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { PageHead, Btn, OutcomeChip, EmptyState, Skeleton, ErrorBox, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Task {
  id: string; agentId: string; objective: string; instructions: string;
  status: string; createdAt: string;
}

const FILTERS = ['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
const ACTIVE_SET = ['CREATED', 'RUNNING', 'WAITING', 'WAITING_APPROVAL'];

export default function TasksPage() {
  const { agents, refreshAgents, bump } = useTx();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    refreshAgents().then(async () => {
      try {
        const ds = await Promise.all(
          (await api('/api/agents')).agents.map((a: { id: string }) =>
            api(`/api/agents/${a.id}/tasks`).then((d) => d.tasks ?? []).catch(() => []),
          ),
        );
        setTasks(ds.flat().sort((a: Task, b: Task) => +new Date(b.createdAt) - +new Date(a.createdAt)));
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    });
  }, [refreshAgents]);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Agent';

  async function setStatus(t: Task, status: string) {
    setError('');
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { status } });
      setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, status } : x)));
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(t: Task) {
    if (!confirm('Is task ko cancel/delete karein?')) return;
    try {
      await api(`/api/tasks/${t.id}`, { method: 'DELETE' });
      setNotice('Task cancel ho gaya.');
      setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, status: 'CANCELLED' } : x)));
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const shown = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') return ACTIVE_SET.includes(t.status);
    return t.status === filter;
  });

  return (
    <div>
      <PageHead title="Tasks" sub="Persistent agent tasks — lifecycle ke saath." />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip !py-1.5 !px-3 !text-[12px] cursor-pointer ${filter === f ? 'chip-purple' : ''}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2.5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState icon="tasks" title="No tasks." sub="Agent detail page se persistent task banayein." />
      ) : (
        <div className="space-y-2.5">
          {shown.map((t) => (
            <div key={t.id} className="card card-pad">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-[14px]">{t.objective}</div>
                  <div className="text-[11.5px] muted mt-0.5">
                    {agentName(t.agentId)} · {fmtTime(t.createdAt)}
                  </div>
                </div>
                <OutcomeChip outcome={t.status} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {ACTIVE_SET.includes(t.status) && (
                  <Btn size="xs" icon="pause" onClick={() => setStatus(t, 'PAUSED')}>Pause</Btn>
                )}
                {t.status === 'PAUSED' && (
                  <Btn size="xs" icon="play" onClick={() => setStatus(t, 'RUNNING')}>Resume</Btn>
                )}
                {t.status === 'CREATED' && (
                  <Btn size="xs" icon="play" onClick={() => setStatus(t, 'RUNNING')}>Start</Btn>
                )}
                {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(t.status) && (
                  <Btn size="xs" icon="stop" onClick={() => setStatus(t, 'CANCELLED')}>Stop</Btn>
                )}
                <Btn size="xs" variant="danger" icon="trash" onClick={() => remove(t)} className="ml-auto">Delete</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
