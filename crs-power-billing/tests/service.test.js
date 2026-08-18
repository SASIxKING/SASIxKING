import test from 'node:test';
import assert from 'node:assert/strict';

import { createService, ValidationError } from '../src/core/service.js';
import { createMemoryAdapter } from '../src/core/storage.js';
import { freshDatabase } from '../src/core/database.js';

/**
 * These tests exercise the shared core directly — the same code path the
 * Android and Windows builds use offline. The web API is a thin wrapper over
 * it, so proving the rules here proves them for all three platforms.
 */

function setup() {
  const store = createMemoryAdapter(freshDatabase({ withDemoData: false }));
  return { store, service: createService(store) };
}

const firstBattery = (service) => service.listProducts({ category: 'Battery' })[0];
const firstCustomer = (service) => service.listCustomers()[0];

test('seeded catalogue uses only the 18% and 28% slabs', () => {
  const { service } = setup();
  const rates = new Set(service.listProducts().map((p) => p.gstRate));
  assert.deepEqual([...rates].sort((a, b) => a - b), [18, 28]);
});

test('batteries are 28% and inverters are 18%', () => {
  const { service } = setup();
  const products = service.listProducts();
  for (const p of products) {
    if (p.category === 'Battery') assert.equal(p.gstRate, 28, `${p.name} should be 28%`);
    if (p.category === 'Inverter') assert.equal(p.gstRate, 18, `${p.name} should be 18%`);
  }
});

test('a client-supplied GST rate is ignored in favour of the product master', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  const invoice = service.createInvoice({
    customerId: customer.id,
    // hostile payload: pretend the battery is zero-rated
    items: [{ productId: battery.id, qty: 1, gstRate: 0, hsn: '0000' }],
  });

  assert.equal(invoice.items[0].gstRate, 28);
  assert.equal(invoice.items[0].hsn, battery.hsn);
  assert.ok(invoice.totalTax > 0, 'tax must still be charged');
});

test('stock cannot be oversold', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  assert.throws(
    () => service.createInvoice({
      customerId: customer.id,
      items: [{ productId: battery.id, qty: battery.stockQty + 1 }],
    }),
    (err) => err instanceof ValidationError && /Insufficient stock/.test(err.message),
  );
});

test('a failed stock check leaves every product untouched', () => {
  const { service } = setup();
  const products = service.listProducts();
  const good = products.find((p) => p.category === 'Battery' && p.stockQty > 2);
  const bad = products.find((p) => p.category === 'Inverter');
  const customer = firstCustomer(service);
  const before = good.stockQty;

  assert.throws(() => service.createInvoice({
    customerId: customer.id,
    items: [
      { productId: good.id, qty: 1 },              // fine
      { productId: bad.id, qty: bad.stockQty + 99 }, // fails
    ],
  }));

  // the valid line must NOT have been deducted
  const after = service.listProducts().find((p) => p.id === good.id).stockQty;
  assert.equal(after, before, 'stock was deducted despite the invoice failing');
});

test('saving an invoice deducts stock and logs the movement', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);
  const before = battery.stockQty;

  const invoice = service.createInvoice({
    customerId: customer.id,
    items: [{ productId: battery.id, qty: 2 }],
  });

  const after = service.listProducts().find((p) => p.id === battery.id).stockQty;
  assert.equal(after, before - 2);

  const move = service.listStockMoves()[0];
  assert.equal(move.type, 'OUT');
  assert.equal(move.qty, -2);
  assert.match(move.reason, new RegExp(invoice.invoiceNo));
});

test('deleting an invoice restores the stock it consumed', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);
  const before = battery.stockQty;

  const invoice = service.createInvoice({
    customerId: customer.id,
    items: [{ productId: battery.id, qty: 3 }],
  });
  service.deleteInvoice(invoice.id);

  const after = service.listProducts().find((p) => p.id === battery.id).stockQty;
  assert.equal(after, before, 'stock should return to its original level');
});

test('services do not consume stock', () => {
  const { service } = setup();
  const svc = service.listProducts({ category: 'Service' })[0];
  const customer = firstCustomer(service);

  service.createInvoice({ customerId: customer.id, items: [{ productId: svc.id, qty: 5 }] });

  const after = service.listProducts().find((p) => p.id === svc.id).stockQty;
  assert.equal(after, svc.stockQty);
});

