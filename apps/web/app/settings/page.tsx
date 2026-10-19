'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Spinner, ErrorBox, Empty, PageHead, Field, ConfirmButton } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Status { demoMode: boolean; whatsappConfigured: boolean; openaiConfigured: boolean; anthropicConfigured: boolean; aiProvider: string }

const PERM_INFO: [string, string][] = [
  ['READ_CONTEXT', 'Platform ka current context parhna'],
  ['READ_MESSAGES', 'Messages parhna'],
  ['GENERATE_CONTENT', 'Content generate karna'],
  ['GENERATE_TEXT', 'Text generate karna'],
  ['GENERATE_REPLY', 'Reply tayyar karna'],
  ['INSERT_TEXT', 'Text insert karna (assisted)'],
  ['SEND_MESSAGE', 'Message bhejna — sensitive, approval-gated'],
  ['SEARCH', 'Search karna'],
  ['FORM_FILL', 'Form bharna'],
  ['UPLOAD', 'File upload — sensitive'],
  ['POST', 'Post karna — sensitive'],
  ['DELETE', 'Delete karna — sensitive'],
  ['SCHEDULE', 'Schedule karna'],
];

export default function SettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [defaults, setDefaults] = useState({ language: 'Roman Urdu', tone: 'friendly' });

  async function load() {
    setError('');
    try {
      const s = await api('/api/status');
      setStatus(s);
      const m = await api('/api/memory?scope=GLOBAL&scopeId=global');
      const item = (m.items ?? []).find((x: { key: string }) => x.key === 'settings:defaults');
      if (item) setDefaults({ ...defaults, ...JSON.parse(item.value) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function saveDefaults() {
    await api('/api/memory', { method: 'POST', body: { scope: 'GLOBAL', scopeId: 'global', key: 'settings:defaults', value: JSON.stringify(defaults) } });
    setNotice('Defaults save ho gaye.');
  }

  async function exportData() {
    setError('');
    try {
      const [agents, activity, memory, styles, leads] = await Promise.all([
        api('/api/agents'),
        api('/api/activity?limit=500'),
        api('/api/memory?scope=GLOBAL&scopeId=global'),
        api('/api/styles'),
        api('/api/outreach'),
      ]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), agents: agents.agents, activity: activity.events, memory: memory.items, styles: styles.styles, leads: leads.leads }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `typex-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function deleteData() {
    setError('');
    setNotice('');
    try {
      const d = await api('/api/settings/data', { method: 'DELETE' });
      setNotice(`${d.deleted} items delete ho gaye (styles, leads, saved outputs, settings). Agents, tasks aur audit log append-only hain — wo nahi mitayenge.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <PageHead title="Settings" sub="Profile, AI provider, defaults aur data controls." />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}
      {notice && <div className="glass-soft p-3 mb-4 text-sm text-emerald-300">{notice}</div>}

      {!status ? (
        <Spinner label="Settings load ho rahe hain…" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* AI PROVIDER */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">AI Provider</h3>
            <div className="space-y-2 text-sm">
              {[
                { name: 'Local (built-in)', desc: 'Koi key nahi chahiye — device par chalta hai.', on: true, active: status.aiProvider === 'local' },
                { name: 'OpenAI', desc: status.openaiConfigured ? 'Key set hai (server env).' : 'Key set nahi — server env OPENAI_API_KEY chahiye.', on: status.openaiConfigured, active: status.aiProvider === 'openai' },
                { name: 'Anthropic', desc: status.anthropicConfigured ? 'Key set hai (server env).' : 'Key set nahi — server env ANTHROPIC_API_KEY chahiye.', on: status.anthropicConfigured, active: status.aiProvider === 'anthropic' },
              ].map((p) => (
                <div key={p.name} className={`glass-soft p-3 flex items-center justify-between ${p.active ? '!border-txviolet/50' : ''}`}>
                  <div>
                    <div className="font-semibold">{p.name} {p.active && <span className="chip ml-1 !border-txviolet/50 text-txviolet">ACTIVE</span>}</div>
                    <div className="text-xs text-white/50">{p.desc}</div>
                  </div>
                  <Icon d={p.on ? paths.check : paths.x} className={`w-5 h-5 ${p.on ? 'text-emerald-400' : 'text-white/30'}`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-3">
              Keys server environment mein set hoti hain — UI mein kabhi type ya echo nahi hoti.
            </p>
          </div>

          {/* DEFAULTS */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Defaults</h3>
            <div className="space-y-3">
              <Field label="Default language">
                <select className="tx-input" value={defaults.language} onChange={(e) => setDefaults({ ...defaults, language: e.target.value })}>
                  <option>Roman Urdu</option><option>English</option><option>Urdu</option>
                </select>
              </Field>
              <Field label="Default tone">
                <input className="tx-input" value={defaults.tone} onChange={(e) => setDefaults({ ...defaults, tone: e.target.value })} placeholder="friendly" />
              </Field>
              <button className="tx-btn btn-primary text-xs" onClick={saveDefaults}>
                <Icon d={paths.check} className="w-4 h-4" /> Save defaults
              </button>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 text-xs text-white/50">
              WhatsApp: {status.whatsappConfigured ? <span className="text-emerald-300 font-semibold">configured</span> : <span className="text-txorange font-semibold">not configured</span>}
            </div>
          </div>

          {/* PERMISSIONS OVERVIEW */}
          <div className="glass p-5">
            <h3 className="font-bold mb-1">Permissions overview</h3>
            <p className="text-xs text-white/40 mb-3">Per-agent toggles agent detail page par hain.</p>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {PERM_INFO.map(([p, desc]) => (
                <div key={p} className="glass-soft px-3 py-2 text-xs flex items-center justify-between gap-2">
                  <span className="font-mono text-white/80">{p}</span>
                  <span className="text-white/45 text-right">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PHASE 2 */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Phase 2</h3>
            <div className="space-y-2">
              {[
                ['Keyboard companion', 'Kisi bhi app mein type karega — Phase 2'],
                ['Browser extension', 'Web context read + insert — Phase 2'],
                ['Desktop app', 'Native control center — Phase 2'],
              ].map(([t, d]) => (
                <div key={t} className="glass-soft p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{t}</div>
                    <div className="text-xs text-white/45">{d}</div>
                  </div>
                  <span className="chip">Phase 2</span>
                </div>
              ))}
            </div>
          </div>

          {/* DEMO MODE */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Data mode</h3>
            {status.demoMode ? (
              <div className="text-sm text-white/60">
                <span className="text-txorange font-semibold">DEMO MODE</span> — data local memory mein hai, server restart par mit jayega.
                Neon Postgres ka <span className="font-mono">DATABASE_URL</span> set karein aur redeploy karein to go live.
              </div>
            ) : (
              <div className="text-sm text-white/60">
                <span className="text-emerald-300 font-semibold">LIVE</span> — Postgres connected, data persist ho raha hai.
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
              <button className="tx-btn btn-ghost text-xs" onClick={exportData}>
                <Icon d={paths.download} className="w-4 h-4" /> Export Data (JSON)
              </button>
              <ConfirmButton label={<><Icon d={paths.trash} className="w-4 h-4" /> Delete Data</>} confirmLabel="Sab user data delete? Pakka?" onConfirm={deleteData} className="text-xs" />
            </div>
            <p className="text-xs text-white/40 mt-3">
              Delete sirf styles, leads, saved outputs aur settings mitata hai. Agents, tasks aur audit log append-only hain.
            </p>
          </div>

          {/* PROFILE */}
          <div className="glass p-5">
            <h3 className="font-bold mb-3">Profile</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-txpurple to-txviolet flex items-center justify-center font-extrabold text-xl">T</div>
              <div>
                <div className="font-semibold">TYPE X Owner</div>
                <div className="text-xs text-white/50 font-mono">user: owner (single-user)</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
