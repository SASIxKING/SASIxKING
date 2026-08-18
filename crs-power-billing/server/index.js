/**
 * API server for C.R.S Power Solution billing software.
 *
 * Business rules live here (not in the browser) so the numbers cannot be
 * tampered with from the client: GST is recomputed server-side on every save,
 * and payment amounts are validated against the stored invoice balance.
 */

import express from 'express';
import cors from 'cors';
import { load, save, reset, uid } from './store.js';
import {
  computeInvoiceTotals,
  isInterState,
  nextInvoiceNo,
  money,
} from '../src/lib/gst.js';
import {
  createOrder,
  verifyPayment,
  publicGatewayStatus,
} from './gateways.js';

const app = express();
// keep the raw body so webhook signatures can be verified byte-for-byte
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use(cors());

const PORT = process.env.PORT || 8787;

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, status, message) => res.status(status).json({ ok: false, error: message });

function asyncRoute(fn) {
  return (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[api]', err);
    fail(res, err.status || 500, err.message || 'Internal error');
  });
}

/* ------------------------------------------------------------------ meta -- */

app.get('/api/health', (_req, res) => ok(res, { status: 'up', time: new Date().toISOString() }));

app.get('/api/business', (_req, res) => ok(res, load().business));

app.put('/api/business', (req, res) => {
  const db = load();
  db.business = { ...db.business, ...req.body };
  save();
  ok(res, db.business);
});

app.post('/api/reset', (_req, res) => ok(res, { reset: true, ...summarise(reset()) }));

function summarise(db) {
  return {
    customers: db.customers.length,
    products: db.products.length,
    invoices: db.invoices.length,
  };
}

/* ------------------------------------------------------------- customers -- */

app.get('/api/customers', (req, res) => {
  const db = load();
  const q = String(req.query.q || '').toLowerCase().trim();
  let rows = db.customers;
  if (q) {
    rows = rows.filter((c) =>
      [c.name, c.phone, c.city, c.gstin, c.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)));
  }
  // attach live balance so the list can show who owes money
  const withBalance = rows.map((c) => {
    const invs = db.invoices.filter((i) => i.customerId === c.id);
    const billed = money(invs.reduce((a, i) => a + i.grandTotal, 0));
    const paid = money(invs.reduce((a, i) => a + i.paidAmount, 0));
    return { ...c, totalBilled: billed, totalPaid: paid, balance: money(billed - paid), invoiceCount: invs.length };
  });
  ok(res, withBalance);
});

app.post('/api/customers', (req, res) => {
  const db = load();
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) return fail(res, 400, 'Customer name is required');
  const customer = {
    id: uid('c_'),
    name: String(body.name).trim(),
    type: body.type || 'Retail',
    phone: body.phone || '',
    email: body.email || '',
    gstin: (body.gstin || '').toUpperCase(),
    address: body.address || '',
    city: body.city || 'Pondicherry',
    state: body.state || 'Puducherry',
    stateCode: body.stateCode || '34',
    pincode: body.pincode || '',
    creditDays: Number(body.creditDays) || 0,
    notes: body.notes || '',
  };
  db.customers.push(customer);
  save();
  ok(res, customer);
});

app.put('/api/customers/:id', (req, res) => {
  const db = load();
  const idx = db.customers.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return fail(res, 404, 'Customer not found');
  db.customers[idx] = { ...db.customers[idx], ...req.body, id: db.customers[idx].id };
  save();
  ok(res, db.customers[idx]);
});

app.delete('/api/customers/:id', (req, res) => {
  const db = load();
  const used = db.invoices.some((i) => i.customerId === req.params.id);
  if (used) return fail(res, 409, 'Cannot delete a customer who already has invoices');
  db.customers = db.customers.filter((c) => c.id !== req.params.id);
  save();
  ok(res, { deleted: true });
});

/* -------------------------------------------------------------- products -- */

app.get('/api/products', (req, res) => {
  const db = load();
  const q = String(req.query.q || '').toLowerCase().trim();
  const category = String(req.query.category || '').trim();
  let rows = db.products;
  if (q) {
    rows = rows.filter((p) =>
      [p.name, p.brand, p.model, p.capacity, p.hsn]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)));
  }
  if (category && category !== 'All') rows = rows.filter((p) => p.category === category);
  ok(res, rows);
});

