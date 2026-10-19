'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { Icon, paths } from '@/components/icons';
import { Pill, Spinner, ErrorBox, Empty, PageHead } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Platform {
  id: string; name: string; icon: string; brandColor: string; connectionType: string;
  capabilities: string[]; authMethod: string; supportedActions: string[];
  contextExtraction: string; executionMethod: string; permissionRequirements: string[];
  rateLimits: string; approvalRequired: boolean; adapterVersion: string; status: string;
  adapterRegistered: boolean; adapterCapabilities: string[];
}

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[] | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const d = await api('/api/platforms');
      setPlatforms(d.platforms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <PageHead title="Platforms" sub="Registry — har platform ki declared capabilities, honest statuses." />
      {error && <div className="mb-4"><ErrorBox message={error} onRetry={load} /></div>}

      {platforms === null ? (
        <Spinner label="Platforms load ho rahe hain…" />
      ) : platforms.length === 0 ? (
        <Empty title="Koi platform registered nahi" />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {platforms.map((p) => (
            <div key={p.id} className="glass p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-lg"
                    style={{ backgroundColor: p.brandColor + '22', color: p.brandColor }}
                  >
                    <Icon d={p.id === 'whatsapp' ? paths.chat : paths.globe} className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-lg">{p.name}</div>
                    <div className="text-xs text-white/50 font-mono">{p.id} · v{p.adapterVersion}</div>
                  </div>
                </div>
                <Pill status={p.status.toUpperCase()} />
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-white/50 mb-2">Capabilities</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.capabilities.map((c) => (
                    <span key={c} className="chip">{c.replaceAll('_', ' ')}</span>
                  ))}
                </div>
              </div>

              <div className="mt-4 space-y-1.5 text-xs text-white/55">
                <div><span className="text-white/35">Connection: </span><span className="font-mono">{p.connectionType}</span></div>
                <div><span className="text-white/35">Auth: </span>{p.authMethod}</div>
                <div><span className="text-white/35">Execution: </span>{p.executionMethod}</div>
                <div><span className="text-white/35">Rate limits: </span>{p.rateLimits}</div>
                <div><span className="text-white/35">Approval: </span>{p.approvalRequired ? 'Required by default' : 'Not required'}</div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 text-xs">
                {p.adapterRegistered ? (
                  <span className="text-emerald-300 font-semibold">Adapter registered — {p.adapterCapabilities.length} capabilities live</span>
                ) : (
                  <span className="text-txorange font-semibold">Not supported for this connection.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
