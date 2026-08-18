import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { computeInvoiceTotals, isInterState, formatINR, amountInWords } from '../lib/gst.js';
import { Field, Money, ErrorBanner } from '../components/ui.jsx';

export default function NewInvoice({ data, refresh, notify }) {
  const navigate = useNavigate();
  const { customers, products } = data;

  const [invoiceNo, setInvoiceNo] = useState('…');
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState([]);
  const [exchange, setExchange] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.nextInvoiceNo().then((r) => setInvoiceNo(r.invoiceNo)).catch(() => setInvoiceNo('CRS/…'));
  }, []);

  const customer = customers.find((c) => c.id === customerId) || null;
  const interState = customer ? isInterState(customer.stateCode) : false;

  const totals = useMemo(
    () => computeInvoiceTotals(lines, { interState, exchange: Number(exchange) || 0 }),
    [lines, interState, exchange],
  );

  function addProduct(productId) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setPicker('');
    setLines((prev) => {
      const existing = prev.findIndex((l) => l.productId === p.id);
      if (existing !== -1) {
        const next = [...prev];
        next[existing] = { ...next[existing], qty: Number(next[existing].qty) + 1 };
        return next;
      }
      return [...prev, {
        productId: p.id,
        name: p.name,
        hsn: p.hsn,
        unit: p.unit,
        qty: 1,
        rate: p.sellingPrice,
        discountPct: 0,
        gstRate: p.gstRate,
        serials: '',
        stockQty: p.stockQty,
        category: p.category,
        trackSerial: p.trackSerial,
      }];
    });
  }

  const updateLine = (i, patch) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLine = (i) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  // Warn before the server rejects it.
  const stockProblem = lines.find(
    (l) => l.category !== 'Service' && Number(l.qty) > Number(l.stockQty),
  );

  async function save() {
    setError('');
    if (!customerId) return setError('Select a customer first.');
    if (lines.length === 0) return setError('Add at least one item.');

    setSaving(true);
    try {
      const invoice = await api.createInvoice({
        customerId,
        items: lines.map((l) => ({
          productId: l.productId,
          qty: Number(l.qty),
          rate: Number(l.rate),
          discountPct: Number(l.discountPct) || 0,
          serials: l.serials,
        })),
        exchange: Number(exchange) || 0,
        paidAmount: Number(paidAmount) || 0,
        paymentMode,
        notes,
      });
      await refresh();
      notify(`Invoice ${invoice.invoiceNo} created`);
      navigate(`/invoices/${invoice.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <ErrorBanner message={error} />

        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Invoice details</h2>
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 tnum">
              {invoiceNo}
            </span>
          </div>

          <Field label="Customer">
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">— Select a customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.city ? `· ${c.city}` : ''} {c.gstin ? `· ${c.gstin}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {customer ? (
            <div className={`mt-3 rounded-lg px-3 py-2.5 text-sm ${interState ? 'bg-violet-50 text-violet-800' : 'bg-brand-50 text-brand-800'}`}>
              <strong>{interState ? 'Inter-state supply → IGST' : 'Intra-state supply → CGST + SGST'}</strong>
              <span className="ml-2 opacity-80">
                Place of supply {customer.stateCode}-{customer.state}
                {customer.creditDays ? ` · ${customer.creditDays} days credit` : ''}
              </span>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Items ({lines.length})</h2>
            <select className="input max-w-xs" value={picker} onChange={(e) => addProduct(e.target.value)}>
              <option value="">+ Add product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatINR(p.sellingPrice)} · {p.gstRate}%
                  {p.category !== 'Service' ? ` · stock ${p.stockQty}` : ''}
                </option>
              ))}
            </select>
          </div>

          {lines.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              No items yet. Use the dropdown above to add batteries, inverters or services.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Item</th>
                    <th className="th w-20 text-right">Qty</th>
                    <th className="th w-28 text-right">Rate</th>
                    <th className="th w-20 text-right">Disc %</th>
                    <th className="th w-16 text-right">GST</th>
                    <th className="th w-28 text-right">Amount</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, i) => {
                    const computed = totals.lines[i];
                    const over = l.category !== 'Service' && Number(l.qty) > Number(l.stockQty);
                    return (
                      <tr key={`${l.productId}-${i}`}>
                        <td className="td">
                          <div className="font-medium text-slate-800">{l.name}</div>
                          <div className="text-xs text-slate-400">
                            HSN {l.hsn} · {l.unit}
                            {l.category !== 'Service' ? ` · stock ${l.stockQty}` : ''}
                          </div>
                          {over ? (
                            <div className="mt-0.5 text-xs font-medium text-rose-600">
                              Only {l.stockQty} in stock
                            </div>
                          ) : null}
                          {l.trackSerial ? (
                            <input
                              className="input mt-1.5 py-1 text-xs"
                              placeholder="Serial numbers (comma separated)"
                              value={l.serials}
                              onChange={(e) => updateLine(i, { serials: e.target.value })}
                            />
                          ) : null}
                        </td>
                        <td className="td">
                          <input
                            type="number" min="0" step="1"
                            className={`input py-1 text-right ${over ? 'border-rose-300' : ''}`}
                            value={l.qty}
                            onChange={(e) => updateLine(i, { qty: e.target.value })}
                          />
                        </td>
                        <td className="td">
                          <input
                            type="number" min="0" step="0.01"
                            className="input py-1 text-right"
                            value={l.rate}
                            onChange={(e) => updateLine(i, { rate: e.target.value })}
                          />
                        </td>
                        <td className="td">
                          <input
                            type="number" min="0" max="100" step="0.5"
                            className="input py-1 text-right"
                            value={l.discountPct}
                            onChange={(e) => updateLine(i, { discountPct: e.target.value })}
                          />
                        </td>
                        <td className="td text-right text-slate-500 tnum">{l.gstRate}%</td>
                        <td className="td text-right font-semibold tnum">
                          {formatINR(computed?.total || 0)}
                        </td>
                        <td className="td text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label={`Remove ${l.name}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Old battery exchange (₹)" hint="Buy-back allowance deducted from the total">
            <input type="number" min="0" step="1" className="input" value={exchange}
              onChange={(e) => setExchange(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Amount received now (₹)">
            <input type="number" min="0" step="1" className="input" value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Payment mode">
            <select className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery instructions, PO number…" />
          </Field>
        </div>
      </div>

      {/* summary rail */}
      <div className="lg:sticky lg:top-6 lg:h-fit">
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Summary</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Sub total" value={totals.subTotal} />
            {totals.discount > 0 ? <Row label="Discount" value={-totals.discount} /> : null}
            <Row label="Taxable value" value={totals.taxable} />
            {interState ? (
              <Row label="IGST" value={totals.igst} />
            ) : (
              <>
                <Row label="CGST" value={totals.cgst} />
                <Row label="SGST" value={totals.sgst} />
              </>
            )}
            {totals.exchange > 0 ? <Row label="Exchange" value={-totals.exchange} /> : null}
            {totals.roundOff !== 0 ? <Row label="Round off" value={totals.roundOff} /> : null}
          </dl>

          <div className="mt-4 flex items-baseline justify-between border-t border-slate-200 pt-3">
            <span className="text-sm font-semibold text-ink">Grand total</span>
            <span className="text-xl font-bold text-brand-700 tnum">{formatINR(totals.grandTotal)}</span>
          </div>

          {totals.grandTotal > 0 ? (
            <p className="mt-2 text-xs italic text-slate-500">{amountInWords(totals.grandTotal)}</p>
          ) : null}

          {Number(paidAmount) > 0 ? (
            <div className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-emerald-700">
                <span>Paid now</span><Money value={Number(paidAmount)} />
              </div>
              <div className="flex justify-between font-semibold text-rose-600">
                <span>Balance</span>
                <Money value={Math.max(0, totals.grandTotal - Number(paidAmount))} />
              </div>
            </div>
          ) : null}

          {stockProblem ? (
            <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {stockProblem.name}: only {stockProblem.stockQty} in stock. Reduce the quantity or add stock first.
            </p>
          ) : null}

          <button
            type="button"
            onClick={save}
            disabled={saving || !customerId || lines.length === 0 || Boolean(stockProblem)}
            className="btn-primary mt-4 w-full"
          >
            {saving ? 'Saving…' : 'Create invoice'}
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">
            GST is recalculated on the server before saving.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800"><Money value={value} /></dd>
    </div>
  );
}