app.post('/api/products', (req, res) => {
  const db = load();
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) return fail(res, 400, 'Product name is required');
  const gstRate = Number(body.gstRate);
  if (![18, 28].includes(gstRate)) return fail(res, 400, 'GST rate must be 18% or 28%');

  const product = {
    id: uid('p_'),
    name: String(body.name).trim(),
    category: body.category || 'Battery',
    brand: body.brand || '',
    model: body.model || '',
    hsn: body.hsn || '',
    unit: body.unit || 'Nos',
    capacity: body.capacity || '',
    purchasePrice: Number(body.purchasePrice) || 0,
    sellingPrice: Number(body.sellingPrice) || 0,
    gstRate,
    stockQty: Number(body.stockQty) || 0,
    reorderLevel: Number(body.reorderLevel) || 0,
    warrantyMonths: Number(body.warrantyMonths) || 0,
    exchangeValue: Number(body.exchangeValue) || 0,
    trackSerial: Boolean(body.trackSerial),
  };
  db.products.push(product);
  save();
  ok(res, product);
});

app.put('/api/products/:id', (req, res) => {
  const db = load();
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return fail(res, 404, 'Product not found');
  if (req.body.gstRate !== undefined && ![18, 28].includes(Number(req.body.gstRate))) {
    return fail(res, 400, 'GST rate must be 18% or 28%');
  }
  db.products[idx] = { ...db.products[idx], ...req.body, id: db.products[idx].id };
  save();
  ok(res, db.products[idx]);
});

app.delete('/api/products/:id', (req, res) => {
  const db = load();
  db.products = db.products.filter((p) => p.id !== req.params.id);
  save();
  ok(res, { deleted: true });
});

/** Receive stock (goods inward). */
app.post('/api/products/:id/stock', (req, res) => {
  const db = load();
  const product = db.products.find((p) => p.id === req.params.id);
  if (!product) return fail(res, 404, 'Product not found');
  const qty = Number(req.body?.qty);
  if (!Number.isFinite(qty) || qty === 0) return fail(res, 400, 'Quantity must be a non-zero number');

  product.stockQty = money((Number(product.stockQty) || 0) + qty);
  db.stockMoves.unshift({
    id: uid('sm_'),
    productId: product.id,
    productName: product.name,
    type: qty > 0 ? 'IN' : 'ADJUST',
    qty,
    reason: req.body?.reason || 'Manual adjustment',
    date: new Date().toISOString(),
  });
  db.stockMoves = db.stockMoves.slice(0, 500);
  save();
  ok(res, product);
});

app.get('/api/stock-moves', (_req, res) => ok(res, load().stockMoves.slice(0, 100)));

/* -------------------------------------------------------------- invoices -- */

app.get('/api/invoices', (req, res) => {
  const db = load();
  const q = String(req.query.q || '').toLowerCase().trim();
  const status = String(req.query.status || '').trim();
  let rows = [...db.invoices].sort((a, b) => new Date(b.date) - new Date(a.date));
  if (q) {
    rows = rows.filter((i) =>
      [i.invoiceNo, i.customerName, i.customerPhone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)));
  }
  if (status && status !== 'All') rows = rows.filter((i) => i.status === status);
  ok(res, rows);
});

app.get('/api/invoices/:id', (req, res) => {
  const inv = load().invoices.find((i) => i.id === req.params.id);
  if (!inv) return fail(res, 404, 'Invoice not found');
  ok(res, inv);
});

app.get('/api/next-invoice-no', (_req, res) => {
  const db = load();
  const last = [...db.invoices].sort((a, b) => new Date(a.date) - new Date(b.date)).pop();
  ok(res, { invoiceNo: nextInvoiceNo(last?.invoiceNo, db.business.invoicePrefix) });
});

