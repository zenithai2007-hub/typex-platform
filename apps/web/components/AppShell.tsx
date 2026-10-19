'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/client';
import { useTx } from './tx-store';
import { Icon, paths } from './icons';
import RightPanel from './RightPanel';

const NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/agents', label: 'Agents', icon: 'agents' },
  { href: '/workspace', label: 'Workspace', icon: 'workspace' },
  { href: '/tasks', label: 'Tasks', icon: 'tasks' },
  { href: '/output', label: 'Output', icon: 'output' },
  { href: '/approvals', label: 'Approvals', icon: 'approvals' },
  { href: '/activity', label: 'History', icon: 'history' },
  { href: '/memory', label: 'Memory', icon: 'memory' },
  { href: '/connections', label: 'Connections', icon: 'connections' },
  { href: '/automations', label: 'Automations', icon: 'automations' },
  { href: '/outreach', label: 'Outreach', icon: 'outreach' },
  { href: '/analytics', label: 'Analytics', icon: 'analytics' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

const MOBILE_NAV = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/agents', label: 'Agents', icon: 'agents' },
  { href: '/workspace', label: 'Workspace', icon: 'workspace' },
  { href: '/approvals', label: 'Approvals', icon: 'approvals' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
] as const;

function Logo({ h = 'h-8' }: { h?: string }) {
  return (
    <span className="inline-flex items-center bg-white rounded-xl px-2 py-1 shadow-sm border border-slate-200">
      <img src="/clintx-logo.png" alt="Clint X" className={`${h} w-auto`} draggable={false} />
    </span>
  );
}

function AgentSwitcher({ collapsed }: { collapsed: boolean }) {
  const { agents, activeAgent, activeAgentId, setActiveAgentId } = useTx();
  const [open, setOpen] = useState(false);

  if (collapsed) {
    return (
      <div className="tip" data-tip={activeAgent ? activeAgent.name : 'Agent'}>
        <button
          onClick={() => setOpen(!open)}
          className="w-10 h-10 mx-auto rounded-xl bg-purple-50 dark:bg-txpurple/15 text-txpurple flex items-center justify-center hover:bg-purple-100 dark:hover:bg-txpurple/25"
          aria-label="Switch agent"
        >
          <Icon d={paths.agents} className="w-5 h-5" />
        </button>
        {open && <AgentMenu agents={agents} activeAgentId={activeAgentId} setActiveAgentId={setActiveAgentId} onPick={() => setOpen(false)} floating />}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-purple-300 dark:hover:border-txpurple/40 transition text-left"
      >
        <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-txpurple/20 text-txpurple dark:text-violet-300 flex items-center justify-center shrink-0 font-bold text-[13px]">
          {(activeAgent?.name ?? 'C').slice(0, 1).toUpperCase()}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold truncate text-slate-900 dark:text-white">
            {activeAgent?.name ?? 'No agent'}
          </span>
          <span className="block text-[11px] muted capitalize truncate">
            {(activeAgent?.platformId ?? '').replace(/_/g, ' ')} · {(activeAgent?.status ?? '').toLowerCase()}
          </span>
        </span>
        <Icon d={paths.chevronDown} className="w-4 h-4 muted shrink-0" />
      </button>
      {open && <AgentMenu agents={agents} activeAgentId={activeAgentId} setActiveAgentId={setActiveAgentId} onPick={() => setOpen(false)} />}
    </div>
  );
}

function AgentMenu({
  agents,
  activeAgentId,
  setActiveAgentId,
  onPick,
  floating,
}: {
  agents: { id: string; name: string; platformId: string; status: string }[];
  activeAgentId: string | null;
  setActiveAgentId: (id: string) => void;
  onPick: () => void;
  floating?: boolean;
}) {
  if (agents.length === 0) {
    return (
      <div className={`card p-3 text-[12px] muted ${floating ? 'fixed left-16 top-24 z-[80] w-60 shadow-pop' : 'absolute left-0 right-0 top-full mt-1.5 z-50 shadow-pop'}`}>
        No agents yet — <Link href="/agents" className="text-txpurple font-semibold" onClick={onPick}>create one</Link>.
      </div>
    );
  }
  return (
    <div className={`card p-1.5 ${floating ? 'fixed left-16 top-24 z-[80] w-64 shadow-pop' : 'absolute left-0 right-0 top-full mt-1.5 z-50 shadow-pop'}`}>
      <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider muted">Switch agent — context isolated</div>
      {agents.map((a) => (
        <button
          key={a.id}
          onClick={() => { setActiveAgentId(a.id); onPick(); }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-white/5 ${a.id === activeAgentId ? 'bg-purple-50 dark:bg-txpurple/10' : ''}`}
        >
          <span className="dot" style={{ background: a.status === 'ACTIVE' ? '#16a34a' : a.status === 'WAITING_APPROVAL' ? '#ff7a18' : '#9ca3af' }} />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold truncate">{a.name}</span>
            <span className="block text-[11px] muted capitalize">{a.platformId.replace(/_/g, ' ')}</span>
          </span>
          {a.id === activeAgentId && <Icon d={paths.check} className="w-4 h-4 text-txpurple" />}
        </button>
      ))}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    status, theme, toggleTheme, sidebarCollapsed, setSidebarCollapsed,
    rightOpen, setRightOpen, setRightTab, mobileNav, setMobileNav, activeAgent,
  } = useTx();
  const [pendingCount, setPendingCount] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const load = () =>
      api('/api/approvals?pending=1')
        .then((d) => setPendingCount((d.approvals ?? []).length))
        .catch(() => {});
    load();
    const iv = setInterval(load, 12000);
    return () => clearInterval(iv);
  }, []);

  const openApprovals = () => {
    setRightTab('approvals');
    setRightOpen(true);
    if (window.innerWidth < 1280) setSheetOpen(true);
  };

  const collapsed = sidebarCollapsed;

  return (
    <div className="min-h-screen">
      {status?.demoMode && (
        <div className="sticky top-0 z-[60] bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/25 px-4 py-1.5 text-center text-[11.5px] font-semibold text-amber-700 dark:text-amber-300">
          DEMO MODE — local data. Connect Neon Postgres to go live.{' '}
          <Link href="/settings" className="underline underline-offset-2">Settings</Link>
        </div>
      )}

      <div className="flex">
        {/* ============ LEFT SIDEBAR ============ */}
        <aside
          className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-white dark:bg-[#120b22] border-r border-slate-200 dark:border-white/10 z-40 transition-[width] duration-200 ${collapsed ? 'w-[68px]' : 'w-[228px]'}`}
        >
          <div className={`flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-2'} pt-4 pb-3`}>
            <Link href="/" aria-label="Clint X home">{collapsed ? <Logo h="h-7" /> : <Logo />}</Link>
            {!collapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-lg muted hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label="Collapse sidebar"
              >
                <Icon d={paths.chevronLeft} className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className={`px-3 mb-2 ${collapsed ? 'px-0 flex justify-center' : ''}`}>
            {collapsed ? (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="tip w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center muted"
                data-tip="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <Icon d={paths.chevronRight} className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          <div className={`${collapsed ? 'px-0 flex justify-center' : 'px-3'} mb-3`}>
            <AgentSwitcher collapsed={collapsed} />
          </div>

          <nav className={`flex-1 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'} pb-3 space-y-0.5`}>
            {NAV.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              const inner = (
                <>
                  <Icon d={paths[n.icon]} className="w-[18px] h-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{n.label}</span>}
                  {!collapsed && n.href === '/approvals' && pendingCount > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-txorange text-white text-[10px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </>
              );
              const cls = `nav-item ${active ? 'active' : ''} ${collapsed ? '!justify-center !px-0 !gap-0 h-10' : ''}`;
              return collapsed ? (
                <div key={n.href} className="tip" data-tip={n.label}>
                  <Link href={n.href} className={cls} aria-label={n.label}>{inner}</Link>
                </div>
              ) : (
                <Link key={n.href} href={n.href} className={cls}>{inner}</Link>
              );
            })}
          </nav>

          <div className={`${collapsed ? 'px-0 flex flex-col items-center' : 'px-3'} pb-4 space-y-1`}>
            <button
              onClick={toggleTheme}
              className={`tip nav-item ${collapsed ? '!justify-center !px-0 !gap-0 h-10' : ''}`}
              data-tip={theme === 'light' ? 'Dark mode' : 'Light mode'}
              aria-label="Toggle theme"
            >
              <Icon d={theme === 'light' ? paths.moon : paths.sun} className="w-[18px] h-[18px] shrink-0" />
              {!collapsed && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
            </button>
            {!collapsed && activeAgent && (
              <div className="text-[10.5px] muted px-2 pt-1 leading-snug">
                Agent context isolated — switching agents never mixes memory.
              </div>
            )}
          </div>
        </aside>

        {/* ============ CENTER ============ */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          {/* mobile top bar */}
          <header className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-[#120b22]/95 backdrop-blur border-b border-slate-200 dark:border-white/10 px-3 py-2.5 flex items-center gap-2">
            <button onClick={() => setMobileNav(true)} className="p-2 -ml-1 rounded-lg muted" aria-label="Open menu">
              <Icon d={paths.menu} className="w-5 h-5" />
            </button>
            <Logo h="h-6" />
            <span className="text-[12px] font-semibold truncate muted ml-1">{activeAgent?.name ?? ''}</span>
            <button onClick={openApprovals} className="ml-auto relative p-2 rounded-lg muted" aria-label="Approvals">
              <Icon d={paths.approvals} className="w-5 h-5" />
              {pendingCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-txorange text-white text-[9px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          </header>

          <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 md:px-6 pt-5 pb-24 md:pb-10">
            <div className="fade-up" key={pathname}>{children}</div>
          </main>

          {/* mobile bottom nav */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#120b22]/95 backdrop-blur border-t border-slate-200 dark:border-white/10 flex">
            {MOBILE_NAV.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${active ? 'text-txpurple' : 'muted'}`}
                >
                  <Icon d={paths[n.icon]} className="w-5 h-5" />
                  {n.label}
                  {n.href === '/approvals' && pendingCount > 0 && (
                    <span className="absolute mt-[-4px] ml-8 min-w-[16px] h-4 px-0.5 rounded-full bg-txorange text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ============ RIGHT PANEL (desktop) ============ */}
        {rightOpen && (
          <aside className="hidden xl:block w-[340px] shrink-0 sticky top-0 h-screen bg-white dark:bg-[#120b22] border-l border-slate-200 dark:border-white/10 z-40">
            <RightPanel />
          </aside>
        )}
        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="tip hidden xl:flex fixed right-4 top-1/2 -translate-y-1/2 z-40 w-9 h-16 rounded-l-xl bg-white dark:bg-[#1a1230] border border-slate-200 dark:border-white/10 shadow-card items-center justify-center muted hover:text-txpurple"
            data-tip="Open activity panel"
            aria-label="Open activity panel"
          >
            <Icon d={paths.panelRight} className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* mobile drawer */}
      {mobileNav && (
        <div className="md:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-slate-900/45" onClick={() => setMobileNav(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-white dark:bg-[#120b22] shadow-pop flex flex-col fade-up">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/10">
              <Logo h="h-7" />
              <button onClick={() => setMobileNav(false)} className="p-1.5 rounded-lg muted" aria-label="Close menu">
                <Icon d={paths.x} className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3"><AgentSwitcher collapsed={false} /></div>
            <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5" onClick={() => setMobileNav(false)}>
              {NAV.map((n) => {
                const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href} className={`nav-item ${active ? 'active' : ''}`}>
                    <Icon d={paths[n.icon]} className="w-[18px] h-[18px] shrink-0" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-200 dark:border-white/10">
              <button onClick={toggleTheme} className="nav-item w-full">
                <Icon d={theme === 'light' ? paths.moon : paths.sun} className="w-[18px] h-[18px]" />
                {theme === 'light' ? 'Dark mode' : 'Light mode'}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* mobile right-panel bottom sheet */}
      {sheetOpen && (
        <div className="xl:hidden fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-slate-900/45" onClick={() => setSheetOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 h-[72vh] bg-white dark:bg-[#120b22] rounded-t-2xl shadow-pop flex flex-col fade-up">
            <div className="flex items-center justify-center pt-2 pb-1" onClick={() => setSheetOpen(false)}>
              <span className="w-10 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
            </div>
            <div className="flex-1 min-h-0">
              <RightPanel onNavigate={() => setSheetOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* floating button to open right panel on smaller screens */}
      {!sheetOpen && (
        <button
          onClick={() => setSheetOpen(true)}
          className="xl:hidden fixed bottom-20 right-4 z-40 w-11 h-11 rounded-full bg-txpurple text-white shadow-pop flex items-center justify-center"
          aria-label="Open activity"
        >
          <Icon d={paths.activity} className="w-5 h-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-txorange text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
