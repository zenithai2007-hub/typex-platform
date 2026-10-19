'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead, Field } from '@/components/ui';

export const dynamic = 'force-dynamic';

const ALL_PERMS = [
  'READ_CONTEXT', 'READ_MESSAGES', 'GENERATE_CONTENT', 'GENERATE_TEXT', 'GENERATE_REPLY',
  'INSERT_TEXT', 'SEND_MESSAGE', 'SEARCH', 'FORM_FILL', 'UPLOAD', 'POST', 'DELETE', 'SCHEDULE',
];

interface Agent { id: string; name: string; platformId: string; status: string; instructions: string; currentTask: string | null; permissions: string[] }
interface Task { id: string; objective: string; status: string; createdAt: string }
interface Audit { id: string; action: string; outcome: string; createdAt: string; taskId?: string }
interface Mem { key: string; value: string }

export default function AgentDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [mem, setMem] = useState<Mem[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [instr, setInstr] = useState('');
  const [taskForm, setTaskForm] = useState({ objective: '', instructions: '' });

  async function load() {
    setError('');
    try {
      const d = await api(`/api/agents/${id}`);
      setAgent(d.agent);
      setTasks(d.tasks ?? []);
      setAudit(d.audit ?? []);
      setPerms(d.permissions ?? []);
      setInstr(d.agent.instructions ?? '');
      const m = await api(`/api/memory?scope=AGENT&scopeId=${id}`);
      setMem((m.items ?? []).map((x: { key: string; value: string }) => ({ key: x.key, value: x.value })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, [id]);

  async function saveInstructions() {
    await api(`/api/agents/${id}`, { method: 'PATCH', body: { instructions: instr } });
    setEditing(false);
    load();
  }

  async function togglePerm(p: string) {
    const next = perms.includes(p) ? perms.filter((x) => x !== p) : [...perms, p];
    setPerms(next);
    await api(`/api/agents/${id}`, { method: 'PATCH', body: { permissions: next } });
  }

  async function createTask() {
    if (!taskForm.objective.trim()) return;
    await api(`/api/agents/${id}/tasks`, { method: 'POST', body: taskForm });
    setTaskForm({ objective: '', instructions: '' });
    load();
  }

  async function setTaskStatus(t: Task, status: string) {
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { status } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!agent && !error) return <Spinner label="Agent load ho raha hai…" />;
  if (!agent) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div>
      <PageHead
        title={agent.name}
        sub={`${agent.platformId.replace('-', ' ')} platform`}
        action={<Pill status={agent.status} live={agent.status === 'ACTIVE'} />}
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          {/* CURRENT TASK */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Current Task</h3>
            {tasks.length === 0 ? (
              <Empty title="Koi task nahi" hint="Neeche naya task banayein." />
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 5).map((t) => (
                  <div key={t.id} className="glass-soft p-3 flex items-center justify-between gap-2">
                    <div className="text-sm">
                      <div className="font-medium">{t.objective}</div>
                      <div className="text-xs text-white/40">{fmtTime(t.createdAt)}</div>
                    </div>
                    <Pill status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NEW TASK */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Naya Task</h3>
            <div className="space-y-3">
              <Field label="Objective (kya karna hai)">
                <input className="tx-input" value={taskForm.objective} onChange={(e) => setTaskForm({ ...taskForm, objective: e.target.value })} placeholder="e.g. Client ko follow-up message bhejo" />
              </Field>
              <Field label="Instructions (detail)">
                <textarea className="tx-input" rows={2} value={taskForm.instructions} onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })} placeholder="Kaise karna hai…" />
              </Field>
              <button className="tx-btn btn-action text-xs" disabled={!taskForm.objective.trim()} onClick={createTask}>
                <Icon d={paths.bolt} className="w-4 h-4" /> Task banayein
              </button>
            </div>
          </div>

          {/* INSTRUCTIONS */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Instructions</h3>
              {!editing ? (
                <button className="tx-btn btn-ghost text-xs" onClick={() => setEditing(true)}>
                  <Icon d={paths.edit} className="w-4 h-4" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button className="tx-btn btn-primary text-xs" onClick={saveInstructions}>
                    <Icon d={paths.check} className="w-4 h-4" /> Save
                  </button>
                  <button className="tx-btn btn-ghost text-xs" onClick={() => { setEditing(false); setInstr(agent.instructions); }}>Radd</button>
                </div>
              )}
            </div>
            {editing ? (
              <textarea className="tx-input" rows={4} value={instr} onChange={(e) => setInstr(e.target.value)} />
            ) : (
              <p className="text-sm text-white/65 whitespace-pre-wrap">{agent.instructions}</p>
            )}
          </div>

          {/* ACTIVITY */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Activity (audit)</h3>
            {audit.length === 0 ? (
              <Empty title="Abhi koi activity nahi" />
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {audit.slice(-30).reverse().map((e) => (
                  <div key={e.id} className="glass-soft px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-white/70 font-mono">{e.action}</span>
                    <span className="flex items-center gap-2">
                      <Pill status={e.outcome} />
                      <span className="text-white/35">{fmtTime(e.createdAt)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* CONTROLS */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Controls</h3>
            <div className="flex flex-wrap gap-2">
              <button className="tx-btn btn-ghost text-xs" onClick={async () => { await api(`/api/agents/${id}/pause`, { method: 'POST' }); load(); }}>
                <Icon d={paths.pause} className="w-4 h-4" /> Pause
              </button>
              <button className="tx-btn btn-ghost text-xs" onClick={async () => { await api(`/api/agents/${id}/resume`, { method: 'POST' }); load(); }}>
                <Icon d={paths.play} className="w-4 h-4" /> Resume
              </button>
              <button className="tx-btn btn-ghost text-xs" onClick={async () => { await api(`/api/agents/${id}/stop`, { method: 'POST' }); load(); }}>
                <Icon d={paths.stop} className="w-4 h-4" /> Stop
              </button>
            </div>
          </div>

          {/* PERMISSIONS */}
          <div className="glass p-5">
            <h3 className="font-bold mb-1">Permissions</h3>
            <p className="text-xs text-white/40 mb-3">PolicyEngine — toggle se foran lagu hota hai.</p>
            <div className="space-y-1.5">
              {ALL_PERMS.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePerm(p)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono border transition ${
                    perms.includes(p) ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200' : 'bg-white/5 border-white/10 text-white/45'
                  }`}
                >
                  {p}
                  <span className={`w-2 h-2 rounded-full ${perms.includes(p) ? 'bg-emerald-400' : 'bg-white/20'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* MEMORY */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Memory (scoped — sirf is agent ki)</h3>
            {mem.length === 0 ? (
              <Empty title="Koi memory item nahi" />
            ) : (
              <div className="space-y-2">
                {mem.map((m) => (
                  <div key={m.key} className="glass-soft p-2.5 text-xs">
                    <div className="font-mono text-txviolet font-semibold break-all">{m.key}</div>
                    <div className="text-white/60 mt-1 break-words line-clamp-3">{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TASK LIFECYCLE */}
      <div className="glass p-5 mt-4">
        <h3 className="font-bold mb-3">Tasks (lifecycle)</h3>
        {tasks.length === 0 ? (
          <Empty title="Koi task nahi" />
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="glass-soft p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm flex-1 min-w-[200px]">
                  <div className="font-medium">{t.objective}</div>
                  <div className="text-xs text-white/40">{fmtTime(t.createdAt)}</div>
                </div>
                <Pill status={t.status} />
                <div className="flex gap-1.5">
                  {['PAUSED'].includes(t.status) && <button className="tx-btn btn-ghost text-xs !px-2.5" onClick={() => setTaskStatus(t, 'RUNNING')}>Resume</button>}
                  {['CREATED', 'RUNNING', 'WAITING'].includes(t.status) && <button className="tx-btn btn-ghost text-xs !px-2.5" onClick={() => setTaskStatus(t, 'PAUSED')}>Pause</button>}
                  {!['COMPLETED', 'CANCELLED', 'FAILED'].includes(t.status) && <button className="tx-btn btn-ghost text-xs !px-2.5" onClick={() => setTaskStatus(t, 'CANCELLED')}>Stop</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
