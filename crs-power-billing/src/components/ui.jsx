import React from 'react';
import { formatINR } from '../lib/gst.js';

export function Money({ value, className = '' }) {
  return <span className={`tnum ${className}`}>{formatINR(value)}</span>;
}

export function StatCard({ label, value, change, caption, tone = 'brand', icon }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold text-ink tnum">{value}</p>
        </div>
        {icon ? (
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base ${tones[tone]}`}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TrendPill change={change} />
        {caption ? <span className="truncate text-xs text-slate-500">{caption}</span> : null}
      </div>
    </div>
  );
}

/** Month-over-month change pill. `null` means "no comparable baseline". */
export function TrendPill({ change, suffix = 'vs last month' }) {
  if (change === null || change === undefined) {
    return <span className="chip bg-slate-100 text-slate-500">— {suffix}</span>;
  }
  const up = change > 0;
  const flat = change === 0;
  const cls = flat
    ? 'bg-slate-100 text-slate-600'
    : up
      ? 'bg-emerald-50 text-emerald-700'
      : 'bg-rose-50 text-rose-700';
  const arrow = flat ? '→' : up ? '↑' : '↓';
  return (
    <span className={`chip ${cls} tnum`}>
      {arrow} {Math.abs(change).toFixed(1)}% {suffix}
    </span>
  );
}

export function StatusChip({ status }) {
  const map = {
    PAID: 'bg-emerald-50 text-emerald-700',
    PARTIAL: 'bg-amber-50 text-amber-700',
    UNPAID: 'bg-rose-50 text-rose-700',
  };
  return <span className={`chip ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

export function Empty({ title, subtitle, action }) {
  return (
    <div className="card grid place-items-center px-6 py-14 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {subtitle ? <p className="mt-1 max-w-sm text-sm text-slate-500">{subtitle}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
      <p className="text-sm text-rose-800">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="text-sm font-semibold text-rose-700 underline">
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-auto`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const tone = toast.type === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return (
    <div className="fixed bottom-5 left-1/2 z-[60] w-[min(92vw,32rem)] -translate-x-1/2">
      <div className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 shadow-lg ${tone}`}>
        <p className="text-sm">{toast.message}</p>
        <button type="button" onClick={onDismiss} className="text-sm opacity-60 hover:opacity-100">✕</button>
      </div>
    </div>
  );
}
