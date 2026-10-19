'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Spinner, ErrorBox, PageHead, Field } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Agent { id: string; name: string; platformId: string }
interface Style { id: string; name: string; tone?: string; language?: string; length?: string; format?: string }

async function generateSSE(body: Record<string, unknown>, onToken: (t: string) => void): Promise<string> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error('Generate failed.');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim().replace(/^data:\s*/, '');
      if (!line) continue;
      try {
        const obj = JSON.parse(line) as { token?: string; done?: boolean; text?: string; error?: string };
        if (obj.error) throw new Error(obj.error);
        if (obj.token) { full += obj.token; onToken(obj.token); }
        if (obj.done && obj.text) full = obj.text;
      } catch (e) {
        if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
      }
    }
  }
  return full;
}

export default function WorkspacePage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [activeStyleId, setActiveStyleId] = useState<string>('');
  const [ctrl, setCtrl] = useState({ tone: '', language: 'Roman Urdu', length: '', format: '' });
  const [platform, setPlatform] = useState('whatsapp');
  const [agentId, setAgentId] = useState('');
  const [recipient, setRecipient] = useState('');
  const outRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api('/api/agents').then((d) => {
      const list: Agent[] = d.agents ?? [];
      setAgents(list);
      const wa = list.find((a) => a.platformId === 'whatsapp');
      setAgentId(wa?.id ?? list[0]?.id ?? '');
      if (wa) setPlatform(wa.platformId);
    }).catch(() => {});
    api('/api/styles').then((d) => {
      setStyles(d.styles ?? []);
      if (d.activeId) setActiveStyleId(d.activeId);
    }).catch(() => {});
  }, []);

  function activeStyle(): Style | undefined {
    return styles.find((s) => s.id === activeStyleId);
  }

  function styleFor(over: Partial<Style> = {}) {
    const s = activeStyle();
    return {
      tone: over.tone ?? ctrl.tone ?? s?.tone,
      language: over.language ?? ctrl.language ?? s?.language,
      length: over.length ?? ctrl.length ?? s?.length,
      format: over.format ?? ctrl.format ?? s?.format,
    };
  }

  async function run(instruction: string, style: ReturnType<typeof styleFor>) {
    setError('');
    setNotice('');
    setGenerating(true);
    setOutput('');
    try {
      const text = await generateSSE({ instruction, style }, (t) => {
        setOutput((prev) => prev + t);
        outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
      });
      setOutput(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  const base = () => styleFor();

  async function copy() {
    await navigator.clipboard.writeText(output);
    setNotice('Copied — clipboard mein.');
  }

  async function save() {
    if (!output.trim()) return;
    await api('/api/memory', {
      method: 'POST',
      body: { scope: 'GLOBAL', scopeId: 'workspace', key: `saved:${Date.now()}`, value: output },
    });
    setNotice('Saved — Memory > GLOBAL / workspace mein milega.');
  }

  async function execute() {
    setError('');
    setNotice('');
    if (!output.trim()) { setError('Pehle kuch generate karein.'); return; }
    if (!recipient.trim()) { setError('Recipient (phone number) zaroori hai EXECUTE ke liye.'); return; }
    try {
      const d = await api('/api/approvals', {
        method: 'POST',
        body: {
          agentId,
          action: 'send_message',
          preview: output,
          payload: {
            id: 'plan-' + Date.now(), agentId, kind: 'send_message', platformId: platform,
            payload: { to: recipient.trim(), text: output }, mode: 'api', requiresApproval: false,
            createdAt: new Date().toISOString(),
          },
        },
      });
      setNotice(`Approval queue mein chala gaya. Approve karne par hi send hoga.`);
      void d;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const actions = [
    { label: 'Copy', icon: 'copy', fn: copy, disabled: !output || generating },
    { label: 'Edit', icon: 'edit', fn: () => { setEditText(output); setEditing(true); }, disabled: !output || generating },
    { label: 'Regenerate', icon: 'refresh', fn: () => run(input, base()), disabled: !input.trim() || generating },
    { label: 'Shorten', icon: 'bolt', fn: () => run(`Is text ko aadha kar do, meaning same rakho:\n\n${output}`, base()), disabled: !output || generating },
    { label: 'Expand', icon: 'plus', fn: () => run(`Is text ko detail se expand karo, tone same rakho:\n\n${output}`, base()), disabled: !output || generating },
    { label: 'Translate', icon: 'globe', fn: () => run(`Is text ka tarjuma karo (${ctrl.language}):\n\n${output}`, styleFor({ language: ctrl.language })), disabled: !output || generating },
    { label: 'Change Tone', icon: 'styles', fn: () => run(`Is text ko "${ctrl.tone || 'friendly professional'}" tone mein dobara likho:\n\n${output}`, base()), disabled: !output || generating },
    { label: 'Format', icon: 'workspace', fn: () => run(`Is text ko "${ctrl.format || 'clean paragraphs'}" format mein do:\n\n${output}`, base()), disabled: !output || generating },
    { label: 'Insert', icon: 'send', fn: async () => { await navigator.clipboard.writeText(output); setNotice('Copied — target page/app mein paste karein (Assisted Mode).'); }, disabled: !output || generating },
    { label: 'Execute', icon: 'bolt', fn: execute, accent: true, disabled: !output || generating },
    { label: 'Save', icon: 'download', fn: save, disabled: !output || generating },
  ];

  return (
    <div>
      <PageHead title="Workspace" sub="Output-first — input left, output center, controls right." />

      {error && <div className="mb-4"><ErrorBox message={error} /></div>}
      {notice && <div className="glass-soft p-3 mb-4 text-sm text-emerald-300">{notice} <Link href="/approvals" className="underline">Approvals dekhein →</Link></div>}

      <div className="grid lg:grid-cols-[1fr_1.5fr_250px] gap-4">
        {/* LEFT — input */}
        <div className="glass p-5">
          <h3 className="font-bold mb-3">Input</h3>
          <textarea
            className="tx-input min-h-[220px]"
            placeholder="Kya generate karna hai? Yahan likhein…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="tx-btn btn-primary w-full mt-3" disabled={!input.trim() || generating} onClick={() => run(input, base())}>
            <Icon d={paths.bolt} className="w-4 h-4" />
            {generating ? 'Generating…' : 'Generate'}
          </button>
          <p className="text-xs text-white/40 mt-3">
            Tip: tone/style right side se set karein, phir Generate dabayein.
          </p>
        </div>

        {/* CENTER — output */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">Output</h3>
            {generating && <span className="chip"><span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-txviolet" /> Streaming…</span>}
          </div>
          {editing ? (
            <div>
              <textarea className="tx-input min-h-[220px]" value={editText} onChange={(e) => setEditText(e.target.value)} />
              <div className="flex gap-2 mt-3">
                <button className="tx-btn btn-primary text-xs" onClick={() => { setOutput(editText); setEditing(false); }}>
                  <Icon d={paths.check} className="w-4 h-4" /> Done
                </button>
                <button className="tx-btn btn-ghost text-xs" onClick={() => setEditing(false)}>Radd</button>
              </div>
            </div>
          ) : (
            <div ref={outRef} className="glass-soft min-h-[220px] max-h-[420px] overflow-y-auto p-4 text-sm whitespace-pre-wrap">
              {output ? output : <span className="text-white/35">Output yahan ayega…</span>}
              {generating && <span className="live-dot inline-block w-2 h-4 bg-txviolet ml-1 align-middle" />}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {actions.map((a) => (
              <button
                key={a.label}
                className={`tx-btn text-xs !px-3 ${a.accent ? 'btn-action' : 'btn-ghost'}`}
                disabled={a.disabled}
                onClick={a.fn}
              >
                <Icon d={paths[a.icon as keyof typeof paths]} className="w-3.5 h-3.5" />
                {a.label.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT — controls */}
        <div className="glass p-5 space-y-3">
          <h3 className="font-bold">Controls</h3>
          <Field label="Style preset">
            <select className="tx-input" value={activeStyleId} onChange={(e) => setActiveStyleId(e.target.value)}>
              <option value="">(koi nahi)</option>
              {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Tone">
            <input className="tx-input" value={ctrl.tone} onChange={(e) => setCtrl({ ...ctrl, tone: e.target.value })} placeholder="e.g. friendly, formal" />
          </Field>
          <Field label="Language">
            <select className="tx-input" value={ctrl.language} onChange={(e) => setCtrl({ ...ctrl, language: e.target.value })}>
              <option>Roman Urdu</option>
              <option>English</option>
              <option>Urdu</option>
            </select>
          </Field>
          <Field label="Length">
            <select className="tx-input" value={ctrl.length} onChange={(e) => setCtrl({ ...ctrl, length: e.target.value })}>
              <option value="">(default)</option>
              <option>short</option>
              <option>medium</option>
              <option>long</option>
            </select>
          </Field>
          <Field label="Format">
            <input className="tx-input" value={ctrl.format} onChange={(e) => setCtrl({ ...ctrl, format: e.target.value })} placeholder="e.g. bullet list" />
          </Field>
          <Field label="Agent (execute ke liye)">
            <select className="tx-input" value={agentId} onChange={(e) => { setAgentId(e.target.value); const a = agents.find((x) => x.id === e.target.value); if (a) setPlatform(a.platformId); }}>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Recipient phone (EXECUTE)">
            <input className="tx-input" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="+92…" />
          </Field>
          {generating && <Spinner label="Streaming…" />}
        </div>
      </div>
    </div>
  );
}
