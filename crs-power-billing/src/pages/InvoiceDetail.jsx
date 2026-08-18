import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, IS_EMBEDDED } from '../api.js';
import { formatINR, money, amountInWords, hsnSummary } from '../lib/gst.js';
import { Money, StatusChip, Modal, Field, Spinner, ErrorBanner } from '../components/ui.jsx';

export default function InvoiceDetail({ data, refresh, notify }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const invoice = data.invoices.find((i) => i.id === id);
  const business = data.business;

  const [gateways, setGateways] = useState([]);
  const [payOpen, setPayOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (IS_EMBEDDED) return;
    api.gateways().then(setGateways).catch(() => {});
  }, []);

  const hsnRows = useMemo(
    () => (invoice ? hsnSummary(invoice.items, invoice.interState) : []),
    [invoice],
  );

  if (!invoice) return <Spinner label="Loading invoice…" />;

  const balance = money(invoice.grandTotal - invoice.paidAmount);

  async function remove() {
    if (!window.confirm(`Delete ${invoice.invoiceNo}? Stock will be restored.`)) return;
    try {
      await api.deleteInvoice(invoice.id);
      await refresh();
      notify(`${invoice.invoiceNo} deleted, stock restored`);
      navigate('/invoices');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/invoices" className="text-sm text-slate-500 hover:underline">← All invoices</Link>
          <h1 className="mt-0.5 text-xl font-bold text-ink tnum">{invoice.invoiceNo}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={() => window.print()}>Print / PDF</button>
          {balance > 0.009 ? (
            <>
              <button type="button" className="btn-ghost" onClick={() => setPayOpen(true)}>
                Record payment
              </button>
              {!IS_EMBEDDED ? (
                <button type="button" className="btn-primary" onClick={() => setOnlineOpen(true)}>
                  Collect online
                </button>
              ) : null}
            </>
          ) : null}
          <button type="button" className="btn-danger" onClick={remove}>Delete</button>
        </div>
      </div>

      {/* printable invoice */}
      <div className="card overflow-hidden print:border-0 print:shadow-none" id="invoice-sheet">
        <div className="bg-brand-700 px-6 py-5 text-white print:bg-brand-700">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">{business.name}</h2>
              <p className="text-xs text-brand-100">{business.tagline}</p>
              <p className="mt-1.5 text-xs text-brand-100">
                {business.addressLine}, {business.city} – {business.pincode}
              </p>
              <p className="text-xs text-brand-100">
                {business.phone} · {business.email}
              </p>
              <p className="text-xs font-semibold text-white">GSTIN {business.gstin}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold uppercase tracking-wide">Tax Invoice</p>
              <p className="text-sm font-semibold tnum">{invoice.invoiceNo}</p>
              <p className="text-xs text-brand-100">
                {new Date(invoice.date).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric',
                })}
              </p>
              <div className="mt-1.5 flex justify-end"><StatusChip status={invoice.status} /></div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 p-6 sm:grid-cols-2">
          <div>
            <p className="label">Bill to</p>
            <p className="font-semibold text-ink">{invoice.customerName}</p>
            {invoice.customerAddress ? (
              <p className="text-sm text-slate-600">{invoice.customerAddress}</p>
            ) : null}
            {invoice.customerPhone ? (
              <p className="text-sm text-slate-600">{invoice.customerPhone}</p>
            ) : null}
            {invoice.customerGstin ? (
              <p className="text-sm font-medium text-slate-700">GSTIN {invoice.customerGstin}</p>
            ) : null}
          </div>
          <div className="sm:text-right">
            <p className="label">Supply details</p>
            <p className="text-sm text-slate-600">Place of supply: {invoice.placeOfSupply}</p>
            <p className="text-sm text-slate-600">
              Tax type:{' '}
              <span className={invoice.interState ? 'font-semibold text-violet-700' : 'font-semibold text-brand-700'}>
                {invoice.interState ? 'IGST (inter-state)' : 'CGST + SGST (intra-state)'}
              </span>
            </p>
            <p className="text-sm text-slate-600">
              Due: {new Date(invoice.dueDate).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem]">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">#</th>
                <th className="th">Description</th>
                <th className="th">HSN</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Rate</th>
                <th className="th text-right">Taxable</th>
                <th className="th text-right">GST</th>
                <th className="th text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items.map((item, i) => (
                <tr key={`${item.productId}-${i}`}>
                  <td className="td text-slate-400">{i + 1}</td>
                  <td className="td">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    {item.serials ? (
                      <div className="text-xs text-brand-700">S/N {item.serials}</div>
                    ) : null}
                    {item.warrantyMonths ? (
                      <div className="text-xs text-slate-400">Warranty {item.warrantyMonths} months</div>
                    ) : null}
                  </td>
                  <td className="td text-slate-500 tnum">{item.hsn}</td>
                  <td className="td text-right tnum">{item.qty} {item.unit}</td>
                  <td className="td text-right"><Money value={item.rate} /></td>
                  <td className="td text-right"><Money value={item.taxable} /></td>
                  <td className="td text-right text-slate-500 tnum">{item.gstRate}%</td>
                  <td className="td text-right font-semibold"><Money value={item.total} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 border-t border-slate-200 p-6 sm:grid-cols-2">
          <div>
            <p className="label">HSN / tax summary</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 text-left font-semibold">HSN</th>
                  <th className="py-1 text-right font-semibold">Taxable</th>
                  <th className="py-1 text-right font-semibold">Tax</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {hsnRows.map((r) => (
                  <tr key={r.hsn}>
                    <td className="py-0.5 tnum">{r.hsn} ({r.gstRate}%)</td>
                    <td className="py-0.5 text-right tnum">{formatINR(r.taxable)}</td>
                    <td className="py-0.5 text-right tnum">{formatINR(money(r.cgst + r.sgst + r.igst))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="label mt-4">Amount in words</p>
            <p className="text-sm font-medium italic text-slate-700">{amountInWords(invoice.grandTotal)}</p>

            <p className="label mt-4">Payment details</p>
            <p className="text-xs text-slate-600">{business.bankName}</p>
            <p className="text-xs text-slate-600 tnum">A/C {business.accountNo} · IFSC {business.ifsc}</p>
            <p className="text-xs font-semibold text-brand-700">UPI {business.upiId}</p>
          </div>

          <div>
            <dl className="space-y-1.5 text-sm">
              <Row label="Sub total" value={invoice.subTotal} />
              {invoice.discount > 0 ? <Row label="Discount" value={-invoice.discount} /> : null}
              <Row label="Taxable value" value={invoice.taxable} />
              {invoice.interState ? (
                <Row label="IGST" value={invoice.igst} />
              ) : (
                <>
                  <Row label="CGST" value={invoice.cgst} />
                  <Row label="SGST" value={invoice.sgst} />
                </>
              )}
              {invoice.exchange > 0 ? <Row label="Old battery exchange" value={-invoice.exchange} /> : null}
              {invoice.roundOff !== 0 ? <Row label="Round off" value={invoice.roundOff} /> : null}
            </dl>
            <div className="mt-3 flex items-baseline justify-between rounded-lg bg-brand-700 px-4 py-2.5 text-white">
              <span className="text-sm font-semibold">Grand total</span>
              <span className="text-lg font-bold tnum">{formatINR(invoice.grandTotal)}</span>
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between text-emerald-700">
                <span>Paid</span><Money value={invoice.paidAmount} />
              </div>
              {balance > 0.009 ? (
                <div className="flex justify-between font-semibold text-rose-600">
                  <span>Balance due</span><Money value={balance} />
                </div>
              ) : null}
            </div>

            <div className="mt-5 border-t border-slate-200 pt-3 text-right">
              <p className="text-xs text-slate-500">For {business.name}</p>
              <div className="mt-8 border-t border-slate-300 pt-1 text-xs text-slate-500">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 print:bg-white">
          <p className="label">Terms &amp; conditions</p>
          <ol className="list-inside list-decimal text-xs text-slate-500">
            {business.terms.map((t) => <li key={t}>{t}</li>)}
          </ol>
        </div>
      </div>

      {/* payment history */}
      {invoice.payments.length > 0 ? (
        <div className="card p-5 print:hidden">
          <h2 className="mb-3 text-sm font-semibold text-ink">Payment history</h2>
          <ul className="divide-y divide-slate-100">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{p.mode}</span>
                  <span className="ml-2 text-slate-400">
                    {new Date(p.date).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {p.gateway && p.gateway !== 'manual' ? (
                    <span className="ml-2 chip bg-slate-100 text-slate-600">{p.gateway}</span>
                  ) : null}
                  {p.simulated ? (
                    <span className="ml-1.5 chip bg-amber-50 text-amber-700">simulated</span>
                  ) : null}
                  {p.reference ? (
                    <span className="ml-2 text-xs text-slate-400 tnum">{p.reference}</span>
                  ) : null}
                </div>
                <Money value={p.amount} className="font-semibold text-emerald-700" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <RecordPaymentModal
        open={payOpen} onClose={() => setPayOpen(false)}
        invoice={invoice} balance={balance} refresh={refresh} notify={notify}
      />
      <OnlinePaymentModal
        open={onlineOpen} onClose={() => setOnlineOpen(false)}
        invoice={invoice} balance={balance} gateways={gateways} refresh={refresh} notify={notify}
      />
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

function RecordPaymentModal({ open, onClose, invoice, balance, refresh, notify }) {
  const [amount, setAmount] = useState(String(balance));
  const [mode, setMode] = useState('Cash');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setAmount(String(balance)); setError(''); } }, [open, balance]);

  async function submit() {
    setBusy(true); setError('');
    try {
      await api.addPayment(invoice.id, { amount: Number(amount), mode, reference });
      await refresh();
      notify(`Payment of ${formatINR(Number(amount))} recorded`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Record payment"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Save payment'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <p className="mb-3 text-sm text-slate-600">
        Outstanding balance <strong className="text-rose-600 tnum">{formatINR(balance)}</strong>
      </p>
      <div className="space-y-3">
        <Field label="Amount (₹)">
          <input type="number" min="0" step="0.01" className="input" value={amount}
            onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Mode">
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
            {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Reference / UTR">
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)}
            placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}

function OnlinePaymentModal({ open, onClose, invoice, balance, gateways, refresh, notify }) {
  const [gateway, setGateway] = useState('razorpay');
  const [amount, setAmount] = useState(String(balance));
  const [stage, setStage] = useState('form'); // form | order | done
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setStage('form'); setOrder(null); setError(''); setAmount(String(balance)); }
  }, [open, balance]);

  const selected = gateways.find((g) => g.id === gateway);

  async function createOrder() {
    setBusy(true); setError('');
    try {
      const created = await api.createOrder(invoice.id, gateway, Number(amount));
      setOrder(created);
      setStage('order');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true); setError('');
    try {
      const res = await api.confirmPayment(invoice.id, gateway, {
        orderId: order.orderId,
        paymentId: `pay_${Math.random().toString(36).slice(2, 12)}`,
      });
      await refresh();
      notify(res.simulated
        ? `Simulated ${selected?.label} payment recorded`
        : `${selected?.label} payment confirmed`);
      setStage('done');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} title="Collect payment online"
      footer={
        stage === 'form' ? (
          <>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" onClick={createOrder} disabled={busy}>
              {busy ? 'Creating…' : 'Create payment order'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost" onClick={() => setStage('form')}>Back</button>
            <button type="button" className="btn-primary" onClick={confirm} disabled={busy}>
              {busy ? 'Confirming…' : 'Complete payment'}
            </button>
          </>
        )
      }
    >
      <ErrorBanner message={error} />

      {stage === 'form' ? (
        <div className="space-y-3">
          <Field label="Gateway">
            <div className="grid gap-2 sm:grid-cols-3">
              {gateways.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGateway(g.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition ${
                    gateway === g.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-800">{g.label}</span>
                  <span className={`chip mt-1 ${g.live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {g.live ? 'live' : 'simulation'}
                  </span>
                </button>
              ))}
            </div>
          </Field>

          <Field label="Amount (₹)" hint={`Cannot exceed the balance of ${formatINR(balance)}`}>
            <input type="number" min="0" step="0.01" className="input" value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </Field>

          {selected && !selected.live ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <strong>{selected.label} keys are not configured.</strong> The flow will run in
              simulation mode — an order is created and the payment is recorded, but no real
              money moves. Add the API keys to <code>.env</code> to go live.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <Line label="Gateway" value={selected?.label} />
            <Line label="Order ID" value={order?.orderId} mono />
            <Line label="Amount" value={formatINR(order?.amount || 0)} />
            <Line label="Mode" value={order?.mode} />
          </div>
          {order?.mode === 'simulation' ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              {order.note} Clicking <strong>Complete payment</strong> marks the invoice as paid
              and tags the entry as simulated.
            </p>
          ) : (
            <p className="rounded-lg bg-brand-50 px-3 py-2.5 text-xs text-brand-800">
              In production the {selected?.label} checkout opens here. The confirmation is then
              verified against the gateway signature on the server before the invoice is updated.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Line({ label, value, mono }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className={`font-medium text-slate-800 ${mono ? 'tnum text-xs' : ''}`}>{value}</span>
    </div>
  );
}
