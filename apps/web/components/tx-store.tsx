'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client';

export interface AgentLite {
  id: string;
  name: string;
  platformId: string;
  status: string;
}

export interface TxStatus {
  demoMode: boolean;
  whatsappConfigured: boolean;
  openaiConfigured: boolean;
  anthropicConfigured: boolean;
  aiProvider: string;
}

interface TxCtx {
  agents: AgentLite[];
  activeAgentId: string | null;
  setActiveAgentId: (id: string) => void;
  activeAgent: AgentLite | undefined;
  status: TxStatus | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (b: boolean) => void;
  rightOpen: boolean;
  setRightOpen: (b: boolean) => void;
  rightTab: 'activity' | 'approvals' | 'connections';
  setRightTab: (t: 'activity' | 'approvals' | 'connections') => void;
  mobileNav: boolean;
  setMobileNav: (b: boolean) => void;
  refreshAgents: () => Promise<void>;
  /** bump to force right-panel refetch */
  tick: number;
  bump: () => void;
}

const Ctx = createContext<TxCtx | null>(null);

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function TxProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [activeAgentId, setActiveAgentIdState] = useState<string | null>(null);
  const [status, setStatus] = useState<TxStatus | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<'activity' | 'approvals' | 'connections'>('activity');
  const [mobileNav, setMobileNav] = useState(false);
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  const refreshAgents = useCallback(async () => {
    try {
      const d = await api('/api/agents');
      const list: AgentLite[] = d.agents ?? [];
      setAgents(list);
    } catch {
      /* offline — keep old list */
    }
  }, []);

  const setActiveAgentId = useCallback((id: string) => {
    setActiveAgentIdState(id);
    try {
      localStorage.setItem('clintx-agent', id);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem('clintx-theme', next);
      } catch {
        /* ignore */
      }
      document.documentElement.classList.toggle('dark', next === 'dark');
      return next;
    });
  }, []);

  useEffect(() => {
    const stored = readLS('clintx-theme');
    const initial = stored === 'dark' || stored === 'light'
      ? stored
      : document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
    const savedAgent = readLS('clintx-agent');
    refreshAgents().then(() => {
      if (savedAgent) setActiveAgentIdState(savedAgent);
    });
    api('/api/status').then(setStatus).catch(() => {});
    if (window.innerWidth < 1280) setRightOpen(false);
  }, [refreshAgents]);

  // Keep active agent valid when the list changes.
  useEffect(() => {
    if (agents.length === 0) return;
    if (!activeAgentId || !agents.some((a) => a.id === activeAgentId)) {
      setActiveAgentIdState(agents[0].id);
    }
  }, [agents, activeAgentId]);

  const activeAgent = useMemo(
    () => agents.find((a) => a.id === activeAgentId),
    [agents, activeAgentId],
  );

  const value = useMemo<TxCtx>(
    () => ({
      agents,
      activeAgentId,
      setActiveAgentId,
      activeAgent,
      status,
      theme,
      toggleTheme,
      sidebarCollapsed,
      setSidebarCollapsed,
      rightOpen,
      setRightOpen,
      rightTab,
      setRightTab,
      mobileNav,
      setMobileNav,
      refreshAgents,
      tick,
      bump,
    }),
    [
      agents,
      activeAgentId,
      setActiveAgentId,
      activeAgent,
      status,
      theme,
      toggleTheme,
      sidebarCollapsed,
      rightOpen,
      rightTab,
      mobileNav,
      refreshAgents,
      tick,
      bump,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTx(): TxCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTx must be used inside TxProvider');
  return ctx;
}
