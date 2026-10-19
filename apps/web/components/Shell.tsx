'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, paths } from './icons';

const NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/agents', label: 'Agents', icon: 'agents' },
  { href: '/workspace', label: 'Workspace', icon: 'workspace' },
  { href: '/tasks', label: 'Tasks', icon: 'tasks' },
  { href: '/approvals', label: 'Approvals', icon: 'approvals' },
  { href: '/activity', label: 'Activity', icon: 'activity' },
  { href: '/platforms', label: 'Platforms', icon: 'platforms' },
  { href: '/connections', label: 'Connections', icon: 'connections' },
  { href: '/outreach', label: 'Outreach', icon: 'outreach' },
  { href: '/memory', label: 'Memory', icon: 'memory' },
  { href: '/styles', label: 'Styles', icon: 'styles' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

interface Status { demoMode: boolean; whatsappConfigured: boolean; aiProvider: string }

interface AgentLite { id: string; name: string; status: string }

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [agents, setAgents] = useState<AgentLite[]>([]);

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => {});
    fetch('/api/agents').then((r) => r.json()).then((d) => setAgents(d.agents ?? [])).catch(() => {});
  }, []);

  const doAction = useCallback(async (kind: string, payload?: string) => {
    if (kind === 'go') { router.push(payload!); }
    else if (kind === 'pause' || kind === 'resume') {
      const a = agents.find((x) => x.id === payload);
      if (!a) return;
      await fetch(`/api/agents/${a.id}/${kind}`, { method: 'POST' });
      router.refresh();
    } else if (kind === 'task') {
      router.push('/tasks');
    }
    setCmdOpen(false);
    setCmdQuery('');
  }, [agents, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cmdItems: { label: string; hint: string; kind: string; payload?: string }[] = [
    ...NAV.filter((n) => n.label.toLowerCase().includes(cmdQuery.toLowerCase()))
      .map((n) => ({ label: `${n.label} kholein`, hint: n.href, kind: 'go', payload: n.href })),
    ...agents
      .filter((a) => (a.name + a.status).toLowerCase().includes(cmdQuery.toLowerCase()))
      .flatMap((a) => [
        { label: `${a.name} — pause karein`, hint: a.status, kind: 'pause', payload: a.id },
        { label: `${a.name} — resume karein`, hint: a.status, kind: 'resume', payload: a.id },
        { label: `${a.name} — naye task ka page`, hint: 'tasks', kind: 'task' as const, payload: a.id },
      ]),
  ];

  return (
    <div className="min-h-screen">
      {status?.demoMode && (
        <div className="sticky top-0 z-40 bg-gradient-to-r from-txpurple/30 to-txorange/20 border-b border-txorange/30 px-4 py-2 text-center text-xs font-semibold text-txorange">
          DEMO MODE — local data, connect Neon Postgres to go live.
        </div>
      )}

      {/* desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col glass border-r border-txviolet/20 z-30">
        <Link href="/" className="px-5 pt-6 pb-4">
          <div className="text-xl font-extrabold tracking-tight">
            TYPE <span className="text-txviolet">X</span>
          </div>
          <div className="text-[11px] text-white/40">Control Center</div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
          {NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  active
                    ? 'bg-txviolet/20 text-white border border-txviolet/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon d={paths[n.icon as keyof typeof paths]} className="w-5 h-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => setCmdOpen(true)}
          className="mx-3 mb-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/50 bg-white/5 hover:bg-white/10 border border-white/10"
        >
          <Icon d={paths.command} className="w-4 h-4" />
          Command bar
          <kbd className="ml-auto text-[10px] bg-white/10 rounded px-1.5 py-0.5">Ctrl+K</kbd>
        </button>
      </aside>

      {/* mobile top bar + bottom nav */}
      <header className="md:hidden sticky top-0 z-30 glass border-b border-txviolet/20 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          TYPE <span className="text-txviolet">X</span>
        </Link>
        <button onClick={() => setCmdOpen(true)} className="tx-btn btn-ghost !px-3 !py-2 text-xs">
          <Icon d={paths.command} className="w-4 h-4" />
          Ctrl+K
        </button>
      </header>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-txviolet/20 flex overflow-x-auto">
        {NAV.map((n) => {
          const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 min-w-[64px] text-[10px] font-medium ${
                active ? 'text-txviolet' : 'text-white/50'
              }`}
            >
              <Icon d={paths[n.icon as keyof typeof paths]} className="w-5 h-5" />
              {n.label}
            </Link>
          );
        })}
      </nav>

      <main className="md:pl-60 pb-24 md:pb-10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-6 fade-up" key={pathname}>
          {children}
        </div>
      </main>

      {/* command bar */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4" onClick={() => setCmdOpen(false)}>
          <div className="glass w-full max-w-lg p-2" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              className="tx-input !border-0 !bg-transparent text-base"
              placeholder="Action likhein — page, pause agent, task…"
              value={cmdQuery}
              onChange={(e) => setCmdQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && cmdItems[0]) doAction(cmdItems[0].kind, cmdItems[0].payload); }}
            />
            <div className="max-h-72 overflow-y-auto mt-1">
              {cmdItems.length === 0 && <div className="px-3 py-4 text-sm text-white/40">Kuch nahi mila</div>}
              {cmdItems.slice(0, 12).map((it, i) => (
                <button
                  key={i}
                  onClick={() => doAction(it.kind, it.payload)}
                  className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-txviolet/15 flex items-center justify-between"
                >
                  <span>{it.label}</span>
                  <span className="text-xs text-white/40">{it.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