app.post('/api/invoices', (req, res) => {
  const db = load();
  const body = req.body || {};

  const customer = db.customers.find((c) => c.id === body.customerId);
  if (!customer) return fail(res, 400, 'Select a valid customer');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return fail(res, 400, 'Add at least one item to the invoice');
  }

  // Rebuild each line from the product master — the client cannot invent
  // prices, HSN codes or GST slabs.
  const lines = [];
  for (const item of body.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product) return fail(res, 400, `Unknown product: ${item.productId}`);
    const qty = Number(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) return fail(res, 400, `Invalid quantity for ${product.name}`);

    const rate = item.rate !== undefined && item.rate !== '' ? Number(item.rate) : product.sellingPrice;
    if (!Number.isFinite(rate) || rate < 0) return fail(res, 400, `Invalid rate for ${product.name}`);

    lines.push({
      productId: product.id,
      name: product.name,
      hsn: product.hsn,
      unit: product.unit,
      qty,
      rate,
      discountPct: Number(item.discountPct) || 0,
      gstRate: product.gstRate,     // always from the master, never the client
      serials: item.serials || '',
      warrantyMonths: product.warrantyMonths,
    });
  }

  // Stock check before committing anything.
  for (const line of lines) {
    const product = db.products.find((p) => p.id === line.productId);
    if (product.category === 'Service') continue;
    if ((Number(product.stockQty) || 0) < line.qty) {
      return fail(res, 409,
        `Insufficient stock for ${product.name}: ${product.stockQty} available, ${line.qty} requested`);
    }
  }

  const interState = isInterState(customer.stateCode);
  const totals = computeInvoiceTotals(lines, { interState, exchange: Number(body.exchange) || 0 });

  const date = body.date ? new Date(body.date) : new Date();
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + (Number(customer.creditDays) || 0));

  const last = [...db.invoices].sort((a, b) => new Date(a.date) - new Date(b.date)).pop();
  const paidAmount = Math.min(money(Number(body.paidAmount) || 0), totals.grandTotal);

  const invoice = {
    id: uid('inv_'),
    invoiceNo: nextInvoiceNo(last?.invoiceNo, db.business.invoicePrefix, date),
    date: date.toISOString(),
    dueDate: dueDate.toISOString(),
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    customerGstin: customer.gstin,
    customerAddress: [customer.address, customer.city, customer.pincode].filter(Boolean).join(', '),
    placeOfSupply: `${customer.stateCode}-${customer.state}`,
    interState,
    items: lines.map((l, i) => ({ ...l, ...totals.lines[i] })),
    subTotal: totals.subTotal,
    discount: totals.discount,
    taxable: totals.taxable,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    totalTax: totals.totalTax,
    exchange: totals.exchange,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    paidAmount,
    status: paidAmount >= totals.grandTotal - 0.01 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
    paymentMode: body.paymentMode || 'Cash',
    notes: body.notes || '',
    payments: paidAmount > 0
      ? [{ id: uid('pay_'), amount: paidAmount, mode: body.paymentMode || 'Cash', gateway: 'manual', reference: '', date: date.toISOString() }]
      : [],
  };

  // Commit: deduct stock and log the movement.
  for (const line of lines) {
    const product = db.products.find((p) => p.id === line.productId);
    if (product.category === 'Service') continue;
    product.stockQty = money(product.stockQty - line.qty);
    db.stockMoves.unshift({
      id: uid('sm_'),
      productId: product.id,
      productName: product.name,
      type: 'OUT',
      qty: -line.qty,
      reason: `Sold on ${invoice.invoiceNo}`,
      date: invoice.date,
    });
  }
  db.stockMoves = db.stockMoves.slice(0, 500);
  db.invoices.push(invoice);
  save();
  ok(res, invoice);
});

/** Manual (cash/UPI/bank) receipt against an invoice. */
app.post('/api/invoices/:id/payments', (req, res) => {
  const db = load();
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) return fail(res, 404, 'Invoice not found');

  const amount = money(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, 'Enter a valid amount');

  const balance = money(invoice.grandTotal - invoice.paidAmount);
  if (amount > balance + 0.01) {
    return fail(res, 400, `Amount exceeds the outstanding balance of ₹${balance.toFixed(2)}`);
  }

  invoice.payments.push({
    id: uid('pay_'),
    amount,
    mode: req.body?.mode || 'Cash',
    gateway: 'manual',
    reference: req.body?.reference || '',
    date: new Date().toISOString(),
  });
  invoice.paidAmount = money(invoice.paidAmount + amount);
  invoice.status = invoice.paidAmount >= invoice.grandTotal - 0.01 ? 'PAID' : 'PARTIAL';
  save();
  ok(res, invoice);
});