test('payments cannot exceed the outstanding balance', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  const invoice = service.createInvoice({
    customerId: customer.id,
    items: [{ productId: battery.id, qty: 1 }],
  });

  assert.throws(
    () => service.addPayment(invoice.id, { amount: invoice.grandTotal + 1 }),
    (err) => /exceeds the outstanding balance/.test(err.message),
  );
});

test('part payments move the invoice to PARTIAL then PAID', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  const invoice = service.createInvoice({
    customerId: customer.id,
    items: [{ productId: battery.id, qty: 1 }],
  });
  assert.equal(invoice.status, 'UNPAID');

  const half = Math.floor(invoice.grandTotal / 2);
  const partial = service.addPayment(invoice.id, { amount: half });
  assert.equal(partial.status, 'PARTIAL');

  const settled = service.addPayment(invoice.id, { amount: invoice.grandTotal - half });
  assert.equal(settled.status, 'PAID');
  assert.equal(settled.paidAmount, invoice.grandTotal);
});

test('a local customer gets CGST+SGST and an outside customer gets IGST', () => {
  const { service } = setup();
  const battery = firstBattery(service);

  const local = service.createCustomer({ name: 'Local Shop', stateCode: '34', state: 'Puducherry' });
  const outside = service.createCustomer({ name: 'TN Dealer', stateCode: '33', state: 'Tamil Nadu' });

  const a = service.createInvoice({ customerId: local.id, items: [{ productId: battery.id, qty: 1 }] });
  const b = service.createInvoice({ customerId: outside.id, items: [{ productId: battery.id, qty: 1 }] });

  assert.equal(a.igst, 0);
  assert.ok(a.cgst > 0 && a.cgst === a.sgst);

  assert.equal(b.cgst, 0);
  assert.equal(b.sgst, 0);
  assert.ok(b.igst > 0);

  // same goods, same total tax, only the split differs
  assert.equal(a.totalTax, b.totalTax);
});

test('invoice numbers increment across saves', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  const a = service.createInvoice({ customerId: customer.id, items: [{ productId: battery.id, qty: 1 }] });
  const b = service.createInvoice({ customerId: customer.id, items: [{ productId: battery.id, qty: 1 }] });

  const seq = (no) => Number(no.split('/').pop());
  assert.equal(seq(b.invoiceNo), seq(a.invoiceNo) + 1);
});

test('a customer with invoices cannot be deleted', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  service.createInvoice({ customerId: customer.id, items: [{ productId: battery.id, qty: 1 }] });

  assert.throws(
    () => service.deleteCustomer(customer.id),
    (err) => err.status === 409,
  );
});

test('invalid GST rates are rejected when creating a product', () => {
  const { service } = setup();
  assert.throws(() => service.createProduct({ name: 'Weird item', gstRate: 5 }));
  assert.throws(() => service.createProduct({ name: 'Weird item', gstRate: 12 }));
  assert.doesNotThrow(() => service.createProduct({ name: 'Valid item', gstRate: 18 }));
});

test('discounts outside 0-100% are rejected', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  assert.throws(() => service.createInvoice({
    customerId: customer.id,
    items: [{ productId: battery.id, qty: 1, discountPct: 150 }],
  }));
  assert.throws(() => service.createInvoice({
    customerId: customer.id,
    items: [{ productId: battery.id, qty: 1, discountPct: -10 }],
  }));
});

test('zero or negative quantities are rejected', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);

  for (const qty of [0, -1, 'abc', null]) {
    assert.throws(
      () => service.createInvoice({ customerId: customer.id, items: [{ productId: battery.id, qty }] }),
      `qty ${qty} should be rejected`,
    );
  }
});

test('export then import round-trips the whole database', () => {
  const { service } = setup();
  const battery = firstBattery(service);
  const customer = firstCustomer(service);
  service.createInvoice({ customerId: customer.id, items: [{ productId: battery.id, qty: 1 }] });

  const snapshot = service.exportAll();
  assert.equal(snapshot.invoices.length, 1);

  // wipe and restore
  const { service: other } = setup();
  assert.equal(other.dashboard().invoices.length, 0);
  const result = other.importAll(snapshot);
  assert.equal(result.invoices, 1);
  assert.equal(other.dashboard().invoices.length, 1);
  assert.equal(other.dashboard().invoices[0].invoiceNo, snapshot.invoices[0].invoiceNo);
});

test('importing a junk file is refused', () => {
  const { service } = setup();
  assert.throws(() => service.importAll({ nonsense: true }));
  assert.throws(() => service.importAll(null));
});
