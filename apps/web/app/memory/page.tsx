'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Modal, Field, TextInput, TextArea, Select, EmptyState, Skeleton, ErrorBox, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Item { key: string; value: string }
const SCOPES = ['GLOBAL', 'PLATFORM', 'AGENT', 'TASK', 'CONVERSATION'] as const;

export default function MemoryPage() {
  const { agents } = useTx();
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('GLOBAL');
  const [scopeId, setScopeId] = useState('global');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ key: '', value: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api(`/api/memory?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}`);
      setItems(d.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [scope, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (scope === 'GLOBAL') setScopeId('global');
    else if (scope === 'AGENT' && agents[0]) setScopeId(agents[0].id);
    else if (scope === 'PLATFORM') setScopeId('whatsapp');
    else setScopeId('');
  }, [scope, agents]);

  async function save() {
    if (!form.key.trim() || !scopeId.trim()) return;
    try {
      await api('/api/memory', { method: 'POST', body: { scope, scopeId: scopeId.trim(), key: form.key.trim(), value: form.value } });
      setNotice('Memory save ho gayi.');
      setShowAdd(false);
      setForm({ key: '', value: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(key: string) {
    await api(`/api/memory?scope=${scope}&scopeId=${encodeURIComponent(scopeId)}&key=${encodeURIComponent(key)}`, { method: 'DELETE' }).catch(() => {});
    setItems((p) => p.filter((i) => i.key !== key));
  }

  return (
    <div>
      <PageHead
        title="Memory"
        sub="Scoped memory — GLOBAL, PLATFORM, AGENT, TASK, CONVERSATION. Agents ke darmiyan kabhi auto-merge nahi hoti."
        actions={<Btn variant="primary" icon="plus" onClick={() => setShowAdd(true)}>Add memory</Btn>}
      />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      <div className="card card-pad mb-4 flex flex-wrap gap-2.5 items-end">
        <div className="w-48">
          <Field label="Scope">
            <Select value={scope} onChange={(e) => setScope(e.target.value as (typeof SCOPES)[number])}>
              {SCOPES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
        {scope === 'AGENT' ? (
          <div className="w-56">
            <Field label="Agent">
              <Select value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </div>
        ) : scope !== 'GLOBAL' ? (
          <div className="w-56">
            <Field label="Scope ID">
              <TextInput value={scopeId} onChange={(e) => setScopeId(e.target.value)} placeholder={scope === 'PLATFORM' ? 'whatsapp' : 'task / conversation id'} />
            </Field>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon="memory" title="No memory in this scope." sub="Add karein — agent isi context ko yaad rakhega." />
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.key} className="card card-pad flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] font-mono">{m.key}</div>
                <div className="text-[13px] muted whitespace-pre-wrap">{m.value}</div>
              </div>
              <button onClick={() => remove(m.key)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Delete">
                <Icon d={paths.trash} className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title={`Add memory — ${scope}`} onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <Field label="Key"><TextInput value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. reply_style" /></Field>
            <Field label="Value"><TextArea rows={3} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="e.g. Short Roman Urdu replies, friendly tone" /></Field>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!form.key.trim()} onClick={save}>Save</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
