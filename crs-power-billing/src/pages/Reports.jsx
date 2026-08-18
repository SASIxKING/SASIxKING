import React, { useMemo, useState } from 'react';
import { formatINR, money, hsnSummary } from '../lib/gst.js';
import { monthlySeries, monthKey, monthLabel, recentMonthKeys } from '../lib/analytics.js';
import { Money } from '../components/ui.jsx';

export default function Reports({ data }) {
  const { invoices } = data;
  const monthOptions = useMemo(() => recentMonthKeys(12), []);
  const [selected, setSelected] = useState(monthKey(new Date()));

  const scoped = useMemo(
    () => invoices.filter((i) => monthKey(i.date) === selected),
    [invoices, selected],
  );

  const totals = useMemo(() => {
    const t = {
      taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0, collected: 0,
      b2b: 0, b2c: 0, count: scoped.length,
    };
    for (const inv of scoped) {
      t.taxable = money(t.taxable + inv.taxable);
      t.cgst = money(t.cgst + inv.cgst);
      t.sgst = money(t.sgst + inv.sgst);
      t.igst = money(t.igst + inv.igst);
      t.grand = money(t.grand + inv.grandTotal);
      t.collected = money(t.collected + inv.paidAmount);
      if (inv.customerGstin) t.b2b = money(t.b2b + inv.grandTotal);
      else t.b2c = money(t.b2c + inv.grandTotal);
    }
    t.tax = money(t.cgst + t.sgst + t.igst);
    return t;
  }, [scoped]);

  // slab-wise split (18% vs 28%) across every line in the month
  const slabs = useMemo(() => {
    const acc = new Map([[18, { rate: 18, taxable: 0, tax: 0 }], [28, { rate: 28, taxable: 0, tax: 0 }]]);
    for (const inv of scoped) {
      for (const item of inv.items) {
        const row = acc.get(item.gstRate) || { rate: item.gstRate, taxable: 0, tax: 0 };
        row.taxable = money(row.taxable + item.taxable);
        row.tax = money(row.tax + item.cgst + item.sgst + item.igst);
        acc.set(item.gstRate, row);
      }
    }
    return [...acc.values()].filter((r) => r.taxable > 0);
  }, [scoped]);

  const hsnRows = useMemo(() => {
    const all = [];
    for (const inv of scoped) {
      for (const item of inv.items) {
        all.push({ ...item, hsn: item.hsn, gstRate: item.gstRate });
      }
    }
    // group manually because tax split differs per invoice
    const map = new Map();
    for (const inv of scoped) {
      for (const item of inv.items) {
        const key = `${item.hsn}-${item.gstRate}`;
        const row = map.get(key) || {
          hsn: item.hsn, gstRate: item.gstRate, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0,
        };
        row.qty += Number(item.qty) || 0;
        row.taxable = money(row.taxable + item.taxable);
        row.cgst = money(row.cgst + item.cgst);
        row.sgst = money(row.sgst + item.sgst);
        row.igst = money(row.igst + item.igst);
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => b.taxable - a.taxable);
  }, [scoped]);

  const series = useMemo(() => monthlySeries(invoices, { months: 12 }), [invoices]);

  function exportCsv() {
    const header = ['Invoice No', 'Date', 'Customer', 'GSTIN', 'Place of supply',
      'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Paid', 'Status'];
    const rows = scoped.map((i) => [
      i.invoiceNo,
      new Date(i.date).toLocaleDateString('en-IN'),
      `"${i.customerName.replace(/"/g, '""')}"`,
      i.customerGstin || '',
      i.placeOfSupply,
      i.taxable, i.cgst, i.sgst, i.igst, i.grandTotal, i.paidAmount, i.status,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CRS-GSTR1-${selected}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div>
          <span className="label">Return period</span>
          <select className="input min-w-[10rem]" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {monthOptions.map((k) => <option key={k} value={k}>{monthLabel(k)}</option>)}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap gap-6 text-sm">
          <Metric label="Invoices" value={String(totals.count)} />
          <Metric label="Taxable" value={formatINR(totals.taxable)} />
          <Metric label="Total tax" value={formatINR(totals.tax)} accent="text-amber-700" />
          <Metric label="Invoice value" value={formatINR(totals.grand)} accent="text-brand-700" />
        </div>
        <button type="button" className="btn-ghost" onClick={exportCsv}>Export CSV</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">GSTR-1 summary</h2>
          <p className="mb-4 text-xs text-slate-500">{monthLabel(selected)} · outward supplies</p>
          <dl className="space-y-2 text-sm">
            <Row label="Total taxable value" value={totals.taxable} />
            <Row label="CGST (intra-state)" value={totals.cgst} />
            <Row label="SGST (intra-state)" value={totals.sgst} />
            <Row label="IGST (inter-state)" value={totals.igst} />
            <div className="border-t border-slate-200 pt-2">
              <Row label="Total tax liability" value={totals.tax} bold />
            </div>
            <Row label="Invoice value" value={totals.grand} bold />
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm">
            <div>
              <p className="text-xs text-slate-500">B2B (registered)</p>
              <p className="font-semibold text-slate-800 tnum">{formatINR(totals.b2b)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">B2C (unregistered)</p>
              <p className="font-semibold text-slate-800 tnum">{formatINR(totals.b2c)}</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Rate-wise split</h2>
          <p className="mb-4 text-xs text-slate-500">18% vs 28% slab contribution</p>
          {slabs.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No sales in this period.</p>
          ) : (
            <div className="space-y-4">
              {slabs.map((s) => {
                const share = totals.taxable > 0 ? (s.taxable / totals.taxable) * 100 : 0;
                return (
                  <div key={s.rate}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium text-slate-700">
                        {s.rate}% slab
                        <span className="ml-2 text-xs text-slate-400">
                          {s.rate === 28 ? 'batteries' : 'inverters, solar, service'}
                        </span>
                      </span>
                      <span className="tnum text-slate-600">
                        {formatINR(s.taxable)} · tax {formatINR(s.tax)}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${s.rate === 28 ? 'bg-violet-500' : 'bg-brand-500'}`}
                        style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">HSN-wise summary</h2>
          <p className="text-xs text-slate-500">Required for the GSTR-1 HSN table</p>
        </div>
        {hsnRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No data for this period.</p>
        ) : (
          <table className="w-full min-w-[40rem]">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">HSN</th>
                <th className="th text-right">Rate</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Taxable</th>
                <th className="th text-right">CGST</th>
                <th className="th text-right">SGST</th>
                <th className="th text-right">IGST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hsnRows.map((r) => (
                <tr key={`${r.hsn}-${r.gstRate}`}>
                  <td className="td font-medium tnum">{r.hsn}</td>
                  <td className="td text-right tnum">{r.gstRate}%</td>
                  <td className="td text-right tnum">{r.qty}</td>
                  <td className="td text-right"><Money value={r.taxable} /></td>
                  <td className="td text-right text-slate-500"><Money value={r.cgst} /></td>
                  <td className="td text-right text-slate-500"><Money value={r.sgst} /></td>
                  <td className="td text-right text-slate-500"><Money value={r.igst} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Month-over-month history</h2>
          <p className="text-xs text-slate-500">Trailing 12 months</p>
        </div>
        <table className="w-full min-w-[36rem]">
          <thead className="bg-slate-50">
            <tr>
              <th className="th">Month</th>
              <th className="th text-right">Invoices</th>
              <th className="th text-right">Revenue</th>
              <th className="th text-right">Collected</th>
              <th className="th text-right">GST</th>
              <th className="th text-right">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {series.map((m, i) => {
              const prev = i > 0 ? series[i - 1].revenue : 0;
              const change = prev === 0 ? null : ((m.revenue - prev) / prev) * 100;
              return (
                <tr key={m.key} className={m.key === selected ? 'bg-brand-50/50' : ''}>
                  <td className="td font-medium">{m.label}</td>
                  <td className="td text-right tnum">{m.count}</td>
                  <td className="td text-right"><Money value={m.revenue} /></td>
                  <td className="td text-right text-emerald-700"><Money value={m.collected} /></td>
                  <td className="td text-right text-slate-500"><Money value={m.tax} /></td>
                  <td className="td text-right">
                    {change === null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className={`tnum font-medium ${change >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between">
      <dt className={bold ? 'font-semibold text-ink' : 'text-slate-500'}>{label}</dt>
      <dd className={bold ? 'font-bold text-ink' : 'font-medium text-slate-800'}>
        <Money value={value} />
      </dd>
    </div>
  );
}

function Metric({ label, value, accent = 'text-ink' }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-bold tnum ${accent}`}>{value}</p>
    </div>
  );
}
