'use client';

import { useState } from 'react';
import { api } from '@/lib/client';
import { useTx } from './tx-store';
import { Icon, paths } from './icons';
import { Btn, Spinner, ErrorBox, Notice } from './ui';

export interface OutputMeta {
  tone?: string;
  language?: string;
  length?: string;
  format?: string;
}

interface Props {
  text: string;
  generating?: boolean;
  meta?: OutputMeta;
  instruction: string;
  agentId: string;
  platformId: string;
  onRegenerate: (instruction: string, style: Record<string, string | undefined>) => void;
  style: Record<string, string | undefined>;
}

/** Rich output-first card. Send/Execute appears ONLY when the platform really
 *  supports it AND the integration is configured — otherwise Copy/Insert. */
export default function OutputCard({
  text,
  generating,
  meta,
  instruction,
  agentId,
  platformId,
  onRegenerate,
  style,
}: Props) {
  const { status, setRightTab, setRightOpen } = useTx();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState('');
  const [capabilities, setCapabilities] = useState<string[] | null>(null);

  // Load platform capabilities once (honest capability gating).
  useState(() => {
    api('/api/platforms')
      .then((d) => {
        const p = (d.platforms ?? []).find((x: { id: string }) => x.id === platformId);
        setCapabilities(p?.adapterCapabilities ?? p?.capabilities ?? []);
      })
      .catch(() => setCapabilities([]));
  });

  const body = editing ? editText : text;
  const canSend =
    capabilities !== null &&
    capabilities.includes('SEND_MESSAGE') &&
    (platformId !== 'whatsapp' || status?.whatsappConfigured === true);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setNotice('Copied — clipboard mein.');
    } catch {
      setError('Clipboard access blocked by the browser.');
    }
  }

  function insert() {
    // Honest assisted insert: keyboard/extension insertion ships in Phase 2.
    copy().then(() => setNotice('Clipboard mein copy ho gaya — target app mein paste karein (assisted insert).'));
  }

  function transform(kind: 'shorten' | 'expand' | 'translate' | 'tone') {
    const prompts: Record<string, string> = {
      shorten: `Is text ko short karo, meaning same rakho:\n\n${body}`,
      expand: `Is text ko expand karo, detail add karo:\n\n${body}`,
      translate: `Is text ko ${style.language === 'English' ? 'Roman Urdu' : 'English'} mein translate karo:\n\n${body}`,
      tone: `Is text ka tone change karo (current: ${style.tone || meta?.tone || 'default'}), baqi same rakho:\n\n${body}`,
    };
    onRegenerate(prompts[kind], style);
  }

  async function approveAndSend() {
    if (!to.trim()) {
      setError('Recipient phone number likhein (e.g. 923001234567).');
      return;
    }
    setSending(true);
    setError('');
    try {
      // 1. Create a real PENDING approval (never executes on creation).
      const created = await api('/api/approvals', {
        method: 'POST',
        body: { agentId, action: 'send_message', preview: body, payload: { to: to.trim(), text: body }, platformId },
      });
      // 2. User already confirmed in-card → approve → orchestrator executes for real.
      const res = await api(`/api/approvals/${created.approval.id}/decision`, {
        method: 'POST',
        body: { decision: 'approved' },
      });
      const r = res?.result;
      if (r && r.ok === true) {
        setNotice('Sent — platform ne confirm kiya.');
      } else {
        setError(`Send failed: ${r?.message ?? r?.code ?? 'adapter ne confirm nahi kiya.'}`);
      }
      setConfirming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  const actions: { label: string; icon: string; fn: () => void; primary?: boolean }[] = [
    { label: 'Copy', icon: 'copy', fn: copy },
    { label: editing ? 'Done' : 'Edit', icon: 'edit', fn: () => { setEditText(body); setEditing(!editing); } },
    { label: 'Regenerate', icon: 'refresh', fn: () => onRegenerate(instruction, style) },
    { label: 'Shorten', icon: 'zap', fn: () => transform('shorten') },
    { label: 'Expand', icon: 'plus', fn: () => transform('expand') },
    { label: 'Translate', icon: 'globe', fn: () => transform('translate') },
    { label: 'Change tone', icon: 'sparkle', fn: () => transform('tone') },
    { label: 'Insert', icon: 'send', fn: insert },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-purple-50/60 dark:bg-txpurple/10">
        <span className="w-6 h-6 rounded-lg bg-txpurple text-white flex items-center justify-center shrink-0">
          <Icon d={paths.sparkle} className="w-3.5 h-3.5" />
        </span>
        <span className="text-[12px] font-bold uppercase tracking-wide text-txpurple dark:text-violet-300">
          Clint X output
        </span>
        {generating && <Spinner className="w-3.5 h-3.5 text-txpurple" />}
        <div className="ml-auto flex gap-1.5">
          {meta?.tone && <span className="chip">{meta.tone}</span>}
          {meta?.language && <span className="chip">{meta.language}</span>}
          {meta?.length && <span className="chip">{meta.length}</span>}
        </div>
      </div>

      <div className="px-4 py-3.5">
        {editing ? (
          <textarea
            className="tx-input min-h-[120px] font-normal"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
        ) : (
          <div className={`text-[14px] leading-relaxed whitespace-pre-wrap text-slate-800 dark:text-slate-100 ${generating ? 'typing-caret' : ''}`}>
            {body || (generating ? '' : '—')}
          </div>
        )}
        {!generating && body && (
          <div className="text-[11px] muted mt-2">
            {body.split(/\s+/).filter(Boolean).length} words · {body.length} chars
          </div>
        )}
      </div>

      <ErrorBox msg={error} onClose={() => setError('')} />
      {notice && <div className="px-4 pb-1"><Notice msg={notice} onClose={() => setNotice('')} /></div>}

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.fn}
            disabled={generating || !body}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-slate-200 dark:hover:border-white/10 disabled:opacity-40"
          >
            <Icon d={paths[a.icon as keyof typeof paths]} className="w-3.5 h-3.5" />
            {a.label}
          </button>
        ))}
        {canSend ? (
          <Btn size="sm" variant="action" icon="send" disabled={generating || !body || sending} onClick={() => setConfirming(true)} className="ml-auto">
            Approve & Send
          </Btn>
        ) : (
          <span className="ml-auto text-[11px] muted" title="This platform connection does not support direct send">
            Direct send not supported for this connection
          </span>
        )}
      </div>

      {confirming && (
        <div className="px-4 py-3 border-t border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/5">
          <div className="text-[13px] font-semibold mb-2">WhatsApp par bhejein? Pehle recipient confirm karein.</div>
          <div className="flex flex-wrap gap-2">
            <input
              className="tx-input !w-52"
              placeholder="923001234567"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Btn size="sm" variant="action" disabled={sending} onClick={approveAndSend}>
              {sending ? <Spinner className="w-3.5 h-3.5" /> : 'Confirm & Send'}
            </Btn>
            <Btn size="sm" onClick={() => setConfirming(false)}>Cancel</Btn>
          </div>
          <div className="text-[11px] muted mt-1.5">
            Approval banegi aur foran approve hogi — execution ka result yahin dikhega. Bina confirm ke kuch nahi jayega.
          </div>
        </div>
      )}
    </div>
  );
}
