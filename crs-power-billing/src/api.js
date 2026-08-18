/**
 * Thin API client. Always uses relative URLs so the browser talks to whatever
 * host is serving the app (localhost, a LAN IP, or the sandbox preview domain)
 * and Vite proxies it to the API server.
 */

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

export const api = {
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
};
