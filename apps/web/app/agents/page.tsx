'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import type { AgentLite } from '@/components/tx-store';
import { PageHead, Btn, Modal, Field, TextInput, TextArea, Select, StatusChip, EmptyState, Skeleton, ErrorBox, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Agent extends AgentLite { instructions: string }
interface Platform { id: string; name: string; status: string }

export default function AgentsPage() {
  const { agents, refreshAgents, setActiveAgentId, bump } = useTx();
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', platformId: 'whatsapp', instructions: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([refreshAgents(), api('/api/platforms').then((d) => setPlatforms(d.platforms ?? [])).catch(() => {})])
      .finally(() => setLoading(false));
  }, [refreshAgents]);

  async function create() {
    setError('');
    setSaving(true);
    try {
      const d = await api('/api/agents', { method: 'POST', body: form });
      setNotice(`Agent "${d.agent.name}" ban gaya.`);
      setShowNew(false);
      setForm({ name: '', platformId: 'whatsapp', instructions: '' });
      await refreshAgents();
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(a: AgentLite) {
    const kind = a.status === 'PAUSED' ? 'resume' : 'pause';
    await api(`/api/agents/${a.id}/${kind}`, { method: 'POST' }).catch(() => {});
    await refreshAgents();
    bump();
  }

  return (
    <div>
      <PageHead
        title="Agents"
        sub="Har platform ka apna isolated agent — alag memory, alag context, alag permissions."
        actions={<Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>New agent</Btn>}
      />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}

      {loading ? (
        <div className="grid md:grid-cols-2 gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon="agents"
          title="No agents yet."
          sub="Pehla agent banayein — platform chunein, instructions dein."
          action={<Btn variant="primary" icon="plus" onClick={() => setShowNew(true)}>New agent</Btn>}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {(agents as Agent[]).map((a) => (
            <div key={a.id} className="card card-pad card-hover">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-txpurple/20 text-txpurple dark:text-violet-300 flex items-center justify-center font-bold">
                    {a.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-[11.5px] muted capitalize">{a.platformId.replace(/_/g, ' ')}</div>
                  </div>
                </div>
                <StatusChip status={a.status} />
              </div>
              {a.instructions && <p className="text-[12.5px] muted mt-2 line-clamp-2">{a.instructions}</p>}
              <div className="flex gap-1.5 mt-3">
                <Link href={`/agents/${a.id}`} onClick={() => setActiveAgentId(a.id)}>
                  <span className="tx-btn btn-primary btn-sm">Open</span>
                </Link>
                <Btn size="sm" icon={a.status === 'PAUSED' ? 'play' : 'pause'} onClick={() => togglePause(a)}>
                  {a.status === 'PAUSED' ? 'Resume' : 'Pause'}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <Modal title="New agent" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <ErrorBox msg={error} onClose={() => setError('')} />
            <Field label="Agent name">
              <TextInput placeholder="e.g. WhatsApp Agent" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Platform">
              <Select value={form.platformId} onChange={(e) => setForm({ ...form, platformId: e.target.value })}>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Instructions" hint="Agent hamesha in instructions ke andar kaam karega.">
              <TextArea rows={3} placeholder="e.g. Keep replies friendly, concise, in Roman Urdu." value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Btn onClick={() => setShowNew(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={saving || !form.name.trim()} onClick={create}>
                {saving ? 'Creating…' : 'Create agent'}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
