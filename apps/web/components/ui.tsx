'use client';

import { useState } from 'react';
import { Icon } from './icons';

const STATUS_COLORS: Record<string, string> = {
  READY: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  ACTIVE: 'bg-txviolet/15 text-txviolet border-txviolet/40',
  WAITING_APPROVAL: 'bg-txorange/15 text-txorange border-txorange/40',
  PAUSED: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  OFFLINE: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',
  CONNECTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  DISCONNECTED: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',
  NEEDS_SETUP: 'bg-txorange/15 text-txorange border-txorange/40',
  ERROR: 'bg-red-500/15 text-red-300 border-red-500/40',
  PENDING: 'bg-txorange/15 text-txorange border-txorange/40',
  APPROVED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  REJECTED: 'bg-red-500/15 text-red-300 border-red-500/40',
  CANCELLED: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',
  CREATED: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  RUNNING: 'bg-txviolet/15 text-txviolet border-txviolet/40',
  WAITING: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  COMPLETED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  FAILED: 'bg-red-500/15 text-red-300 border-red-500/40',
  PREPARED: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  EXECUTED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  DENIED: 'bg-red-500/15 text-red-300 border-red-500/40',
  NEW: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  MESSAGED: 'bg-txviolet/15 text-txviolet border-txviolet/40',
  REPLIED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  WON: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  LOST: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',
};

export function Pill({ status, live }: { status: string; live?: boolean }) {
  const cls = STATUS_COLORS[status] ?? 'bg-white/5 text-white/70 border-white/15';
  return (
    <span className={`chip border ${cls}`}>
      {live && <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-current" />}
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-white/60 text-sm py-8 justify-center">
      <span className="inline-block w-5 h-5 border-2 border-txviolet border-t-transparent rounded-full animate-spin" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-soft p-4 flex items-start gap-3 text-sm">
      <Icon d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="text-red-300 font-semibold">Kuch ghalat hua</div>
        <div className="text-white/60 break-words">{message}</div>
        {onRetry && (
          <button className="tx-btn btn-ghost mt-2 text-xs" onClick={onRetry}>
            Dobara try karein
          </button>
        )}
      </div>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="glass-soft p-8 text-center text-sm">
      <div className="text-white/80 font-semibold">{title}</div>
      {hint && <div className="text-white/50 mt-1">{hint}</div>}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-white/50 text-sm mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block text-white/60 text-xs font-semibold mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="inline-flex gap-2">
      <button className={`tx-btn btn-danger ${className ?? ''}`} onClick={() => { setArmed(false); onConfirm(); }}>
        {confirmLabel ?? 'Pakka?'}
      </button>
      <button className="tx-btn btn-ghost" onClick={() => setArmed(false)}>Radd karein</button>
    </span>
  ) : (
    <button className={`tx-btn btn-ghost ${className ?? ''}`} onClick={() => setArmed(true)}>
      {label}
    </button>
  );
}
