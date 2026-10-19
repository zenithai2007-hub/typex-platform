'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { Btn, StatusChip, Spinner, ErrorBox, Field, Select } from '@/components/ui';
import OutputCard from '@/components/OutputCard';

export const dynamic = 'force-dynamic';

interface Msg {
  id: string;
  role: 'user' | 'cx';
  text: string;
  instruction: string;
  meta?: { tone?: string; language?: string; length?: string; format?: string };
  at: number;
}

interface Style { id: string; name: string; tone?: string; language?: string; length?: string; format?: string }

const TONES = ['Professional', 'Friendly', 'Casual', 'Formal', 'Persuasive', 'Confident', 'Funny', 'Simple', 'Technical', 'Romantic', 'Business'];
const LANGS = ['English', 'Urdu', 'Roman Urdu', 'Hindi', 'Arabic', 'Spanish', 'French', 'German'];
const LENGTHS = ['Short', 'Medium', 'Long'];
const FORMATS = ['Plain Text', 'Paragraphs', 'Bullets', 'Numbered List', 'Email', 'Social Media'];

const EXAMPLES = [
  'Is message ka professional reply likho.',
  'Roman Urdu mein short jawab do.',
  'Is page ka summary banao.',
  'LinkedIn ke liye personalized introduction likho.',
];

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
        if (e instanceof Error && !e.message.includes('JSON')) throw e;
      }
    }
  }
  return full;
}

