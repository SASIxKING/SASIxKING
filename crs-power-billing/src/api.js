/**
 * Data access for the UI.
 *
 * The very same React screens run in three places, so this module picks a
 * backend at startup:
 *
 *   Web              → HTTP calls to the Express API (relative /api URLs, so it
 *                      works on localhost, a LAN IP or a hosted domain)
 *   Android / Windows→ the shared business core running in-process against
 *                      device storage, with no server and no network
 *
 * Both paths execute identical validation because they share
 * src/core/service.js. The UI cannot tell the difference.
 */

import { createService } from './core/service.js';
import { createLocalStorageAdapter } from './core/storage.js';
import { freshDatabase } from './core/database.js';
import { money } from './lib/gst.js';

/**
 * Packaged builds are marked at build time (VITE_APP_TARGET) and, as a
 * belt-and-braces check, by the Capacitor/Electron globals that only exist
 * inside those shells.
 */
export const APP_TARGET =
  import.meta.env?.VITE_APP_TARGET
  || (globalThis.Capacitor ? 'android' : null)
  || (globalThis.electronAPI ? 'windows' : null)
  || 'web';

export const IS_EMBEDDED = APP_TARGET === 'android' || APP_TARGET === 'windows';

/* ------------------------------------------------------------- HTTP mode -- */

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Server returned ${res.status}`);
  }
  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  return payload.data;
}

const httpApi = {
  mode: 'http',
  health: () => request('/health'),
  business: () => request('/business'),
  saveBusiness: (body) => request('/business', { method: 'PUT', body }),

  customers: (q = '') => request(`/customers?q=${encodeURIComponent(q)}`),
  createCustomer: (body) => request('/customers', { method: 'POST', body }),
  updateCustomer: (id, body) => request(`/customers/${id}`, { method: 'PUT', body }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  products: (q = '', category = 'All') =>
    request(`/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`),
  createProduct: (body) => request('/products', { method: 'POST', body }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  addStock: (id, body) => request(`/products/${id}/stock`, { method: 'POST', body }),
  stockMoves: () => request('/stock-moves'),

  invoices: (q = '', status = 'All') =>
    request(`/invoices?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}`),
  invoice: (id) => request(`/invoices/${id}`),
  nextInvoiceNo: () => request('/next-invoice-no'),
  createInvoice: (body) => request('/invoices', { method: 'POST', body }),
  deleteInvoice: (id) => request(`/invoices/${id}`, { method: 'DELETE' }),
  addPayment: (id, body) => request(`/invoices/${id}/payments`, { method: 'POST', body }),

  gateways: () => request('/gateways'),
  createOrder: (invoiceId, gateway, amount) =>
    request(`/invoices/${invoiceId}/pay/${gateway}`, { method: 'POST', body: { amount } }),
  confirmPayment: (invoiceId, gateway, body) =>
    request(`/invoices/${invoiceId}/pay/${gateway}/confirm`, { method: 'POST', body }),

  dashboard: () => request('/dashboard'),
  exportAll: () => request('/export'),
  importAll: (body) => request('/import', { method: 'POST', body }),
  reset: () => request('/reset', { method: 'POST' }),
};

/* --------------------------------------------------------- embedded mode -- */

function createEmbeddedApi() {
  const store = createLocalStorageAdapter();
  const service = createService(store);

  // Promise-wrapped so callers use the identical async interface.
  const call = async (fn) => fn();

  return {
    mode: 'embedded',
    health: () => call(() => ({ status: 'up', offline: true, time: new Date().toISOString() })),
    business: () => call(() => service.getBusiness()),
    saveBusiness: (body) => call(() => service.saveBusiness(body)),

    customers: (q = '') => call(() => service.listCustomers({ q })),
    createCustomer: (body) => call(() => service.createCustomer(body)),
    updateCustomer: (id, body) => call(() => service.updateCustomer(id, body)),
    deleteCustomer: (id) => call(() => service.deleteCustomer(id)),

    products: (q = '', category = 'All') => call(() => service.listProducts({ q, category })),
    createProduct: (body) => call(() => service.createProduct(body)),
    updateProduct: (id, body) => call(() => service.updateProduct(id, body)),
    deleteProduct: (id) => call(() => service.deleteProduct(id)),
    addStock: (id, body) => call(() => service.adjustStock(id, body)),
    stockMoves: () => call(() => service.listStockMoves()),

    invoices: (q = '', status = 'All') => call(() => service.listInvoices({ q, status })),
    invoice: (id) => call(() => service.getInvoice(id)),
    nextInvoiceNo: () => call(() => service.peekNextInvoiceNo()),
    createInvoice: (body) => call(() => service.createInvoice(body)),
    deleteInvoice: (id) => call(() => service.deleteInvoice(id)),
    addPayment: (id, body) => call(() => service.addPayment(id, body)),

    /**
     * Offline payment handling.
     *
     * A packaged app has no server secret, so it must never pretend to verify
     * a gateway signature — doing that in client code would be security
     * theatre. Instead the app records the payment as a manual receipt and
     * says so plainly. Online collection requires the hosted API.
     */
    gateways: () => call(() => ([
      { id: 'manual', label: 'Cash / UPI / Card', live: true, keyId: '', mode: 'offline' },
    ])),
    createOrder: () => {
      throw new Error(
        'Online payment links need the hosted server. Record the payment manually instead.',
      );
    },
    confirmPayment: () => {
      throw new Error('Online payment confirmation is only available on the hosted version.');
    },

    dashboard: () => call(() => service.dashboard()),
    exportAll: () => call(() => service.exportAll()),
    importAll: (body) => call(() => service.importAll(body)),
    reset: () => call(() => {
      store.reset();
      const db = service.dashboard();
      return {
        reset: true,
        customers: db.customers.length,
        products: db.products.length,
        invoices: db.invoices.length,
      };
    }),
  };
}

export const api = IS_EMBEDDED ? createEmbeddedApi() : httpApi;

/** Helper used by the Backup screen on packaged builds. */
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { money, freshDatabase };
