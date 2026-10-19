'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Modal, Field, TextInput, TextArea, Select, EmptyState, Skeleton, ErrorBox, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Style {
  id: string; name: string; tone?: string; language?: string; length?: string;
  format?: string; description?: string; examples?: string;
}

const TONES = ['', 'Professional', 'Friendly', 'Casual', 'Formal', 'Persuasive', 'Confident', 'Funny', 'Simple', 'Technical', 'Romantic', 'Business'];
const LANGS = ['', 'English', 'Urdu', 'Roman Urdu', 'Hindi', 'Arabic', 'Spanish', 'French', 'German'];
const LENGTHS = ['', 'Short', 'Medium', 'Long'];
const FORMATS = ['', 'Plain Text', 'Paragraphs', 'Bullets', 'Numbered List', 'Email', 'Social Media'];

const empty: Style = { id: '', name: '', tone: '', language: 'Roman Urdu', length: '', format: '', description: '', examples: '' };

export default function StylesPage() {
  const [styles, setStyles] = useState<Style[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<Style>(empty);

  useEffect(() => {
    api('/api/styles')
      .then((d) => {
        setStyles(d.styles ?? []);
        setActiveId(d.activeId ?? '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function save(activate = false) {
    try {
      await api('/api/styles', { method: 'POST', body: { ...form, activate } });
      setNotice(activate ? `"${form.name}" activate ho gaya.` : 'Style save ho gaya.');
      setShowEdit(false);
      const d = await api('/api/styles');
      setStyles(d.styles ?? []);
      setActiveId(d.activeId ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!confirm('Is style ko delete karein?')) return;
    await api(`/api/styles?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setStyles((p) => p.filter((s) => s.id !== id));
  }

  function openNew() {
    setForm({ ...empty, id: `style-${Date.now()}` });
    setShowEdit(true);
  }

  return (
    <div>
      <PageHead
        title="Styles"
        sub="Apni writing styles save karein — workspace har generation mein use karega."
        actions={<Btn variant="primary" icon="plus" onClick={openNew}>New style</Btn>}
      />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : styles.length === 0 ? (
        <EmptyState icon="styles" title="No saved styles." sub='"My WhatsApp Style" jaisi custom styles banayein.' action={<Btn variant="primary" icon="plus" onClick={openNew}>New style</Btn>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {styles.map((s) => (
            <div key={s.id} className={`card card-pad card-hover ${s.id === activeId ? 'border-purple-300 dark:border-txpurple/50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-[14px]">{s.name}</div>
                {s.id === activeId && <span className="chip chip-purple">Active</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[s.tone, s.language, s.length, s.format].filter(Boolean).map((x) => (
                  <span key={x} className="chip">{x}</span>
                ))}
              </div>
              {s.description && <p className="text-[12.5px] muted mt-2">{s.description}</p>}
              <div className="flex gap-1.5 mt-3">
                {s.id !== activeId && <Btn size="xs" variant="primary" onClick={() => { setForm(s); save(true); }}>Activate</Btn>}
                <Btn size="xs" icon="edit" onClick={() => { setForm(s); setShowEdit(true); }}>Edit</Btn>
                <Btn size="xs" icon="copy" onClick={() => { setForm({ ...s, id: `style-${Date.now()}`, name: `${s.name} (copy)` }); setShowEdit(true); }}>Duplicate</Btn>
                <Btn size="xs" variant="danger" icon="trash" onClick={() => remove(s.id)} className="ml-auto">Delete</Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEdit && (
        <Modal title={form.name ? `Edit — ${form.name}` : 'New style'} onClose={() => setShowEdit(false)} wide>
          <div className="space-y-3">
            <Field label="Name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. My WhatsApp Style" /></Field>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Tone"><Select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>{TONES.map((t) => <option key={t} value={t}>{t || '—'}</option>)}</Select></Field>
              <Field label="Language"><Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>{LANGS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}</Select></Field>
              <Field label="Length"><Select value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })}>{LENGTHS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}</Select></Field>
              <Field label="Format"><Select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}>{FORMATS.map((t) => <option key={t} value={t}>{t || '—'}</option>)}</Select></Field>
            </div>
            <Field label="Description"><TextInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kis kaam ke liye hai" /></Field>
            <Field label="Example phrases"><TextArea rows={2} value={form.examples} onChange={(e) => setForm({ ...form, examples: e.target.value })} placeholder="Preferred phrases…" /></Field>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setShowEdit(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!form.name.trim()} onClick={() => save(false)}>Save</Btn>
              <Btn variant="action" icon="check" disabled={!form.name.trim()} onClick={() => save(true)}>Save & activate</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
