'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client';
import { useTx } from '@/components/tx-store';
import { Icon, paths } from '@/components/icons';
import { PageHead, Btn, Toggle, EmptyState, ErrorBox, Notice, Skeleton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface TxStatus {
  demoMode: boolean; whatsappConfigured: boolean; openaiConfigured: boolean;
  anthropicConfigured: boolean; aiProvider: string;
}

export default function SettingsPage() {
  const { theme, toggleTheme, status } = useTx();
  const [st, setSt] = useState<TxStatus | null>(status);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/status').then(setSt).catch(() => {});
  }, []);

  async function exportData() {
    setBusy(true);
    try {
      const [agents, activity, styles] = await Promise.all([
        api('/api/agents'), api('/api/activity?limit=500'), api('/api/styles'),
      ]);
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), agents: agents.agents, activity: activity.events, styles: styles.styles }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clintx-export.json';
      a.click();
      URL.revokeObjectURL(url);
      setNotice('Export download ho gaya.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteData() {
    if (!confirm('Saara local data delete ho jayega (agents, tasks, memory, activity). Pakka?')) return;
    try {
      await api('/api/settings/data', { method: 'DELETE' });
      setNotice('Data delete ho gaya. Page reload karein.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHead title="Settings" sub="Appearance, integrations, data controls." />
      {notice && <div className="mb-3"><Notice msg={notice} onClose={() => setNotice('')} /></div>}
      <ErrorBox msg={error} onClose={() => setError('')} />

      <div className="space-y-3">
        <div className="card card-pad">
          <h3 className="font-bold text-[14px] mb-3">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-semibold">Dark mode</div>
              <div className="text-[12px] muted">Light default hai — dark bhi available.</div>
            </div>
            <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="font-bold text-[14px] mb-3">AI providers</h3>
          {!st ? <Skeleton className="h-16" /> : (
            <div className="space-y-2 text-[13px]">
              <Row label="Active provider" value={st.aiProvider} ok />
              <Row label="WhatsApp (respond.io)" value={st.whatsappConfigured ? 'Configured' : 'Not configured'} ok={st.whatsappConfigured} />
              <Row label="OpenAI" value={st.openaiConfigured ? 'Configured' : 'Not configured'} ok={st.openaiConfigured} />
              <Row label="Anthropic" value={st.anthropicConfigured ? 'Configured' : 'Not configured'} ok={st.anthropicConfigured} />
              <p className="text-[12px] muted pt-1">
                Keys Vercel → Project Settings → Environment Variables mein set hoti hain (<span className="font-mono">RESPONDIO_API_KEY</span>, <span className="font-mono">OPENAI_API_KEY</span>, <span className="font-mono">ANTHROPIC_API_KEY</span>) — frontend mein kabhi nahi.
              </p>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3 className="font-bold text-[14px] mb-2">Demo mode</h3>
          <p className="text-[13px] muted leading-relaxed">
            {st?.demoMode
              ? 'Abhi DEMO MODE chal raha hai — data local hai. Production database ke liye free Neon Postgres banayein aur Vercel mein DATABASE_URL set karein (README mein 2-minute guide hai).'
              : 'Database connected hai — live mode.'}
          </p>
          <div className="mt-3 flex gap-2">
            <Link href="/platforms"><span className="tx-btn btn-ghost btn-sm">Platforms</span></Link>
            <Link href="/styles"><span className="tx-btn btn-ghost btn-sm">Styles</span></Link>
          </div>
        </div>

        <div className="card card-pad">
          <h3 className="font-bold text-[14px] mb-2">Phase 2 roadmap</h3>
          <ul className="text-[13px] muted space-y-1.5">
            <li className="flex gap-2"><Icon d={paths.globe} className="w-4 h-4 mt-0.5 shrink-0" /> Browser extension (Chrome / Edge / Firefox) — Generic Website Agent</li>
            <li className="flex gap-2"><Icon d={paths.workspace} className="w-4 h-4 mt-0.5 shrink-0" /> Keyboard companion — platform-aware keypads</li>
            <li className="flex gap-2"><Icon d={paths.zap} className="w-4 h-4 mt-0.5 shrink-0" /> Desktop app + realtime WebSocket</li>
            <li className="flex gap-2"><Icon d={paths.key} className="w-4 h-4 mt-0.5 shrink-0" /> OAuth connections (Google, etc.)</li>
          </ul>
        </div>

        <div className="card card-pad">
          <h3 className="font-bold text-[14px] mb-3">Data</h3>
          <div className="flex flex-wrap gap-2">
            <Btn icon="download" disabled={busy} onClick={exportData}>Export data (JSON)</Btn>
            <Btn variant="danger" icon="trash" onClick={deleteData}>Delete all data</Btn>
          </div>
          <p className="text-[12px] muted mt-2">Export mein agents, activity aur styles ka real data ata hai.</p>
        </div>

        <div className="card card-pad border-red-200 dark:border-red-500/30">
          <h3 className="font-bold text-[14px] mb-2 text-red-600 dark:text-red-400">Honesty commitments</h3>
          <ul className="text-[13px] muted space-y-1.5">
            <li>· Clint X kabhi fake "Sent" ya "Connected" nahi dikhata.</li>
            <li>· Approval ke baghair sensitive external action execute nahi hota.</li>
            <li>· Agents ki memory kabhi auto-merge nahi hoti.</li>
            <li>· No CAPTCHA / rate-limit / platform-restriction bypass — assisted mode only.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="muted">{label}</span>
      <span className={`chip ${ok ? 'chip-green' : 'chip-gray'}`}>{value}</span>
    </div>
  );
}