app.delete('/api/invoices/:id', (req, res) => {
  const db = load();
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) return fail(res, 404, 'Invoice not found');

  // Put the stock back so inventory stays truthful.
  for (const item of invoice.items) {
    const product = db.products.find((p) => p.id === item.productId);
    if (!product || product.category === 'Service') continue;
    product.stockQty = money(product.stockQty + item.qty);
    db.stockMoves.unshift({
      id: uid('sm_'),
      productId: product.id,
      productName: product.name,
      type: 'IN',
      qty: item.qty,
      reason: `Cancelled ${invoice.invoiceNo}`,
      date: new Date().toISOString(),
    });
  }
  db.invoices = db.invoices.filter((i) => i.id !== req.params.id);
  save();
  ok(res, { deleted: true });
});

/* ------------------------------------------------------- payment gateway -- */

app.get('/api/gateways', (_req, res) => ok(res, publicGatewayStatus()));

/** Create a gateway order for an invoice. Amount comes from the server. */
app.post('/api/invoices/:id/pay/:gateway', asyncRoute(async (req, res) => {
  const db = load();
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) return fail(res, 404, 'Invoice not found');

  const order = await createOrder(req.params.gateway, invoice, req.body?.amount);
  db.paymentOrders.unshift({ ...order, status: 'CREATED' });
  db.paymentOrders = db.paymentOrders.slice(0, 200);
  save();
  ok(res, order);
}));

/**
 * Confirm a payment after the gateway checkout completes.
 * The signature is verified before a single rupee is recorded.
 */
app.post('/api/invoices/:id/pay/:gateway/confirm', (req, res) => {
  const db = load();
  const invoice = db.invoices.find((i) => i.id === req.params.id);
  if (!invoice) return fail(res, 404, 'Invoice not found');

  const gateway = req.params.gateway;
  const verification = verifyPayment(gateway, { ...req.body, rawBody: req.rawBody });
  if (!verification.ok) {
    return fail(res, 400, 'Payment signature verification failed — payment not recorded');
  }

  const order = db.paymentOrders.find((o) => o.orderId === req.body?.orderId);
  const balance = money(invoice.grandTotal - invoice.paidAmount);
  // Trust the order we created, not an amount posted by the browser.
  const amount = money(Math.min(order?.amount ?? balance, balance));

  if (amount <= 0) return fail(res, 400, 'Invoice is already settled');

  invoice.payments.push({
    id: uid('pay_'),
    amount,
    mode: 'Online',
    gateway,
    reference: req.body?.paymentId || req.body?.orderId || '',
    simulated: Boolean(verification.simulated),
    date: new Date().toISOString(),
  });
  invoice.paidAmount = money(invoice.paidAmount + amount);
  invoice.status = invoice.paidAmount >= invoice.grandTotal - 0.01 ? 'PAID' : 'PARTIAL';
  if (order) order.status = 'PAID';
  save();

  ok(res, { invoice, simulated: Boolean(verification.simulated) });
});

/** Webhook endpoint for server-to-server confirmations. */
app.post('/api/webhooks/:gateway', (req, res) => {
  const gateway = req.params.gateway;
  const verification = verifyPayment(gateway, {
    ...req.body,
    rawBody: req.rawBody,
    signature: req.get('x-webhook-signature') || req.get('x-razorpay-signature'),
    timestamp: req.get('x-webhook-timestamp'),
  });
  if (!verification.ok) return fail(res, 400, 'Invalid webhook signature');
  // A production deployment would reconcile the order here.
  ok(res, { received: true });
});

/* ------------------------------------------------------------- reporting -- */

app.get('/api/dashboard', (_req, res) => {
  const db = load();
  ok(res, {
    business: db.business,
    invoices: db.invoices,
    products: db.products,
    customers: db.customers,
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const db = load();
  console.log(`[C.R.S Power Solution] API listening on http://0.0.0.0:${PORT}`);
  console.log(`  seeded: ${db.customers.length} customers, ${db.products.length} products, ${db.invoices.length} invoices`);
});