function saveOutput(agentId: string, instruction: string, text: string) {
  try {
    const key = 'clintx-outputs';
    const list = JSON.parse(localStorage.getItem(key) ?? '[]') as { agentId: string; instruction: string; text: string; at: number }[];
    list.unshift({ agentId, instruction, text, at: Date.now() });
    localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export default function WorkspacePage() {
  const { activeAgent, activeAgentId, refreshAgents, bump, setActiveAgentId } = useTx();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [styles, setStyles] = useState<Style[]>([]);
  const [styleId, setStyleId] = useState('');
  const [ctrl, setCtrl] = useState({ tone: 'Friendly', language: 'Roman Urdu', length: 'Short', format: 'Plain Text' });
  const [showControls, setShowControls] = useState(false);
  const [showCmds, setShowCmds] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshAgents();
    api('/api/styles').then((d) => {
      setStyles(d.styles ?? []);
      if (d.activeId) setStyleId(d.activeId);
    }).catch(() => {});
  }, [refreshAgents]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, generating]);

  const styleObj = useCallback(() => {
    const s = styles.find((x) => x.id === styleId);
    return {
      tone: s?.tone || ctrl.tone || undefined,
      language: s?.language || ctrl.language || undefined,
      length: s?.length || ctrl.length || undefined,
      format: s?.format || ctrl.format || undefined,
    };
  }, [styles, styleId, ctrl]);

  const run = useCallback(async (instruction: string, style: Record<string, string | undefined>, targetMsgId?: string) => {
    if (!instruction.trim() || generating) return;
    setError('');
    setGenerating(true);
    const uid = `u-${Date.now()}`;
    const mid = targetMsgId ?? `m-${Date.now()}`;
    if (!targetMsgId) {
      setMsgs((p) => [...p, { id: uid, role: 'user', text: instruction, instruction, at: Date.now() }]);
    }
    setMsgs((p) => {
      const without = p.filter((m) => m.id !== mid);
      return [...without, { id: mid, role: 'cx', text: '', instruction, meta: style as Msg['meta'], at: Date.now() }];
    });
    try {
      const full = await generateSSE({ instruction, style }, (t) => {
        setMsgs((p) => p.map((m) => (m.id === mid ? { ...m, text: m.text + t } : m)));
      });
      setMsgs((p) => p.map((m) => (m.id === mid ? { ...m, text: full } : m)));
      if (activeAgentId) saveOutput(activeAgentId, instruction, full);
      bump();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMsgs((p) => p.filter((m) => m.id !== mid));
    } finally {
      setGenerating(false);
    }
  }, [generating, activeAgentId, bump]);

  function send() {
    if (!input.trim()) return;
    run(input.trim(), styleObj());
    setInput('');
  }

  async function agentAction(kind: 'pause' | 'resume' | 'stop') {
    if (!activeAgentId) return;
    await api(`/api/agents/${activeAgentId}/${kind}`, { method: 'POST' }).catch((e) => setError(e.message));
    await refreshAgents();
    bump();
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] min-h-[560px]">
      {/* header */}
      <div className="card px-4 py-3 mb-3 flex items-center gap-3 shrink-0">
        <span className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-txpurple/20 text-txpurple dark:text-violet-300 flex items-center justify-center font-bold shrink-0">
          {(activeAgent?.name ?? 'C').slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[14.5px] truncate">{activeAgent?.name ?? 'No agent selected'}</div>
          <div className="text-[11.5px] muted capitalize">{(activeAgent?.platformId ?? '').replace(/_/g, ' ')}</div>
        </div>
        {activeAgent && <StatusChip status={activeAgent.status} />}
        <div className="flex gap-1.5 ml-1">
          <Btn size="sm" icon={activeAgent?.status === 'PAUSED' ? 'play' : 'pause'} onClick={() => agentAction(activeAgent?.status === 'PAUSED' ? 'resume' : 'pause')} disabled={!activeAgent}>
            {activeAgent?.status === 'PAUSED' ? 'Resume' : 'Pause'}
          </Btn>
          <Btn size="sm" icon="stop" variant="danger" onClick={() => agentAction('stop')} disabled={!activeAgent}>Stop</Btn>
          {activeAgent && (
            <Link href={`/agents/${activeAgent.id}`}><span className="tx-btn btn-ghost btn-sm"><Icon d={paths.settings} className="w-4 h-4" /></span></Link>
          )}
        </div>
      </div>

      <ErrorBox msg={error} onClose={() => setError('')} />

      {/* timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2 space-y-4 min-h-0">
        {msgs.length === 0 && (
          <div className="card card-pad text-center py-10 max-w-lg mx-auto mt-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-txpurple/20 text-txpurple dark:text-violet-300 flex items-center justify-center mx-auto mb-3">
              <Icon d={paths.sparkle} className="w-6 h-6" />
            </div>
            <div className="font-bold text-[15px]">Kya karwana hai?</div>
            <p className="text-[13px] muted mt-1 mb-4">Neeche likhein — Clint X output banyega, approval ke baad execute karega.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => run(e, styleObj())} className="chip hover:border-purple-300 dark:hover:border-txpurple/50 !py-1.5 !px-3 !text-[12px]">
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%] bg-slate-200/70 dark:bg-white/10 rounded-2xl rounded-br-md px-4 py-2.5 text-[13.5px]">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              <OutputCard
                text={m.text}
                generating={generating && !m.text}
                meta={m.meta}
                instruction={m.instruction}
                agentId={activeAgentId ?? ''}
                platformId={activeAgent?.platformId ?? 'whatsapp'}
                style={styleObj()}
                onRegenerate={(instr, st) => run(instr, st, m.id)}
              />
            </div>
          ),
        )}
        {generating && <div className="flex items-center gap-2 muted text-[12.5px]"><Spinner className="w-3.5 h-3.5" /> Clint X likh raha hai…</div>}
      </div>

      {/* controls strip */}
      {showControls && (
        <div className="card px-4 py-3 mb-2 shrink-0 grid grid-cols-2 md:grid-cols-4 gap-2.5 fade-up">
          <Field label="Tone">
            <Select value={ctrl.tone} onChange={(e) => setCtrl({ ...ctrl, tone: e.target.value })}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Language">
            <Select value={ctrl.language} onChange={(e) => setCtrl({ ...ctrl, language: e.target.value })}>
              {LANGS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Length">
            <Select value={ctrl.length} onChange={(e) => setCtrl({ ...ctrl, length: e.target.value })}>
              {LENGTHS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Format">
            <Select value={ctrl.format} onChange={(e) => setCtrl({ ...ctrl, format: e.target.value })}>
              {FORMATS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          {styles.length > 0 && (
            <Field label="Saved style">
              <Select value={styleId} onChange={(e) => setStyleId(e.target.value)}>
                <option value="">Controls use karein</option>
                {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
      )}

      {/* composer */}
      <div className="shrink-0 mt-1">
        <div className="card !rounded-2xl p-2 flex items-end gap-1.5 shadow-card">
          <div className="relative">
            <button
              onClick={() => setShowCmds(!showCmds)}
              className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center muted"
              aria-label="Commands"
              title="Examples / controls"
            >
              <Icon d={paths.plus} className="w-5 h-5" />
            </button>
            {showCmds && (
              <div className="card absolute bottom-11 left-0 w-72 p-2 z-50 shadow-pop">
                <button onClick={() => { setShowControls(!showControls); setShowCmds(false); }} className="w-full text-left px-2.5 py-2 rounded-lg text-[13px] hover:bg-slate-100 dark:hover:bg-white/5">
                  Tone / Language / Length controls
                </button>
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider muted">Examples</div>
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => { setShowCmds(false); run(e, styleObj()); }} className="w-full text-left px-2.5 py-2 rounded-lg text-[13px] hover:bg-slate-100 dark:hover:bg-white/5">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            className="flex-1 bg-transparent outline-none resize-none text-[14px] px-2 py-2 max-h-32 placeholder:text-slate-400"
            rows={1}
            placeholder="Clint X ko batao kya karna hai..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={generating || !input.trim()}
            className="w-9 h-9 rounded-xl bg-txorange hover:bg-[#f06d0a] disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition"
            aria-label="Send"
            title="Send"
          >
            {generating ? <Spinner className="w-4 h-4" /> : <Icon d={paths.send} className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-[11px] muted text-center mt-1.5">
          Enter = send · Shift+Enter = new line · {activeAgent ? `${activeAgent.name} sun raha hai` : 'Pehle agent select karein'}
        </div>
      </div>
    </div>
  );
}
