'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { PageHead, EmptyState, Skeleton, ErrorBox } from '@/components/ui';

export const dynamic = 'force-dynamic';

interface Platform {
  id: string; name: string; brandColor: string; connectionType: string;
  authMethod: string; supportedActions: string[]; contextExtraction: string;
  executionMethod: string; rateLimits: string; approvalRequired: boolean;
  adapterVersion: string; status: string; adapterRegistered: boolean;
  adapterCapabilities: string[];
}

export default function PlatformsPage() {
  const [list, setList] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/platforms')
      .then((d) => setList(d.platforms ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHead
        title="Platforms"
        sub="Extensible registry — naya platform adapter add karne se core rebuild nahi hota."
      />
      <ErrorBox msg={error} onClose={() => setError('')} />
      {loading ? (
        <div className="grid md:grid-cols-2 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon="platforms" title="No platforms registered." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map((p) => (
            <div key={p.id} className="card card-pad">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[13px]" style={{ background: p.brandColor }}>
                  {p.name.slice(0, 1)}
                </span>
                <div className="flex-1">
                  <div className="font-semibold text-[14px]">{p.name}</div>
                  <div className="text-[11px] muted font-mono">{p.id} · adapter v{p.adapterVersion}</div>
                </div>
                <span className={`chip ${p.adapterRegistered ? 'chip-green' : 'chip-gray'}`}>
                  {p.adapterRegistered ? 'Adapter live' : 'No adapter'}
                </span>
              </div>
              <dl className="text-[12.5px] space-y-1.5">
                <div className="flex gap-2"><dt className="muted w-32 shrink-0">Auth</dt><dd>{p.authMethod}</dd></div>
                <div className="flex gap-2"><dt className="muted w-32 shrink-0">Execution</dt><dd>{p.executionMethod}</dd></div>
                <div className="flex gap-2"><dt className="muted w-32 shrink-0">Rate limits</dt><dd>{p.rateLimits}</dd></div>
                <div className="flex gap-2"><dt className="muted w-32 shrink-0">Approval</dt><dd>{p.approvalRequired ? 'Required for sends' : 'Not required'}</dd></div>
              </dl>
              {p.adapterCapabilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {p.adapterCapabilities.map((c) => (
                    <span key={c} className="chip chip-purple !text-[10px]">{c.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
