import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatINR, money } from '../lib/gst.js';
import { inventoryHealth } from '../lib/analytics.js';
import { Money, Modal, Field, Empty, ErrorBanner, StatCard } from '../components/ui.jsx';

const CATEGORIES = ['All', 'Battery', 'Inverter', 'Solar', 'Stabilizer', 'Accessory', 'Service'];

const BLANK = {
  name: '', category: 'Battery', brand: '', model: '', hsn: '8507', unit: 'Nos',
  capacity: '', purchasePrice: 0, sellingPrice: 0, gstRate: 28, stockQty: 0,
  reorderLevel: 3, warrantyMonths: 0, exchangeValue: 0, trackSerial: false,
};

export default function Inventory({ data, refresh, notify }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const [editing, setEditing] = useState(null);
  const [restock, setRestock] = useState(null);
  const [error, setError] = useState('');

  const health = useMemo(() => inventoryHealth(data.products), [data.products]);

  const rows = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return data.products
      .filter((p) => (category === 'All' ? true : p.category === category))
      .filter((p) =>
        !needle
          ? true
          : [p.name, p.brand, p.model, p.capacity, p.hsn]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)));
  }, [data.products, q, category]);

  async function remove(p) {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await api.deleteProduct(p.id);
      await refresh();
      notify(`${p.name} deleted`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onRetry={() => setError('')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stock value (cost)" value={formatINR(health.costValue)} change={null}
          caption="capital in inventory" icon="₹" />
        <StatCard label="Retail value" value={formatINR(health.retailValue)} change={null}
          caption="if sold at list price" tone="green" icon="↑" />
        <StatCard label="Low stock" value={String(health.lowStock.length)} change={null}
          caption="at or below reorder level" tone="amber" icon="!" />
        <StatCard label="Out of stock" value={String(health.outOfStock.length)} change={null}
          caption="needs immediate reorder" tone="rose" icon="✕" />
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input className="input max-w-xs flex-1" placeholder="Search product, brand, capacity…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                category === c ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {c}
            </button>
          ))}
        </div>
        <button type="button" className="btn-primary ml-auto" onClick={() => setEditing({ ...BLANK })}>
          + New product
        </button>
      </div>

      {rows.length === 0 ? (
        <Empty title="No products found" subtitle="Adjust the filters or add a new product." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[56rem]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Product</th>
                <th className="th">HSN</th>
                <th className="th text-right">GST</th>
                <th className="th text-right">Cost</th>
                <th className="th text-right">Price</th>
                <th className="th text-right">Margin</th>
                <th className="th text-right">Stock</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const margin = money(p.sellingPrice - p.purchasePrice);
                const marginPct = p.purchasePrice > 0
                  ? Math.round((margin / p.purchasePrice) * 100) : null;
                const low = p.category !== 'Service' && p.stockQty <= p.reorderLevel;
                const out = p.category !== 'Service' && p.stockQty <= 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="td">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-400">
                        {[p.brand, p.capacity, p.model].filter(Boolean).join(' · ') || p.category}
                        {p.warrantyMonths ? ` · ${p.warrantyMonths}m warranty` : ''}
                      </div>
                    </td>
                    <td className="td text-xs text-slate-500 tnum">{p.hsn}</td>
                    <td className="td text-right">
                      <span className={`chip ${p.gstRate === 28 ? 'bg-violet-50 text-violet-700' : 'bg-brand-50 text-brand-700'}`}>
                        {p.gstRate}%
                      </span>
                    </td>
                    <td className="td text-right text-slate-500"><Money value={p.purchasePrice} /></td>
                    <td className="td text-right font-medium"><Money value={p.sellingPrice} /></td>
                    <td className="td text-right">
                      <Money value={margin} className="text-emerald-700" />
                      {marginPct !== null ? (
                        <div className="text-xs text-slate-400 tnum">{marginPct}%</div>
                      ) : null}
                    </td>
                    <td className="td text-right">
                      {p.category === 'Service' ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={`chip ${
                          out ? 'bg-rose-50 text-rose-700'
                            : low ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {p.stockQty} {p.unit}
                        </span>
                      )}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      {p.category !== 'Service' ? (
                        <button type="button" className="text-sm font-medium text-brand-700 hover:underline"
                          onClick={() => setRestock(p)}>
                          Add stock
                        </button>
                      ) : null}
                      <button type="button" className="ml-3 text-sm font-medium text-slate-600 hover:underline"
                        onClick={() => setEditing(p)}>
                        Edit
                      </button>
                      <button type="button" className="ml-3 text-sm text-slate-400 hover:text-rose-600"
                        onClick={() => remove(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ProductModal product={editing} onClose={() => setEditing(null)} refresh={refresh} notify={notify} />
      <RestockModal product={restock} onClose={() => setRestock(null)} refresh={refresh} notify={notify} />
    </div>
  );
}

function ProductModal({ product, onClose, refresh, notify }) {
  const [form, setForm] = useState(product || BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => { setForm(product || BLANK); setError(''); }, [product]);

  if (!product) return null;
  const isNew = !product.id;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    setBusy(true); setError('');
    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice) || 0,
        sellingPrice: Number(form.sellingPrice) || 0,
        gstRate: Number(form.gstRate),
        stockQty: Number(form.stockQty) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        warrantyMonths: Number(form.warrantyMonths) || 0,
        exchangeValue: Number(form.exchangeValue) || 0,
      };
      if (isNew) await api.createProduct(payload);
      else await api.updateProduct(product.id, payload);
      await refresh();
      notify(isNew ? `${form.name} added` : `${form.name} updated`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open wide title={isNew ? 'New product' : 'Edit product'} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name *">
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>
        </div>
        <Field label="Category">
          <select className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="GST slab" hint="Batteries 28% · everything else 18%">
          <select className="input" value={form.gstRate}
            onChange={(e) => set({ gstRate: Number(e.target.value) })}>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
        </Field>
        <Field label="Brand">
          <input className="input" value={form.brand} onChange={(e) => set({ brand: e.target.value })} />
        </Field>
        <Field label="Model">
          <input className="input" value={form.model} onChange={(e) => set({ model: e.target.value })} />
        </Field>
        <Field label="HSN code">
          <input className="input" value={form.hsn} onChange={(e) => set({ hsn: e.target.value })} />
        </Field>
        <Field label="Capacity">
          <input className="input" value={form.capacity} onChange={(e) => set({ capacity: e.target.value })}
            placeholder="150Ah / 900VA / 330W" />
        </Field>
        <Field label="Purchase price (₹)">
          <input type="number" min="0" step="0.01" className="input" value={form.purchasePrice}
            onChange={(e) => set({ purchasePrice: e.target.value })} />
        </Field>
        <Field label="Selling price (₹)">
          <input type="number" min="0" step="0.01" className="input" value={form.sellingPrice}
            onChange={(e) => set({ sellingPrice: e.target.value })} />
        </Field>
        <Field label="Unit">
          <input className="input" value={form.unit} onChange={(e) => set({ unit: e.target.value })} />
        </Field>
        <Field label="Stock quantity">
          <input type="number" step="1" className="input" value={form.stockQty}
            onChange={(e) => set({ stockQty: e.target.value })} disabled={!isNew}
            title={isNew ? '' : 'Use "Add stock" to change quantity so the movement is logged'} />
        </Field>
        <Field label="Reorder level">
          <input type="number" min="0" className="input" value={form.reorderLevel}
            onChange={(e) => set({ reorderLevel: e.target.value })} />
        </Field>
        <Field label="Warranty (months)">
          <input type="number" min="0" className="input" value={form.warrantyMonths}
            onChange={(e) => set({ warrantyMonths: e.target.value })} />
        </Field>
        <Field label="Exchange value (₹)" hint="Old battery buy-back allowance">
          <input type="number" min="0" className="input" value={form.exchangeValue}
            onChange={(e) => set({ exchangeValue: e.target.value })} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300"
            checked={Boolean(form.trackSerial)}
            onChange={(e) => set({ trackSerial: e.target.checked })} />
          Track serial numbers
        </label>
      </div>
    </Modal>
  );
}

function RestockModal({ product, onClose, refresh, notify }) {
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Purchase');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => { setQty(''); setReason('Purchase'); setError(''); }, [product]);

  if (!product) return null;

  async function submit() {
    setBusy(true); setError('');
    try {
      await api.addStock(product.id, { qty: Number(qty), reason });
      await refresh();
      notify(`${qty} ${product.unit} added to ${product.name}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open title={`Add stock — ${product.name}`} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy || !qty}>
            {busy ? 'Saving…' : 'Add stock'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <p className="mb-3 text-sm text-slate-600">
        Current stock <strong className="tnum">{product.stockQty} {product.unit}</strong>
      </p>
      <div className="space-y-3">
        <Field label="Quantity received" hint="Use a negative number to correct an error">
          <input type="number" step="1" className="input" value={qty}
            onChange={(e) => setQty(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason / supplier bill no">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
