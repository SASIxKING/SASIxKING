/**
 * Database construction shared by every platform.
 *
 * The demo history lives here (not in the Node-only store) so the Android and
 * Windows builds seed themselves identically on first launch, with no server.
 */

import { business, customers, products } from './seed.js';
import { computeInvoiceTotals, isInterState, nextInvoiceNo, money } from '../lib/gst.js';
import { uid } from './service.js';

/** Six months of plausible trading history so the trend charts mean something. */
function demoInvoices() {
  const byId = new Map(products.map((p) => [p.id, p]));
  const custById = new Map(customers.map((c) => [c.id, c]));

  // [monthsAgo, customerId, [[productId, qty], ...], paidFraction]
  const plan = [
    [5, 'c1', [['p1', 4], ['p11', 4]], 1],
    [5, 'c2', [['p4', 1], ['p3', 1], ['p13', 1]], 1],
    [4, 'c1', [['p1', 3], ['p2', 1]], 1],
    [4, 'c5', [['p9', 1]], 1],
    [4, 'c3', [['p5', 2], ['p13', 1]], 1],
    [3, 'c4', [['p2', 2], ['p14', 1]], 1],
    [3, 'c2', [['p12', 2]], 1],
    [3, 'c1', [['p1', 5], ['p10', 3]], 0.6],
    [2, 'c3', [['p7', 4], ['p8', 1]], 1],
    [2, 'c5', [['p3', 1], ['p11', 1]], 1],
    [2, 'c1', [['p2', 3]], 1],
    [1, 'c4', [['p6', 1], ['p13', 1]], 1],
    [1, 'c2', [['p1', 1], ['p10', 1]], 0],
    [1, 'c1', [['p1', 4], ['p2', 2]], 1],
    [1, 'c5', [['p12', 3]], 1],
    [0, 'c3', [['p5', 1], ['p7', 2]], 1],
    [0, 'c1', [['p1', 3], ['p11', 2]], 0.5],
    [0, 'c4', [['p9', 2], ['p14', 1]], 1],
    [0, 'c5', [['p4', 1]], 1],
  ];

  const now = new Date();
  const invoices = [];
  let last = null;

  plan.forEach(([monthsAgo, customerId, items, paidFraction], i) => {
    const cust = custById.get(customerId);
    const day = 4 + ((i * 5) % 22);
    const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 11, 30);
    if (date > now) date.setTime(now.getTime() - 3600_000);

    const lines = items.map(([pid, qty]) => {
      const p = byId.get(pid);
      return {
        productId: p.id,
        name: p.name,
        hsn: p.hsn,
        unit: p.unit,
        qty,
        rate: p.sellingPrice,
        discountPct: 0,
        gstRate: p.gstRate,
        serials: '',
        warrantyMonths: p.warrantyMonths,
      };
    });

    const interState = isInterState(cust.stateCode);
    const totals = computeInvoiceTotals(lines, { interState });
    const invoiceNo = nextInvoiceNo(last, business.invoicePrefix, date);
    last = invoiceNo;

    const paidAmount = money(totals.grandTotal * paidFraction);
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + (cust.creditDays || 0));

    invoices.push({
      id: uid('inv_'),
      invoiceNo,
      date: date.toISOString(),
      dueDate: dueDate.toISOString(),
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerEmail: cust.email,
      customerGstin: cust.gstin,
      customerAddress: [cust.address, cust.city, cust.pincode].filter(Boolean).join(', '),
      placeOfSupply: `${cust.stateCode}-${cust.state}`,
      interState,
      items: lines.map((l, idx) => ({ ...l, ...totals.lines[idx] })),
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
      paymentMode: paidFraction === 1 ? 'UPI' : 'Credit',
      notes: '',
      payments: paidAmount > 0
        ? [{
            id: uid('pay_'),
            amount: paidAmount,
            mode: 'UPI',
            gateway: 'manual',
            reference: '',
            date: date.toISOString(),
          }]
        : [],
    });
  });

  return invoices;
}

/** A brand new database, seeded and ready to trade. */
export function freshDatabase({ withDemoData = true } = {}) {
  return {
    business: { ...business },
    customers: customers.map((c) => ({ ...c })),
    products: products.map((p) => ({ ...p })),
    invoices: withDemoData ? demoInvoices() : [],
    stockMoves: [],
    paymentOrders: [],
  };
}

/** Tolerate databases written by an older version. */
export function migrate(db) {
  if (!db || typeof db !== 'object') return freshDatabase();
  db.business ||= { ...business };
  db.customers ||= [];
  db.products ||= [];
  db.invoices ||= [];
  db.stockMoves ||= [];
  db.paymentOrders ||= [];
  return db;
}
