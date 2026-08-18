import React from 'react';
import { formatINR } from '../lib/gst.js';

/**
 * Dependency-free SVG charts. Avoids pulling a charting library into the
 * WebContainer bundle and keeps the whole app installable offline.
 */

const compact = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
};

/** Grouped bars: revenue per month, with an optional collected overlay. */
export function RevenueBars({ series, height = 210 }) {
  const max = Math.max(...series.map((s) => s.revenue), 1);
  const barW = 100 / series.length;

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <div
            key={f}
            className="absolute inset-x-0 border-t border-dashed border-slate-200"
            style={{ bottom: `${f * 100}%` }}
          >
            <span className="absolute -top-2 left-0 bg-white pr-1 text-[10px] text-slate-400 tnum">
              {compact(max * f)}
            </span>
          </div>
        ))}

        <div className="absolute inset-0 flex items-end gap-1 pl-8">
          {series.map((s) => {
            const h = (s.revenue / max) * 100;
            const collectedH = s.revenue > 0 ? (s.collected / max) * 100 : 0;
            return (
              <div key={s.key} className="group relative flex flex-1 flex-col items-center justify-end">
                <div className="relative w-full max-w-[46px]">
                  {/* total revenue */}
                  <div
                    className="w-full rounded-t bg-brand-200 transition-all group-hover:bg-brand-300"
                    style={{ height: `${Math.max(h, 1)}%`, minHeight: 2 }}
                  />
                  {/* collected portion */}
                  <div
                    className="absolute bottom-0 w-full rounded-t bg-brand-600"
                    style={{ height: `${Math.max(collectedH, 0)}%` }}
                  />
                </div>
                <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden w-max rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
                  <p className="font-semibold">{s.label}</p>
                  <p className="tnum">Billed {formatINR(s.revenue)}</p>
                  <p className="tnum text-slate-300">Collected {formatINR(s.collected)}</p>
                  <p className="tnum text-slate-300">{s.count} invoice{s.count === 1 ? '' : 's'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1 pl-8">
        {series.map((s) => (
          <div key={s.key} className="flex-1 text-center text-[11px] font-medium text-slate-500">
            {s.label}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 pl-8 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Collected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-200" /> Billed
        </span>
      </div>
    </div>
  );
}

/** Sparkline-style line chart for GST liability. */
export function TaxLine({ series, height = 150 }) {
  const max = Math.max(...series.map((s) => s.tax), 1);
  const w = 100;
  const points = series.map((s, i) => {
    const x = series.length === 1 ? 0 : (i / (series.length - 1)) * w;
    const y = 100 - (s.tax / max) * 100;
    return { x, y, ...s };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${path} L ${w} 100 L 0 100 Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" style={{ height }} className="w-full">
        <defs>
          <linearGradient id="taxfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#337bff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#337bff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#taxfill)" />
        <path d={path} fill="none" stroke="#1b5ced" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {points.map((p) => (
          <circle key={p.key} cx={p.x} cy={p.y} r="1.6" fill="#1b5ced" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex">
        {series.map((s) => (
          <div key={s.key} className="flex-1 text-center text-[11px] text-slate-500">
            <div className="font-medium">{s.label}</div>
            <div className="tnum text-slate-400">{compact(s.tax)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Horizontal share bars for category mix. */
export function CategoryBars({ rows }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-slate-500">No sales recorded this month yet.</p>;
  }
  const palette = ['bg-brand-600', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500', 'bg-rose-500', 'bg-slate-400'];
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.category}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium text-slate-700">{r.category}</span>
            <span className="tnum text-slate-500">
              {formatINR(r.value)} · {r.share.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${palette[i % palette.length]}`} style={{ width: `${r.share}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
