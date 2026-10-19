'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead, Field, ConfirmButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Lead {
  id: string; name: string; contact: string; platform: string;
  company?: string; notes?: string; source: string; status: string; createdAt: string;
}

const STATUSES = ['NEW', 'MESSAGED', 'REPLIED', 'WON', 'LOST'];

export default function OutreachPage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', contact: '', platform: 'whatsapp', company: '', notes: '', source: '' });
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyDraft, setBusyDraft] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      const d = await api('/api/outreach');
      setLeads(d.leads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function addLead() {
    try {
      await api('/api/outreach', { method: 'POST', body: form });
      setForm({ name: '', contact: '', platform: 'whatsapp', company: '', notes: '', source: '' });
      setAdding(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function setStatus(l: Lead, status: string) {
    await api('/api/outreach', { method: 'PATCH', body: { id: l.id, status } });
    load();
  }

  async function remove(id: string) {
    await api(`/api/outreach?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function draftMessage(l: Lead) {
    setBusyDraft(l.id);
    setError('');
    try {
      const d = await api('/api/outreach/message', { method: 'POST', body: { lead: l } });
      setDrafts((p) => ({ ...p, [l.id]: d.text }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyDraft('');
    }
  }

  async function queueSend(l: Lead) {
    setError('');
    setNotice('');
    const text = drafts[l.id];
    if (!text?.trim()) { setError('Pehle message draft karein.'); return; }
    try {
      await api('/api/outreach/send', { method: 'POST', body: { leadId: l.id, text } });
      await api('/api/outreach', { method: 'PATCH', body: { id: l.id, status: 'MESSAGED' } });
      setNotice(`"${l.name}" ke liye send approval queue mein chala gaya.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <PageHead
        title="Outreach"
        sub="Manual leads — har send approval-gated. Koi bulk spam tooling nahi."
        action={
          <button className="tx-btn btn-primary text-xs" onClick={() => setAdding((v) => !v)}>
            <Icon d={paths.plus} className="w-4 h-4" /> Lead add karein
          </button>
        }
      />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}
      {notice && <div className="glass-soft p-3 mb-4 text-sm text-emerald-300">{notice} <Link href="/approvals" className="underline">Approvals dekhein →</Link></div>}

      <div className="glass-soft p-4 mb-4 text-xs text-white/55">
        <span className="text-txorange font-semibold">Note:</span> TYPE X bulk spam tool nahi hai. Har lead manually add hota hai
        (source/consent lazmi hai), har message aap approve karne ke baad hi send hota hai — ek-ek karke.
      </div>

      {adding && (
        <div className="glass p-5 mb-4 fade-up">
          <h3 className="font-bold mb-3">Naya lead</h3>
          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Naam *"><input className="tx-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Contact (phone) *"><input className="tx-input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+92…" /></Field>
            <Field label="Platform *">
              <select className="tx-input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                <option value="whatsapp">WhatsApp</option>
                <option value="generic-web">Website</option>
              </select>
            </Field>
            <Field label="Company"><input className="tx-input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            <Field label="Notes"><input className="tx-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <Field label="Source / consent *"><input className="tx-input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Kahan se mila, consent kyun hai" /></Field>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="tx-btn btn-primary text-xs" disabled={!form.name.trim() || !form.contact.trim() || !form.source.trim()} onClick={addLead}>
              <Icon d={paths.check} className="w-4 h-4" /> Add lead
            </button>
            <button className="tx-btn btn-ghost text-xs" onClick={() => setAdding(false)}>Radd</button>
          </div>
        </div>
      )}

      {leads === null ? (
        <Spinner label="Leads load ho rahe hain…" />
      ) : leads.length === 0 ? (
        <Empty title="Koi lead nahi" hint="'Lead add karein' se shuru karein." />
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <div key={l.id} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold">{l.name} {l.company && <span className="text-white/50 font-normal">· {l.company}</span>}</div>
                  <div className="text-xs text-white/50 font-mono mt-0.5">{l.contact} · {l.platform}</div>
                  {l.notes && <div className="text-xs text-white/55 mt-1">{l.notes}</div>}
                  <div className="text-xs text-white/35 mt-1">Source: {l.source}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select className="tx-input !w-auto !py-1.5 text-xs" value={l.status} onChange={(e) => setStatus(l, e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <Pill status={l.status} />
                </div>
              </div>

              {drafts[l.id] ? (
                <div className="mt-3">
                  <textarea className="tx-input" rows={4} value={drafts[l.id]} onChange={(e) => setDrafts((p) => ({ ...p, [l.id]: e.target.value }))} />
                  <div className="flex gap-2 mt-2">
                    <button className="tx-btn btn-action text-xs" onClick={() => queueSend(l)}>
                      <Icon d={paths.send} className="w-4 h-4" /> Send — approval queue mein
                    </button>
                    <button className="tx-btn btn-ghost text-xs" onClick={() => draftMessage(l)}>Dobara draft</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <button className="tx-btn btn-ghost text-xs" disabled={busyDraft === l.id} onClick={() => draftMessage(l)}>
                    <Icon d={paths.edit} className="w-4 h-4" /> {busyDraft === l.id ? 'Likh raha…' : 'Personalized message'}
                  </button>
                  <ConfirmButton label="Delete" confirmLabel="Delete pakka?" onConfirm={() => remove(l.id)} className="text-xs !px-3" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
