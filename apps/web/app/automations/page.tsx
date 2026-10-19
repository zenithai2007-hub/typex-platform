'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Modal, Field, TextInput, TextArea, Select, EmptyState, Skeleton, ErrorBox, Notice, OutcomeChip } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Task {
  id: string; agentId: string; objective: string; instructions: string;
  trigger?: string; schedule?: string; status: string; createdAt: string;
}
interface Agent { id: string; name: string }

/** Automations = persistent tasks with a trigger or schedule. Built on the real
 *  task engine — pausing/stopping here drives the same lifecycle. */
export default function AutomationsPage() {
  const { agents, bump } = useTx();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ agentId: '', objective: '', instructions: '', trigger: '', schedule: '' });

  useEffect(() => {
    (async () => {
      try {
        const list: Agent[] = (await api('/api/agents')).agents ?? [];
        const ds = await Promise.all(
          list.map((a) => api(`/api/agents/${a.id}/tasks`).then((d) => d.tasks ?? []).catch(() => [])),
        );
        setTasks(
          ds.flat()
            .filter((t: Task) => t.trigger || t.schedule)
            .sort((a: Task, b: Task) => +new Date(b.createdAt) - +new Date(a.createdAt)),
        );
        if (list[0]) setForm((f) => ({ ...f, agentId: f.agentId || list[0].id }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Agent';

  async function create() {
    setError('');
    try {
      await api(`/api/agents/${form.agentId}/tasks`, {
        method: 'POST',
        body: { objective: form.objective, instructions: form.instructions, trigger: form.trigger || undefined, schedule: form.schedule || undefined },
      });
      setNotice('Automation create ho gayi.');
      setShowNew(false);
      setForm({ agentId: form.agentId, objective: '', instructions: '', trigger: '', schedule: '' });
      bump();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function setStatus(t: Task, status: string) {
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { status } });
      setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, status } : x)));
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <PageHead
        title="Automations"
        sub="Trigger ya schedule par chalne wale persistent tasks — har automation apne agent ki permissions ke andar chalti hai."
        actions={<Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>New automation</Btn>}
      />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      {loading ? (
        <div className="space-y-2.5">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon="automations"
          title="No automations."
          sub="Example: WHEN new WhatsApp message arrives → IF from Ahmed → THEN draft reply → THEN require approval."
          action={<Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>New automation</Btn>}
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="card card-pad">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider muted mb-1.5">
                <Icon d={paths.automations} className="w-3.5 h-3.5 text-txpurple" />
                {t.trigger ? `WHEN ${t.trigger}` : `SCHEDULE ${t.schedule}`}
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-[14px]">{t.objective}</div>
                <OutcomeChip outcome={t.status} />
              </div>
              <div className="text-[11.5px] muted mt-1">{agentName(t.agentId)} · {fmtTime(t.createdAt)}</div>
              <div className="flex gap-1.5 mt-3">
                {t.status === 'PAUSED' ? (
                  <Btn size="xs" icon="play" onClick={() => setStatus(t, 'RUNNING')}>Resume</Btn>
                ) : (
                  <Btn size="xs" icon="pause" onClick={() => setStatus(t, 'PAUSED')}>Pause</Btn>
                )}
                <Btn size="xs" icon="stop" onClick={() => setStatus(t, 'CANCELLED')}>Stop</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="New automation" onClose={() => setShowNew(false)} wide>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Agent">
                <Select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Schedule (optional)" hint="e.g. every morning 9am">
                <TextInput value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="daily 09:00" />
              </Field>
            </div>
            <Field label="Trigger (optional)" hint="e.g. new WhatsApp message from Ahmed">
              <TextInput value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} placeholder="WHEN…" />
            </Field>
            <Field label="Objective">
              <TextInput value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="THEN — kya karna hai" />
            </Field>
            <Field label="Instructions">
              <TextArea rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Approval required har send se pehle…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setShowNew(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!form.agentId || !form.objective.trim() || (!form.trigger.trim() && !form.schedule.trim())} onClick={create}>
                Create automation
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
