import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, money } from '../lib/gst.js';
import {
  monthlySeries,
  monthOverMonth,
  categoryBreakdown,
  topProducts,
  receivablesAgeing,
  inventoryHealth,
} from '../lib/analytics.js';
import { StatCard, Money, StatusChip, TrendPill } from '../components/ui.jsx';
import { RevenueBars, TaxLine, CategoryBars } from '../components/Charts.jsx';

export default function Dashboard({ data }) {
  const { invoices, products } = data;

  const analytics = useMemo(() => {
    const series = monthlySeries(invoices, { months: 6 });
    const mom = monthOverMonth(invoices);
    return {
      series,
      mom,
      categories: categoryBreakdown(invoices, products),
      top: topProducts(invoices, { limit: 5 }),
      ageing: receivablesAgeing(invoices),
      stock: inventoryHealth(products),
    };
  }, [invoices, products]);

  const { series, mom, categories, top, ageing, stock } = analytics;

  const outstanding = useMemo(
    () => money(invoices.reduce((a, i) => a + (i.grandTotal - i.paidAmount), 0)),
    [invoices],
  );

  const recent = useMemo(
    () => [...invoices].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [invoices],
  );

  const alerts = [...stock.outOfStock, ...stock.lowStock];

  return (
    <div className="space-y-5">
      {/* headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatINR(mom.current.revenue)}
          change={mom.revenueChange}
          caption={`${mom.current.count} invoices`}
          icon="₹"
        />
        <StatCard
          label="Collected"
          value={formatINR(mom.current.collected)}
          change={mom.collectedChange}
          caption="payments received"
          tone="green"
          icon="✓"
        />
        <StatCard
          label="GST liability"
          value={formatINR(mom.current.tax)}
          change={mom.taxChange}
          caption="CGST + SGST + IGST"
          tone="amber"
          icon="%"
        />
        <StatCard
          label="Outstanding"
          value={formatINR(outstanding)}
          change={null}
          caption="across all unpaid bills"
          tone="rose"
          icon="!"
        />
      </div>

      {/* trend charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Billing trend</h2>
              <p className="text-xs text-slate-500">Last 6 months — billed vs collected</p>
            </div>
            <TrendPill change={mom.revenueChange} />
          </div>
          <RevenueBars series={series} />
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-ink">GST liability trend</h2>
            <p className="text-xs text-slate-500">Tax collected per month</p>
          </div>
          <TaxLine series={series} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* category mix */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Sales mix this month</h2>
          <CategoryBars rows={categories} />
        </div>

        {/* top products */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Top products this month</h2>
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No sales yet this month.</p>
          ) : (
            <ul className="space-y-2.5">
              {top.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-slate-100 text-xs font-semibold text-slate-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.name}</span>
                  <span className="shrink-0 text-xs text-slate-400 tnum">{p.qty}×</span>
                  <Money value={p.revenue} className="shrink-0 text-sm font-semibold" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* receivables ageing */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Receivables ageing</h2>
          <ul className="space-y-2.5">
            {ageing.map((b) => (
              <li key={b.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {b.label}
                  {b.count ? <span className="ml-1.5 text-xs text-slate-400">({b.count})</span> : null}
                </span>
                <Money
                  value={b.amount}
                  className={`text-sm font-semibold ${b.amount > 0 && b.label !== 'Not due' ? 'text-rose-600' : 'text-slate-700'}`}
                />
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Total due</span>
              <Money value={outstanding} className="text-sm font-bold text-rose-600" />
            </div>
          </div>
        </div>
      </div>

      {/* stock + recent invoices */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Inventory value</h2>
          <p className="mb-4 text-xs text-slate-500">At purchase cost</p>
          <p className="text-2xl font-bold text-ink tnum">{formatINR(stock.costValue)}</p>
          <p className="mt-1 text-xs text-slate-500 tnum">
            Retail {formatINR(stock.retailValue)} · margin {formatINR(stock.potentialMargin)}
          </p>

          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reorder alerts
          </h3>
          {alerts.length === 0 ? (
            <p className="text-sm text-emerald-700">All items are above their reorder level.</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-slate-700">{p.name}</span>
                  <span
                    className={`chip shrink-0 ${p.stockQty <= 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {p.stockQty <= 0 ? 'Out of stock' : `${p.stockQty} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/inventory" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
            Manage inventory →
          </Link>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Recent invoices</h2>
            <Link to="/invoices" className="text-sm font-semibold text-brand-700 hover:underline">
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Invoice</th>
                  <th className="th">Customer</th>
                  <th className="th text-right">Amount</th>
                  <th className="th text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="td">
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-brand-700 hover:underline">
                        {inv.invoiceNo}
                      </Link>
                      <div className="text-xs text-slate-400">
                        {new Date(inv.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </div>
                    </td>
                    <td className="td">
                      <div className="max-w-[14rem] truncate">{inv.customerName}</div>
                      {inv.interState ? (
                        <span className="text-xs text-violet-600">IGST</span>
                      ) : (
                        <span className="text-xs text-slate-400">CGST+SGST</span>
                      )}
                    </td>
                    <td className="td text-right font-semibold">
                      <Money value={inv.grandTotal} />
                    </td>
                    <td className="td text-right">
                      <StatusChip status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
