/**
 * Express API for the web deployment of C.R.S Power Solution billing.
 *
 * This file is a thin HTTP transport. Every business rule lives in
 * src/core/service.js, which the Android and Windows builds call directly.
 * One implementation, so an offline invoice is validated exactly as strictly
 * as one created through this API.
 */

import express from 'express';
import cors from 'cors';
import { createFileAdapter } from './store.js';
import { createService } from '../src/core/service.js';
import { createOrder, verifyPayment, publicGatewayStatus } from './gateways.js';
import { money } from '../src/lib/gst.js';

const store = createFileAdapter();
const service = createService(store);

const app = express();
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use(cors());

const PORT = process.env.PORT || 8787;

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, status, message) => res.status(status).json({ ok: false, error: message });

/** Turns a thrown ValidationError into the right HTTP status. */
function route(handler) {
  return async (req, res) => {
    try {
      const data = await handler(req, res);
      if (data !== undefined) ok(res, data);
    } catch (err) {
      if (!err.status) console.error('[api]', err);
      fail(res, err.status || 500, err.message || 'Internal error');
    }
  };
}

/* ------------------------------------------------------------------ meta -- */

app.get('/api/health', route(async () => ({ status: 'up', time: new Date().toISOString() })));
app.get('/api/business', route(async () => service.getBusiness()));
app.put('/api/business', route(async (req) => service.saveBusiness(req.body)));

app.post('/api/reset', route(async () => {
  store.reset();
  const db = service.dashboard();
  return {
    reset: true,
    customers: db.customers.length,
    products: db.products.length,
    invoices: db.invoices.length,
  };
}));

app.get('/api/export', route(async () => service.exportAll()));
app.post('/api/import', route(async (req) => service.importAll(req.body)));

/* ------------------------------------------------------------- resources -- */

app.get('/api/customers', route(async (req) => service.listCustomers({ q: req.query.q })));
app.post('/api/customers', route(async (req) => service.createCustomer(req.body)));
app.put('/api/customers/:id', route(async (req) => service.updateCustomer(req.params.id, req.body)));
app.delete('/api/customers/:id', route(async (req) => service.deleteCustomer(req.params.id)));

app.get('/api/products', route(async (req) =>
  service.listProducts({ q: req.query.q, category: req.query.category })));
app.post('/api/products', route(async (req) => service.createProduct(req.body)));
app.put('/api/products/:id', route(async (req) => service.updateProduct(req.params.id, req.body)));
app.delete('/api/products/:id', route(async (req) => service.deleteProduct(req.params.id)));
app.post('/api/products/:id/stock', route(async (req) => service.adjustStock(req.params.id, req.body)));
app.get('/api/stock-moves', route(async () => service.listStockMoves()));

app.get('/api/invoices', route(async (req) =>
  service.listInvoices({ q: req.query.q, status: req.query.status })));
app.get('/api/invoices/:id', route(async (req) => service.getInvoice(req.params.id)));
app.get('/api/next-invoice-no', route(async () => service.peekNextInvoiceNo()));
app.post('/api/invoices', route(async (req) => service.createInvoice(req.body)));
app.delete('/api/invoices/:id', route(async (req) => service.deleteInvoice(req.params.id)));
app.post('/api/invoices/:id/payments', route(async (req) =>
  service.addPayment(req.params.id, req.body)));

app.get('/api/dashboard', route(async () => service.dashboard()));

/* ------------------------------------------------------- payment gateway -- */

app.get('/api/gateways', route(async () => publicGatewayStatus()));

app.post('/api/invoices/:id/pay/:gateway', route(async (req) => {
  const invoice = service.getInvoice(req.params.id);
  const order = await createOrder(req.params.gateway, invoice, req.body?.amount);

  const db = store.read();
  db.paymentOrders.unshift({ ...order, status: 'CREATED' });
  db.paymentOrders = db.paymentOrders.slice(0, 200);
  store.write(db);

  return order;
}));

app.post('/api/invoices/:id/pay/:gateway/confirm', route(async (req, res) => {
  const invoice = service.getInvoice(req.params.id);
  const gateway = req.params.gateway;

  const verification = verifyPayment(gateway, { ...req.body, rawBody: req.rawBody });
  if (!verification.ok) {
    fail(res, 400, 'Payment signature verification failed — payment not recorded');
    return undefined;
  }

  const db = store.read();
  const order = db.paymentOrders.find((o) => o.orderId === req.body?.orderId);
  const balance = money(invoice.grandTotal - invoice.paidAmount);
  // Trust the order we created, never an amount posted by the browser.
  const amount = money(Math.min(order?.amount ?? balance, balance));

  const updated = service.addPayment(invoice.id, {
    amount,
    mode: 'Online',
    gateway,
    reference: req.body?.paymentId || req.body?.orderId || '',
    simulated: Boolean(verification.simulated),
  });

  if (order) {
    const db2 = store.read();
    const o = db2.paymentOrders.find((x) => x.orderId === req.body?.orderId);
    if (o) o.status = 'PAID';
    store.write(db2);
  }

  return { invoice: updated, simulated: Boolean(verification.simulated) };
}));

app.post('/api/webhooks/:gateway', route(async (req, res) => {
  const verification = verifyPayment(req.params.gateway, {
    ...req.body,
    rawBody: req.rawBody,
    signature: req.get('x-webhook-signature') || req.get('x-razorpay-signature'),
    timestamp: req.get('x-webhook-timestamp'),
  });
  if (!verification.ok) {
    fail(res, 400, 'Invalid webhook signature');
    return undefined;
  }
  return { received: true };
}));

app.listen(PORT, '0.0.0.0', () => {
  const db = service.dashboard();
  console.log(`[C.R.S Power Solution] API listening on http://0.0.0.0:${PORT}`);
  console.log(`  seeded: ${db.customers.length} customers, ${db.products.length} products, ${db.invoices.length} invoices`);
});
