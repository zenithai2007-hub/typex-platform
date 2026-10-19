'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, EmptyState, Select } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface SavedOutput { agentId: string; instruction: string; text: string; at: number }

export default function OutputPage() {
  const { agents } = useTx();
  const [list, setList] = useState<SavedOutput[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    try {
      setList(JSON.parse(localStorage.getItem('clintx-outputs') ?? '[]'));
    } catch {
      setList([]);
    }
  }, []);

  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? 'Agent';
  const shown = list.filter((o) => filter === 'ALL' || o.agentId === filter);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div>
      <PageHead
        title="Output"
        sub="Workspace mein generate kiye gaye outputs — is device par saved."
        actions={
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Agent filter" className="!w-44">
            <option value="ALL">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        }
      />
      {shown.length === 0 ? (
        <EmptyState
          icon="output"
          title="No outputs yet."
          sub="Workspace mein kuch generate karein — woh yahan save hoga."
          action={<Link href="/workspace"><span className="tx-btn btn-primary">Open Workspace</span></Link>}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((o, i) => (
            <div key={`${o.at}-${i}`} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-white/10 bg-purple-50/60 dark:bg-txpurple/10">
                <span className="w-6 h-6 rounded-lg bg-txpurple text-white flex items-center justify-center shrink-0">
                  <Icon d={paths.sparkle} className="w-3.5 h-3.5" />
                </span>
                <span className="text-[12px] font-bold uppercase tracking-wide text-txpurple dark:text-violet-300">Clint X output</span>
                <span className="text-[11.5px] muted ml-1">{agentName(o.agentId)}</span>
                <span className="text-[11px] muted ml-auto">{new Date(o.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="px-4 py-3">
                <div className="text-[12px] muted mb-1.5">Instruction: <span className="text-slate-700 dark:text-slate-300">{o.instruction}</span></div>
                <p className={`text-[13.5px] whitespace-pre-wrap ${expanded === i ? '' : 'line-clamp-4'}`}>{o.text}</p>
              </div>
              <div className="flex gap-1.5 px-4 py-2.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]">
                <button onClick={() => copy(o.text)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-slate-200">
                  <Icon d={paths.copy} className="w-3.5 h-3.5" /> Copy
                </button>
                <button onClick={() => setExpanded(expanded === i ? null : i)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10">
                  {expanded === i ? 'Collapse' : 'Expand'}
                </button>
                <span className="ml-auto text-[11px] muted self-center">{o.text.split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
