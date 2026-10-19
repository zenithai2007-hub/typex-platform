'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Spinner, ErrorBox, Empty, PageHead, Field, ConfirmButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Item { id: string; key: string; value: string; updatedAt: string }
interface Agent { id: string; name: string }

const SCOPES = ['GLOBAL', 'PLATFORM', 'AGENT', 'TASK', 'CONVERSATION'];

export default function MemoryPage() {
  const [scope, setScope] = useState('GLOBAL');
  const [scopeId, setScopeId] = useState('global');
  const [items, setItems] = useState<Item[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ key: '', value: '' });

  async function load() {
    setError('');
    setItems(null);
    try {
      const a = await api('/api/agents');
      setAgents(a.agents ?? []);
      const d = await api(`/api/memory?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}`);
      setItems(d.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, [scope, scopeId]);

  async function save() {
    if (!form.key.trim()) return;
    await api('/api/memory', { method: 'POST', body: { scope, scopeId, key: form.key.trim(), value: form.value } });
    setForm({ key: '', value: '' });
    load();
  }

  async function remove(key: string) {
    await api(`/api/memory?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}&key=${encodeURIComponent(key)}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <PageHead
        title="Memory"
        sub="Scoped memory — har scope ka data alag. Cross-agent leak nahi hota."
        action={<button className="tx-btn btn-ghost text-xs" onClick={load}><Icon d={paths.refresh} className="w-4 h-4" /> Refresh</button>}
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      <div className="glass p-5 mb-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Scope">
            <select className="tx-input" value={scope} onChange={(e) => setScope(e.target.value)}>
              {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Scope ID">
            {scope === 'AGENT' ? (
              <select className="tx-input" value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            ) : (
              <input className="tx-input" value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder={scope === 'GLOBAL' ? 'global' : 'scope id…'} />
            )}
          </Field>
        </div>
      </div>

      <div className="glass p-5 mb-4">
        <h3 className="font-bold mb-3">Naya / Edit item (key se upsert hota hai)</h3>
        <div className="grid md:grid-cols-[220px_1fr_auto] gap-3">
          <Field label="Key">
            <input className="tx-input" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. client:name" />
          </Field>
          <Field label="Value">
            <input className="tx-input" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="value…" />
          </Field>
          <div className="flex items-end">
            <button className="tx-btn btn-primary text-xs" disabled={!form.key.trim()} onClick={save}>
              <Icon d={paths.check} className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
      </div>

      {items === null ? (
        <Spinner label="Memory load ho rahi hai…" />
      ) : items.length === 0 ? (
        <Empty title="Is scope mein koi item nahi" />
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.key} className="glass-soft p-3 flex items-start justify-between gap-3">
              <div className="text-sm flex-1 min-w-0">
                <div className="font-mono text-txviolet font-semibold break-all">{m.key}</div>
                <div className="text-white/65 mt-1 break-words whitespace-pre-wrap">{m.value}</div>
                <div className="text-xs text-white/35 mt-1">{fmtTime(m.updatedAt)}</div>
              </div>
              <ConfirmButton
                label={<Icon d={paths.trash} className="w-4 h-4" />}
                confirmLabel="Delete pakka?"
                onConfirm={() => remove(m.key)}
                className="text-xs !px-2.5"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
