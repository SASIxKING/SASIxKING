import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { formatINR } from '../lib/gst.js';
import { Money, Modal, Field, Empty, ErrorBanner } from '../components/ui.jsx';

const BLANK = {
  name: '', type: 'Retail', phone: '', email: '', gstin: '',
  address: '', city: 'Pondicherry', state: 'Puducherry', stateCode: '34',
  pincode: '', creditDays: 0, notes: '',
};

export default function Customers({ data, refresh, notify }) {
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const rows = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return data.customers.filter((c) =>
      !needle
        ? true
        : [c.name, c.phone, c.city, c.gstin, c.email]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(needle)));
  }, [data.customers, q]);

  // balances computed from invoices so the list is always truthful
  const withBalance = useMemo(() => rows.map((c) => {
    const invs = data.invoices.filter((i) => i.customerId === c.id);
    const billed = invs.reduce((a, i) => a + i.grandTotal, 0);
    const paid = invs.reduce((a, i) => a + i.paidAmount, 0);
    return { ...c, billed, balance: billed - paid, count: invs.length };
  }), [rows, data.invoices]);

  async function remove(c) {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try {
      await api.deleteCustomer(c.id);
      await refresh();
      notify(`${c.name} deleted`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onRetry={() => setError('')} />

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          className="input max-w-xs flex-1"
          placeholder="Search name, phone, city, GSTIN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="text-sm text-slate-500">{withBalance.length} customers</span>
        <button type="button" className="btn-primary ml-auto" onClick={() => setEditing({ ...BLANK })}>
          + New customer
        </button>
      </div>

      {withBalance.length === 0 ? (
        <Empty title="No customers found" subtitle="Add your first customer to start billing." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[46rem]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Customer</th>
                <th className="th">Contact</th>
                <th className="th">GSTIN</th>
                <th className="th text-right">Invoices</th>
                <th className="th text-right">Billed</th>
                <th className="th text-right">Balance</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {withBalance.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td">
                    <div className="font-medium text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-400">
                      <span className="chip mr-1 bg-slate-100 text-slate-600">{c.type}</span>
                      {c.city}
                      {c.stateCode !== '34' ? (
                        <span className="ml-1 text-violet-600">· inter-state</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="td text-slate-600">
                    <div className="tnum">{c.phone || '—'}</div>
                    {c.email ? <div className="text-xs text-slate-400">{c.email}</div> : null}
                  </td>
                  <td className="td text-xs text-slate-500 tnum">{c.gstin || '—'}</td>
                  <td className="td text-right tnum">{c.count}</td>
                  <td className="td text-right"><Money value={c.billed} /></td>
                  <td className="td text-right">
                    {c.balance > 0.009
                      ? <Money value={c.balance} className="font-semibold text-rose-600" />
                      : <span className="text-emerald-600">Settled</span>}
                  </td>
                  <td className="td text-right">
                    <button type="button" className="text-sm font-medium text-brand-700 hover:underline"
                      onClick={() => setEditing(c)}>
                      Edit
                    </button>
                    <button type="button" className="ml-3 text-sm text-slate-400 hover:text-rose-600"
                      onClick={() => remove(c)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CustomerModal
        customer={editing}
        onClose={() => setEditing(null)}
        refresh={refresh}
        notify={notify}
      />
    </div>
  );
}

function CustomerModal({ customer, onClose, refresh, notify }) {
  const [form, setForm] = useState(customer || BLANK);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => { setForm(customer || BLANK); setError(''); }, [customer]);

  if (!customer) return null;
  const isNew = !customer.id;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    setBusy(true); setError('');
    try {
      if (isNew) await api.createCustomer(form);
      else await api.updateCustomer(customer.id, form);
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
      open wide title={isNew ? 'New customer' : 'Edit customer'} onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={busy || !form.name.trim()}>
            {busy ? 'Saving…' : 'Save customer'}
          </button>
        </>
      }
    >
      <ErrorBanner message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Name *">
            <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })}
              placeholder="Customer or business name" />
          </Field>
        </div>
        <Field label="Type">
          <select className="input" value={form.type} onChange={(e) => set({ type: e.target.value })}>
            {['Retail', 'Dealer', 'Corporate', 'AMC'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Phone">
          <input className="input" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <input className="input" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="GSTIN" hint="Leave blank for unregistered walk-in customers">
          <input className="input uppercase" value={form.gstin}
            onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Address">
            <input className="input" value={form.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
        </div>
        <Field label="City">
          <input className="input" value={form.city} onChange={(e) => set({ city: e.target.value })} />
        </Field>
        <Field label="Pincode">
          <input className="input" value={form.pincode} onChange={(e) => set({ pincode: e.target.value })} />
        </Field>
        <Field label="State">
          <input className="input" value={form.state} onChange={(e) => set({ state: e.target.value })} />
        </Field>
        <Field label="State code" hint="34 = Puducherry (local). Anything else charges IGST.">
          <input className="input" value={form.stateCode}
            onChange={(e) => set({ stateCode: e.target.value })} />
        </Field>
        <Field label="Credit days">
          <input type="number" min="0" className="input" value={form.creditDays}
            onChange={(e) => set({ creditDays: Number(e.target.value) })} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <input className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
