'use client';

import { Icon, paths } from './icons';

/* ---------------- page head ---------------- */
export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {sub && <p className="text-[13px] muted mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

/* ---------------- buttons ---------------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'action' | 'ghost' | 'danger';
  size?: 'sm' | 'xs' | '';
  icon?: string;
};
export function Btn({ variant = 'ghost', size = '', icon, children, className = '', ...rest }: BtnProps) {
  const v = variant === 'primary' ? 'btn-primary' : variant === 'action' ? 'btn-action' : variant === 'danger' ? 'btn-danger' : 'btn-ghost';
  const s = size === 'sm' ? 'btn-sm' : size === 'xs' ? 'btn-xs' : '';
  return (
    <button className={`tx-btn ${v} ${s} ${className}`} {...rest}>
      {icon && <Icon d={paths[icon as keyof typeof paths] ?? icon} className={size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
      {children}
    </button>
  );
}

/* ---------------- fields ---------------- */
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] muted mt-1">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`tx-input ${props.className ?? ''}`} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`tx-input ${props.className ?? ''}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`tx-input ${props.className ?? ''}`} />;
}

/* ---------------- toggle ---------------- */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2"
    >
      <span
        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${checked ? 'bg-txpurple' : 'bg-slate-300 dark:bg-white/20'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {label && <span className="text-[13px] font-medium">{label}</span>}
    </button>
  );
}

/* ---------------- status ---------------- */
const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'chip-green',
  READY: 'chip-purple',
  PAUSED: 'chip-gray',
  WAITING_APPROVAL: 'chip-orange',
  ERROR: 'chip-red',
  DISCONNECTED: 'chip-red',
  OFFLINE: 'chip-gray',
  CONNECTED: 'chip-green',
  NEEDS_SETUP: 'chip-orange',
  EXPIRED: 'chip-red',
};
const DOT_COLOR: Record<string, string> = {
  ACTIVE: '#16a34a',
  READY: '#7c3aed',
  PAUSED: '#9ca3af',
  WAITING_APPROVAL: '#ff7a18',
  ERROR: '#dc2626',
  DISCONNECTED: '#dc2626',
  OFFLINE: '#9ca3af',
  CONNECTED: '#16a34a',
  NEEDS_SETUP: '#ff7a18',
  EXPIRED: '#dc2626',
};

export function StatusDot({ status, live = false }: { status: string; live?: boolean }) {
  return (
    <span
      className={`dot ${live && (status === 'ACTIVE' || status === 'WAITING_APPROVAL') ? 'dot-live' : ''}`}
      style={{ background: DOT_COLOR[status] ?? '#9ca3af' }}
    />
  );
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`chip ${STATUS_STYLE[status] ?? 'chip-gray'}`}>
      <StatusDot status={status} live />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function OutcomeChip({ outcome }: { outcome: string }) {
  const map: Record<string, string> = {
    PREPARED: 'chip-purple',
    WAITING: 'chip-orange',
    APPROVED: 'chip-green',
    EXECUTED: 'chip-green',
    FAILED: 'chip-red',
    CANCELLED: 'chip-gray',
    DENIED: 'chip-red',
    PENDING: 'chip-orange',
    REJECTED: 'chip-red',
  };
  return <span className={`chip ${map[outcome] ?? 'chip-gray'}`}>{outcome}</span>;
}

/* ---------------- misc ---------------- */
export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ErrorBox({ msg, onClose }: { msg: string; onClose?: () => void }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      <Icon d={paths.alert} className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{msg}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <Icon d={paths.x} className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function Notice({ msg, onClose }: { msg: string; onClose?: () => void }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
      <Icon d={paths.check} className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{msg}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Dismiss">
          <Icon d={paths.x} className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = 'sparkle',
  title,
  sub,
  action,
}: {
  icon?: string;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card card-pad flex flex-col items-center text-center py-10 px-6">
      <span className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-txpurple/15 text-txpurple flex items-center justify-center mb-3">
        <Icon d={paths[icon as keyof typeof paths] ?? paths.sparkle} className="w-5 h-5" />
      </span>
      <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
      {sub && <div className="text-[13px] muted mt-1 max-w-sm">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/45 backdrop-blur-[2px] flex items-start justify-center pt-16 px-4" onClick={onClose}>
      <div
        className={`card w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-5 fade-up shadow-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[15px] text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 muted" aria-label="Close">
            <Icon d={paths.x} className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, icon }: { label: string; value: string | number; icon?: string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 text-[12px] font-medium muted">
        {icon && <Icon d={paths[icon as keyof typeof paths] ?? icon} className="w-4 h-4" />}
        {label}
      </div>
      <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

export function Skeleton({ className = 'h-4' }: { className?: string }) {
  return <div className={`rounded bg-slate-200/80 dark:bg-white/10 animate-pulse ${className}`} />;
}
