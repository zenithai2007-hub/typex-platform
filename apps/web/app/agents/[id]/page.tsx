'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, fmtTime, timeAgo } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Field, TextArea, StatusChip, OutcomeChip, EmptyState, Skeleton, ErrorBox, Notice, Toggle, Modal, TextInput } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Agent {
  id: string; name: string; platformId: string; status: string;
  instructions: string; permissions: string[]; currentTask?: string | null;
  connectionId?: string | null; lastActiveAt?: string;
}
interface Task { id: string; objective: string; status: string; createdAt: string }
interface Audit { id: string; action: string; outcome: string; createdAt: string }
interface MemItem { key: string; value: string }

const ALL_PERMS = ['READ_CONTEXT', 'READ_MESSAGES', 'GENERATE_CONTENT', 'GENERATE_REPLY', 'INSERT_TEXT', 'SEND_MESSAGE', 'SEARCH', 'FORM_FILL', 'UPLOAD', 'POST', 'SCHEDULE'];

export default function AgentDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { setActiveAgentId, bump, refreshAgents } = useTx();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [mem, setMem] = useState<MemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'overview' | 'tasks' | 'memory' | 'activity'>('overview');
  const [editingInstr, setEditingInstr] = useState(false);
  const [instrText, setInstrText] = useState('');
  const [showTask, setShowTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ objective: '', instructions: '' });
  const [showMem, setShowMem] = useState(false);
  const [memForm, setMemForm] = useState({ key: '', value: '' });

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/agents/${id}`);
      setAgent(d.agent);
      setTasks(d.tasks ?? []);
      setAudit((d.audit ?? []).slice(0, 40));
      setInstrText(d.agent.instructions ?? '');
      const m = await api(`/api/memory?scope=AGENT&scopeId=${id}`).catch(() => ({ items: [] }));
      setMem(m.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setActiveAgentId(id);
    load();
  }, [id, load, setActiveAgentId]);

  async function act(kind: 'pause' | 'resume' | 'stop') {
    await api(`/api/agents/${id}/${kind}`, { method: 'POST' }).catch((e) => setError(e.message));
    await load();
    await refreshAgents();
    bump();
  }

  async function saveInstructions() {
    try {
      await api(`/api/agents/${id}`, { method: 'PATCH', body: { instructions: instrText } });
      setNotice('Instructions save ho gayin.');
      setEditingInstr(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function togglePerm(p: string, on: boolean) {
    if (!agent) return;
    const next = on ? [...agent.permissions, p] : agent.permissions.filter((x) => x !== p);
    try {
      await api(`/api/agents/${id}`, { method: 'PATCH', body: { permissions: next } });
      setAgent({ ...agent, permissions: next });
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function createTask() {
    try {
      await api(`/api/agents/${id}/tasks`, { method: 'POST', body: taskForm });
      setNotice('Task create ho gaya.');
      setShowTask(false);
      setTaskForm({ objective: '', instructions: '' });
      load();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function saveMem() {
    if (!memForm.key.trim()) return;
    try {
      await api('/api/memory', { method: 'POST', body: { scope: 'AGENT', scopeId: id, key: memForm.key.trim(), value: memForm.value } });
      setShowMem(false);
      setMemForm({ key: '', value: '' });
      const m = await api(`/api/memory?scope=AGENT&scopeId=${id}`);
      setMem(m.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function delMem(key: string) {
    await api(`/api/memory?scope=AGENT&scopeId=${id}&key=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {});
    setMem(mem.filter((m) => m.key !== key));
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  if (!agent) return <EmptyState icon="agents" title="Agent nahi mila." sub={error} />;

  return (
    <div>
      <PageHead
        title={agent.name}
        sub={<span className="capitalize">{agent.platformId.replace(/_/g, ' ')} · last active {timeAgo(agent.lastActiveAt)}</span> as unknown as string}
        actions={
          <>
            <StatusChip status={agent.status} />
            <Btn size="sm" icon={agent.status === 'PAUSED' ? 'play' : 'pause'} onClick={() => act(agent.status === 'PAUSED' ? 'resume' : 'pause')}>
              {agent.status === 'PAUSED' ? 'Resume' : 'Pause'}
            </Btn>
            <Btn size="sm" icon="stop" variant="danger" onClick={() => act('stop')}>Stop</Btn>
            <Link href="/workspace"><span className="tx-btn btn-primary btn-sm">Workspace</span></Link>
          </>
        }
      />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      <div className="flex gap-1.5 mb-4 border-b border-slate-200 dark:border-white/10 pb-px">
        {(['overview', 'tasks', 'memory', 'activity'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[13px] font-semibold capitalize border-b-2 -mb-px transition ${tab === t ? 'border-txpurple text-txpurple' : 'border-transparent muted hover:text-slate-900 dark:hover:text-white'}`}
          >
            {t}
            {t === 'tasks' && tasks.length > 0 && <span className="ml-1.5 chip !py-0 !px-1.5">{tasks.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-3">
          <div className="card card-pad">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-[14px]">Instructions</h3>
              {!editingInstr && <Btn size="xs" icon="edit" onClick={() => setEditingInstr(true)}>Edit</Btn>}
            </div>
            {editingInstr ? (
              <div className="space-y-2">
                <TextArea rows={4} value={instrText} onChange={(e) => setInstrText(e.target.value)} />
                <div className="flex gap-1.5">
                  <Btn size="sm" variant="primary" onClick={saveInstructions}>Save</Btn>
                  <Btn size="sm" onClick={() => { setEditingInstr(false); setInstrText(agent.instructions); }}>Cancel</Btn>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] whitespace-pre-wrap">{agent.instructions || <span className="muted">No instructions set.</span>}</p>
            )}
            <hr className="divider my-4" />
            <h3 className="font-bold text-[14px] mb-1">Style</h3>
            <p className="text-[13px] muted">Agent apne platform ke liye <Link href="/styles" className="text-txpurple font-semibold">saved styles</Link> use karta hai. Workspace mein per-output style badal sakte hain.</p>
          </div>

          <div className="card card-pad">
            <h3 className="font-bold text-[14px] mb-1">Permissions</h3>
            <p className="text-[12px] muted mb-3">Har external action se pehle permission check hota hai. Denial audit mein log hota hai.</p>
            <div className="space-y-2">
              {ALL_PERMS.map((p) => (
                <div key={p} className="flex items-center justify-between py-1">
                  <span className="text-[12.5px] font-mono">{p}</span>
                  <Toggle checked={agent.permissions.includes(p)} onChange={(v) => togglePerm(p, v)} />
                </div>
              ))}
            </div>
            <hr className="divider my-4" />
            <h3 className="font-bold text-[14px] mb-2">Connection</h3>
            <div className="text-[13px] muted">
              {agent.connectionId ? (
                <>Connected — <span className="font-mono text-[12px]">{agent.connectionId.slice(0, 8)}…</span></>
              ) : (
                <>No connection attached. <Link href="/connections" className="text-txpurple font-semibold">Connect a platform</Link> taake agent real actions le sake.</>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          <div className="flex justify-end mb-3">
            <Btn size="sm" variant="primary" icon="plus" onClick={() => setShowTask(true)}>New task</Btn>
          </div>
          {tasks.length === 0 ? (
            <EmptyState icon="tasks" title="No tasks." sub="Is agent ko persistent task dein — woh events par react karega." action={<Btn size="sm" variant="primary" onClick={() => setShowTask(true)}>New task</Btn>} />
          ) : (
            <div className="space-y-2.5">
              {tasks.map((t) => (
                <div key={t.id} className="card card-pad">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-[14px]">{t.objective}</div>
                    <OutcomeChip outcome={t.status} />
                  </div>
                  <div className="text-[11.5px] muted mt-1">Created {fmtTime(t.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'memory' && (
        <div>
          <div className="flex justify-end mb-3">
            <Btn size="sm" variant="primary" icon="plus" onClick={() => setShowMem(true)}>Add memory</Btn>
          </div>
          {mem.length === 0 ? (
            <EmptyState icon="memory" title="No agent memory." sub="Is agent ki isolated memory — doosre agents se kabhi mix nahi hogi." />
          ) : (
            <div className="space-y-2">
              {mem.map((m) => (
                <div key={m.key} className="card card-pad flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] font-mono">{m.key}</div>
                    <div className="text-[13px] muted whitespace-pre-wrap">{m.value}</div>
                  </div>
                  <button onClick={() => delMem(m.key)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Delete memory">
                    <Icon d={paths.trash} className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card card-pad">
          {audit.length === 0 ? (
            <div className="text-[13px] muted text-center py-6">No activity yet.</div>
          ) : (
            <ol className="space-y-2.5">
              {audit.map((e) => (
                <li key={e.id} className="flex items-center gap-2.5 text-[13px]">
                  <OutcomeChip outcome={e.outcome} />
                  <span className="muted flex-1 truncate">{e.action.replace(/\./g, ' ')}</span>
                  <span className="text-[11px] muted shrink-0">{timeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {showTask && (
        <Modal title="New persistent task" onClose={() => setShowTask(false)}>
          <div className="space-y-3">
            <Field label="Objective">
              <TextInput placeholder="e.g. Ahmed ke messages handle karo, meri style mein reply prepare karo" value={taskForm.objective} onChange={(e) => setTaskForm({ ...taskForm, objective: e.target.value })} />
            </Field>
            <Field label="Instructions (optional)">
              <TextArea rows={3} value={taskForm.instructions} onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setShowTask(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!taskForm.objective.trim()} onClick={createTask}>Create task</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showMem && (
        <Modal title="Add agent memory" onClose={() => setShowMem(false)}>
          <div className="space-y-3">
            <Field label="Key"><TextInput placeholder="e.g. reply_style" value={memForm.key} onChange={(e) => setMemForm({ ...memForm, key: e.target.value })} /></Field>
            <Field label="Value"><TextArea rows={3} placeholder="e.g. Short Roman Urdu replies" value={memForm.value} onChange={(e) => setMemForm({ ...memForm, value: e.target.value })} /></Field>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setShowMem(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!memForm.key.trim()} onClick={saveMem}>Save</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
