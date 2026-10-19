'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Spinner, ErrorBox, Empty, PageHead, Field, ConfirmButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Style { id: string; name: string; tone?: string; language?: string; length?: string; format?: string }

const PRESETS: Omit<Style, 'id'>[] = [
  { name: 'Friendly Roman Urdu', tone: 'friendly', language: 'Roman Urdu', length: 'medium' },
  { name: 'Professional English', tone: 'formal', language: 'English', length: 'medium' },
  { name: 'Short & Punchy', tone: 'casual', language: 'Roman Urdu', length: 'short' },
  { name: 'Sales Closer', tone: 'persuasive', language: 'Roman Urdu', length: 'medium' },
];

export default function StylesPage() {
  const [styles, setStyles] = useState<Style[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', tone: '', language: 'Roman Urdu', length: '', format: '' });
  const [editing, setEditing] = useState<Style | null>(null);

  async function load() {
    setError('');
    try {
      const d = await api('/api/styles');
      setStyles(d.styles ?? []);
      setActiveId(d.activeId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    try {
      await api('/api/styles', { method: 'POST', body: { ...(editing ? { id: editing.id } : {}), ...form } });
      setForm({ name: '', tone: '', language: 'Roman Urdu', length: '', format: '' });
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function activate(id: string) {
    await api('/api/styles', { method: 'POST', body: { id, name: styles?.find((s) => s.id === id)?.name ?? 'style', activate: true } });
    load();
  }

  async function remove(id: string) {
    await api(`/api/styles?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function addPreset(p: Omit<Style, 'id'>) {
    await api('/api/styles', { method: 'POST', body: p });
    load();
  }

  return (
    <div>
      <PageHead title="Styles" sub="Tone presets — workspace generation inhi styles se chalti hai." />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      <div className="glass p-5 mb-4">
        <h3 className="font-bold mb-3">Ready-made presets</h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.name} className="tx-btn btn-ghost text-xs" onClick={() => addPreset(p)}>
              <Icon d={paths.plus} className="w-3.5 h-3.5" /> {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="glass p-5 mb-4">
        <h3 className="font-bold mb-3">{editing ? 'Style edit karein' : 'Custom style banayein'}</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Naam"><input className="tx-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Meri Style" /></Field>
          <Field label="Tone"><input className="tx-input" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} placeholder="friendly, formal…" /></Field>
          <Field label="Language">
            <select className="tx-input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
              <option>Roman Urdu</option><option>English</option><option>Urdu</option>
            </select>
          </Field>
          <Field label="Length">
            <select className="tx-input" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })}>
              <option value="">(default)</option><option>short</option><option>medium</option><option>long</option>
            </select>
          </Field>
          <Field label="Format"><input className="tx-input" value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="bullet list…" /></Field>
        </div>
        <div className="flex gap-2 mt-4">
          <button className="tx-btn btn-primary text-xs" disabled={!form.name.trim()} onClick={save}>
            <Icon d={paths.check} className="w-4 h-4" /> {editing ? 'Update' : 'Banayein'}
          </button>
          {editing && <button className="tx-btn btn-ghost text-xs" onClick={() => { setEditing(null); setForm({ name: '', tone: '', language: 'Roman Urdu', length: '', format: '' }); }}>Radd</button>}
        </div>
      </div>

      {styles === null ? (
        <Spinner label="Styles load ho rahe hain…" />
      ) : styles.length === 0 ? (
        <Empty title="Koi style nahi" hint="Upar preset ya custom banayein." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {styles.map((s) => (
            <div key={s.id} className={`glass p-4 ${activeId === s.id ? '!border-txviolet/60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="font-bold">{s.name}</div>
                {activeId === s.id && <span className="chip !border-txviolet/50 text-txviolet">ACTIVE</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[s.tone && `tone: ${s.tone}`, s.language && `lang: ${s.language}`, s.length && `len: ${s.length}`, s.format && `fmt: ${s.format}`].filter(Boolean).map((t) => (
                  <span key={String(t)} className="chip">{t}</span>
                ))}
              </div>
              <div className="flex gap-1.5 mt-3">
                {activeId !== s.id && <button className="tx-btn btn-ghost text-xs !px-3" onClick={() => activate(s.id)}>Activate</button>}
                <button className="tx-btn btn-ghost text-xs !px-3" onClick={() => { setEditing(s); setForm({ name: s.name, tone: s.tone ?? '', language: s.language ?? 'Roman Urdu', length: s.length ?? '', format: s.format ?? '' }); }}>Edit</button>
                <ConfirmButton label="Delete" confirmLabel="Delete pakka?" onConfirm={() => remove(s.id)} className="text-xs !px-3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
