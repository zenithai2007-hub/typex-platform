'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtTime } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Modal, Field, TextInput, TextArea, Select, EmptyState, Skeleton, ErrorBox, Notice, OutcomeChip } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Lead {
  id: string; name: string; contact: string; platform: string;
  company?: string; notes?: string; source?: string; status: string;
  lastContacted?: string; optOut?: boolean;
}

/** Authorized outreach only: user-provided leads, personalized messages,
 *  approval gate before every send. No bulk, no spam tooling. */
export default function OutreachPage() {
  const { bump } = useTx();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', platform: 'whatsapp', company: '', notes: '', source: '' });
  const [genFor, setGenFor] = useState<Lead | null>(null);
  const [genText, setGenText] = useState('');
  const [genObjective, setGenObjective] = useState('Introduce Clint X and start a genuine conversation');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api('/api/outreach')
      .then((d) => setLeads(d.leads ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function add() {
    try {
      await api('/api/outreach', { method: 'POST', body: form });
      setNotice('Lead add ho gaya.');
      setShowAdd(false);
      setForm({ name: '', contact: '', platform: 'whatsapp', company: '', notes: '', source: '' });
      const d = await api('/api/outreach');
      setLeads(d.leads ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function generate(lead: Lead) {
    setGenFor(lead);
    setGenText('');
    setGenerating(true);
    try {
      const d = await api('/api/outreach/message', { method: 'POST', body: { lead, objective: genObjective } });
      setGenText(d.text ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function queueSend() {
    if (!genFor || !genText.trim()) return;
    try {
      const d = await api('/api/outreach/send', { method: 'POST', body: { leadId: genFor.id, text: genText } });
      setNotice(`Approval queue mein chala gaya. Approvals page par approve karein — bina approval kuch nahi jayega.`);
      setGenFor(null);
      setGenText('');
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleOptOut(l: Lead) {
    await api('/api/outreach', { method: 'PATCH', body: { id: l.id, optOut: !l.optOut } }).catch(() => {});
    setLeads((p) => p.map((x) => (x.id === l.id ? { ...x, optOut: !x.optOut } : x)));
  }

  async function remove(id: string) {
    if (!confirm('Is lead ko delete karein?')) return;
    await api(`/api/outreach?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setLeads((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div>
      <PageHead
        title="Outreach"
        sub="Sirf authorized leads — personalized message, har send se pehle approval. No bulk spam, no bypass."
        actions={<Btn variant="primary" icon="plus" onClick={() => setShowAdd(true)}>Add lead</Btn>}
      />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      {loading ? (
        <div className="space-y-2.5">{[0, 1].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : leads.length === 0 ? (
        <EmptyState
          icon="outreach"
          title="No leads."
          sub="Apne authorized contacts add karein — Clint X personalized message banayega."
          action={<Btn variant="primary" icon="plus" onClick={() => setShowAdd(true)}>Add lead</Btn>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[13px] min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-left">
                {['Name', 'Contact', 'Platform', 'Status', 'Last contact', ''].map((h) => (
                  <th key={h} className="font-semibold p-3 text-[12px] muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className={`border-b border-slate-100 dark:border-white/5 last:border-0 ${l.optOut ? 'opacity-50' : ''}`}>
                  <td className="p-3">
                    <div className="font-semibold">{l.name}</div>
                    {l.company && <div className="text-[11px] muted">{l.company}</div>}
                  </td>
                  <td className="p-3 font-mono text-[12px]">{l.contact}</td>
                  <td className="p-3 capitalize">{l.platform}</td>
                  <td className="p-3">
                    {l.optOut ? <span className="chip chip-red">Opted out</span> : <OutcomeChip outcome={l.status || 'NEW'} />}
                  </td>
                  <td className="p-3 text-[12px] muted">{l.lastContacted ? fmtTime(l.lastContacted) : '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-1 justify-end">
                      <Btn size="xs" variant="primary" icon="sparkle" disabled={l.optOut} onClick={() => generate(l)}>Message</Btn>
                      <Btn size="xs" onClick={() => toggleOptOut(l)}>{l.optOut ? 'Re-enable' : 'Opt out'}</Btn>
                      <button onClick={() => remove(l.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" aria-label="Delete lead">
                        <Icon d={paths.trash} className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <Modal title="Add lead" onClose={() => setShowAdd(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Contact *"><TextInput value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="phone / handle" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Platform *">
                <Select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="email">Email</option>
                </Select>
              </Field>
              <Field label="Company"><TextInput value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><TextInput value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Context — message personalize karne ke liye" /></Field>
            <Field label="Source / consent" hint="Kahan se mila — consent ka proof yahin likhein."><TextInput value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. inbound form, referral" /></Field>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!form.name.trim() || !form.contact.trim() || !form.platform.trim()} onClick={add}>Add lead</Btn>
            </div>
          </div>
        </Modal>
      )}

      {genFor && (
        <Modal title={`Message — ${genFor.name}`} onClose={() => setGenFor(null)} wide>
          <div className="space-y-3">
            <Field label="Objective">
              <TextInput value={genObjective} onChange={(e) => setGenObjective(e.target.value)} />
            </Field>
            {generating ? (
              <div className="text-[13px] muted py-6 text-center">Personalized message ban raha hai…</div>
            ) : (
              <TextArea rows={6} value={genText} onChange={(e) => setGenText(e.target.value)} />
            )}
            <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/5 p-3 text-[12.5px]">
              Send dabane par message <strong>foran nahi jayega</strong> — pehle approval queue mein jayega. <Link href="/approvals" className="text-txpurple font-semibold underline">Approvals</Link> par approve karein tabhi execute hoga.
            </div>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setGenFor(null)}>Close</Btn>
              <Btn variant="action" icon="send" disabled={!genText.trim() || generating} onClick={queueSend}>
                Queue for approval
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
