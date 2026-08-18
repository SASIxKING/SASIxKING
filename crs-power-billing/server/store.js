/**
 * JSON-file persistence. Deliberately dependency-free so the project runs
 * inside bolt.diy / WebContainer where native modules (better-sqlite3 etc.)
 * cannot be compiled.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { business, customers, products } from './data/seed.js';
import { computeInvoiceTotals, isInterState, nextInvoiceNo, money } from '../src/lib/gst.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Build a few months of history so the trend dashboard is meaningful on day one. */
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

function freshDb() {
  return {
    business,
    customers: customers.map((c) => ({ ...c })),
    products: products.map((p) => ({ ...p })),
    invoices: demoInvoices(),
    stockMoves: [],
    paymentOrders: [],
  };
}

export function load() {
  if (db) return db;
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // tolerate older files that predate a field
      db.paymentOrders ||= [];
      db.stockMoves ||= [];
      return db;
    }
  } catch (err) {
    console.warn('[store] could not read db.json, reseeding:', err.message);
  }
  db = freshDb();
  save();
  return db;
}

export function save() {
  if (!db) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function reset() {
  db = freshDb();
  save();
  return db;
}

export { uid };
