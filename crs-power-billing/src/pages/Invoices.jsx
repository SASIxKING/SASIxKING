import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatINR, money } from '../lib/gst.js';
import { Money, StatusChip, Empty } from '../components/ui.jsx';

const STATUSES = ['All', 'UNPAID', 'PARTIAL', 'PAID'];

export default function Invoices({ data }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');

  const rows = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return [...data.invoices]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((i) => (status === 'All' ? true : i.status === status))
      .filter((i) =>
        !needle
          ? true
          : [i.invoiceNo, i.customerName, i.customerPhone]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)));
  }, [data.invoices, q, status]);

  const totals = useMemo(() => ({
    billed: money(rows.reduce((a, i) => a + i.grandTotal, 0)),
    due: money(rows.reduce((a, i) => a + (i.grandTotal - i.paidAmount), 0)),
  }), [rows]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          className="input max-w-xs flex-1"
          placeholder="Search invoice no, customer, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                status === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-5 text-sm">
          <span className="text-slate-500">
            Billed <strong className="text-ink tnum">{formatINR(totals.billed)}</strong>
          </span>
          <span className="text-slate-500">
            Due <strong className="text-rose-600 tnum">{formatINR(totals.due)}</strong>
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty
          title="No invoices match"
          subtitle="Try a different search term or status filter."
          action={<Link to="/invoices/new" className="btn-primary">Create invoice</Link>}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[52rem]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Invoice</th>
                <th className="th">Date</th>
                <th className="th">Customer</th>
                <th className="th text-right">Taxable</th>
                <th className="th text-right">GST</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Balance</th>
                <th className="th text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((inv) => {
                const balance = money(inv.grandTotal - inv.paidAmount);
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="td">
                      <Link to={`/invoices/${inv.id}`} className="font-semibold text-brand-700 hover:underline">
                        {inv.invoiceNo}
                      </Link>
                    </td>
                    <td className="td whitespace-nowrap text-slate-500">
                      {new Date(inv.date).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: '2-digit',
                      })}
                    </td>
                    <td className="td">
                      <div className="max-w-[16rem] truncate font-medium text-slate-800">{inv.customerName}</div>
                      <div className="text-xs text-slate-400">
                        {inv.interState ? 'IGST' : 'CGST+SGST'} · {inv.placeOfSupply}
                      </div>
                    </td>
                    <td className="td text-right"><Money value={inv.taxable} /></td>
                    <td className="td text-right text-slate-500"><Money value={inv.totalTax} /></td>
                    <td className="td text-right font-semibold"><Money value={inv.grandTotal} /></td>
                    <td className="td text-right">
                      {balance > 0.009
                        ? <Money value={balance} className="font-semibold text-rose-600" />
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="td text-right"><StatusChip status={inv.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
