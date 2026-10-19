'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead, Field } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Agent { id: string; name: string; platformId: string; status: string; instructions: string }

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', platformId: 'whatsapp', instructions: '' });
  const [platforms, setPlatforms] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    setError('');
    try {
      const d = await api('/api/agents');
      setAgents(d.agents ?? []);
      const p = await api('/api/platforms');
      setPlatforms((p.platforms ?? []).map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    try {
      await api('/api/agents', { method: 'POST', body: form });
      setForm({ name: '', platformId: 'whatsapp', instructions: '' });
      setCreating(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <PageHead
        title="Agents"
        sub="Har platform ka alag agent — isolate memory, isolate permissions."
        action={
          <button className="tx-btn btn-primary text-xs" onClick={() => setCreating((v) => !v)}>
            <Icon d={paths.plus} className="w-4 h-4" /> Naya Agent
          </button>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {creating && (
        <div className="glass p-5 mb-5 fade-up">
          <h3 className="font-bold mb-3">Naya agent banayein</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Naam">
              <input className="tx-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales Agent" />
            </Field>
            <Field label="Platform">
              <select className="tx-input" value={form.platformId} onChange={(e) => setForm({ ...form, platformId: e.target.value })}>
                {platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Instructions (agent ki personality / rules)">
              <textarea className="tx-input" rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Agent kya kare, kaise baat kare…" />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="tx-btn btn-primary text-xs" disabled={!form.name.trim()} onClick={create}>
              <Icon d={paths.check} className="w-4 h-4" /> Banayein
            </button>
            <button className="tx-btn btn-ghost text-xs" onClick={() => setCreating(false)}>Radd karein</button>
          </div>
        </div>
      )}

      {agents === null ? (
        <Spinner label="Agents load ho rahe hain…" />
      ) : agents.length === 0 ? (
        <Empty title="Koi agent nahi" hint="Upar 'Naya Agent' se banayein." />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`} className="glass p-5 hover:border-txviolet/40 transition block">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-lg">{a.name}</div>
                  <div className="text-xs text-white/50 capitalize">{a.platformId.replace('-', ' ')}</div>
                </div>
                <Pill status={a.status} live={a.status === 'ACTIVE'} />
              </div>
              <p className="text-sm text-white/55 mt-3 line-clamp-2">{a.instructions}</p>
              <div className="text-xs text-txviolet mt-3 font-semibold">Detail kholein →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
