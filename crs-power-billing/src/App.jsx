import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import { api } from './api.js';
import { Spinner, ErrorBanner, Toast } from './components/ui.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceDetail from './pages/InvoiceDetail.jsx';
import NewInvoice from './pages/NewInvoice.jsx';
import Customers from './pages/Customers.jsx';
import Inventory from './pages/Inventory.jsx';
import Reports from './pages/Reports.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/invoices', label: 'Invoices' },
  { to: '/customers', label: 'Customers' },
  { to: '/inventory', label: 'Inventory' },
  { to: '/reports', label: 'GST Reports' },
];

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const load = useCallback(async () => {
    try {
      const payload = await api.dashboard();
      setData(payload);
      setError('');
    } catch (err) {
      setError(`Could not reach the API server. ${err.message}`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  if (!data && error) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <ErrorBanner message={error} onRetry={load} />
        <p className="text-sm text-slate-500">
          Start the API with <code className="rounded bg-slate-200 px-1.5 py-0.5">npm run dev</code>.
        </p>
      </div>
    );
  }

  if (!data) return <Spinner label="Loading C.R.S Power Solution…" />;

  const business = data.business;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              CRS
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight text-ink">
                {business.name}
              </span>
              <span className="block truncate text-xs leading-tight text-slate-500">
                {business.city} · GSTIN {business.gstin}
              </span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/invoices/new" className="btn-primary hidden sm:inline-flex">+ New invoice</Link>
            <button
              type="button"
              className="btn-ghost lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              ☰
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Link to="/invoices/new" className="btn-primary mt-2 w-full sm:hidden">+ New invoice</Link>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <ErrorBanner message={error} onRetry={load} />
        <Routes>
          <Route path="/" element={<Dashboard data={data} />} />
          <Route path="/invoices" element={<Invoices data={data} />} />
          <Route path="/invoices/new" element={<NewInvoice data={data} refresh={load} notify={notify} />} />
          <Route path="/invoices/:id" element={<InvoiceDetail data={data} refresh={load} notify={notify} />} />
          <Route path="/customers" element={<Customers data={data} refresh={load} notify={notify} />} />
          <Route path="/inventory" element={<Inventory data={data} refresh={load} notify={notify} />} />
          <Route path="/reports" element={<Reports data={data} />} />
          <Route path="*" element={<Dashboard data={data} />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-400 print:hidden">
        {business.name} · {business.addressLine}, {business.city} – {business.pincode} · {business.phone}
      </footer>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
