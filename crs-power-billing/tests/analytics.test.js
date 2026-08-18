import test from 'node:test';
import assert from 'node:assert/strict';

import {
  percentChange,
  monthKey,
  recentMonthKeys,
  monthlySeries,
  monthOverMonth,
  receivablesAgeing,
  inventoryHealth,
  topProducts,
  categoryBreakdown,
} from '../src/lib/analytics.js';

const iso = (y, m, d) => new Date(y, m - 1, d, 12).toISOString();

test('percentChange handles growth, decline and flat', () => {
  assert.equal(percentChange(150, 100), 50);
  assert.equal(percentChange(50, 100), -50);
  assert.equal(percentChange(100, 100), 0);
});

test('percentChange returns null when there is no baseline to compare against', () => {
  // Growing from zero is not "+100%" — it is undefined. The UI shows "—".
  assert.equal(percentChange(500, 0), null);
  assert.equal(percentChange(0, 0), 0);
});

test('recentMonthKeys returns consecutive months oldest first', () => {
  const keys = recentMonthKeys(3, new Date(2026, 2, 15)); // Mar 2026
  assert.deepEqual(keys, ['2026-01', '2026-02', '2026-03']);
});

test('recentMonthKeys rolls correctly across a year boundary', () => {
  const keys = recentMonthKeys(3, new Date(2026, 0, 10)); // Jan 2026
  assert.deepEqual(keys, ['2025-11', '2025-12', '2026-01']);
});

test('monthlySeries buckets invoices into the right months', () => {
  const end = new Date(2026, 5, 20); // Jun 2026
  const invoices = [
    { date: iso(2026, 6, 3), grandTotal: 1000, totalTax: 180, paidAmount: 1000 },
    { date: iso(2026, 6, 18), grandTotal: 500, totalTax: 90, paidAmount: 0 },
    { date: iso(2026, 5, 9), grandTotal: 2000, totalTax: 360, paidAmount: 2000 },
    { date: iso(2025, 1, 1), grandTotal: 9999, totalTax: 999, paidAmount: 0 }, // outside window
  ];
  const series = monthlySeries(invoices, { months: 3, end });
  assert.equal(series.length, 3);
  const jun = series.at(-1);
  assert.equal(jun.revenue, 1500);
  assert.equal(jun.count, 2);
  assert.equal(jun.collected, 1000);
  const may = series.at(-2);
  assert.equal(may.revenue, 2000);
});

test('monthOverMonth compares the current month against the previous one', () => {
  const end = new Date(2026, 5, 20);
  const invoices = [
    { date: iso(2026, 6, 3), grandTotal: 1500, totalTax: 270, paidAmount: 1500 },
    { date: iso(2026, 5, 9), grandTotal: 1000, totalTax: 180, paidAmount: 1000 },
  ];
  const mom = monthOverMonth(invoices, { end });
  assert.equal(mom.current.revenue, 1500);
  assert.equal(mom.previous.revenue, 1000);
  assert.equal(mom.revenueChange, 50);
});

test('receivables ageing buckets by how overdue each invoice is', () => {
  const asOf = new Date(2026, 5, 30);
  const invoices = [
    { dueDate: iso(2026, 7, 15), grandTotal: 1000, paidAmount: 0 },   // not due
    { dueDate: iso(2026, 6, 20), grandTotal: 2000, paidAmount: 0 },   // 10 days
    { dueDate: iso(2026, 5, 20), grandTotal: 3000, paidAmount: 0 },   // ~41 days
    { dueDate: iso(2026, 3, 1), grandTotal: 4000, paidAmount: 0 },    // 60+
    { dueDate: iso(2026, 1, 1), grandTotal: 5000, paidAmount: 5000 }, // settled, excluded
  ];
  const buckets = receivablesAgeing(invoices, { asOf });
  const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b]));
  assert.equal(byLabel['Not due'].amount, 1000);
  assert.equal(byLabel['1-30 days'].amount, 2000);
  assert.equal(byLabel['31-60 days'].amount, 3000);
  assert.equal(byLabel['60+ days'].amount, 4000);
  // fully paid invoice must not appear anywhere
  assert.equal(buckets.reduce((a, b) => a + b.count, 0), 4);
});

test('partially paid invoices age by their remaining balance only', () => {
  const asOf = new Date(2026, 5, 30);
  const buckets = receivablesAgeing(
    [{ dueDate: iso(2026, 6, 20), grandTotal: 10000, paidAmount: 7500 }],
    { asOf },
  );
  const bucket = buckets.find((b) => b.label === '1-30 days');
  assert.equal(bucket.amount, 2500);
});

test('inventory health values stock and flags reorder levels', () => {
  const products = [
    { id: 'a', category: 'Battery', stockQty: 10, purchasePrice: 100, sellingPrice: 150, reorderLevel: 4 },
    { id: 'b', category: 'Battery', stockQty: 2, purchasePrice: 200, sellingPrice: 260, reorderLevel: 4 },
    { id: 'c', category: 'Inverter', stockQty: 0, purchasePrice: 500, sellingPrice: 700, reorderLevel: 2 },
    { id: 'd', category: 'Service', stockQty: 0, purchasePrice: 0, sellingPrice: 800, reorderLevel: 0 },
  ];
  const h = inventoryHealth(products);
  assert.equal(h.costValue, 10 * 100 + 2 * 200);   // services excluded
  assert.equal(h.retailValue, 10 * 150 + 2 * 260);
  assert.equal(h.potentialMargin, h.retailValue - h.costValue);
  assert.equal(h.lowStock.map((p) => p.id).join(), 'b');
  assert.equal(h.outOfStock.map((p) => p.id).join(), 'c');
});

test('topProducts ranks this month by revenue', () => {
  const end = new Date(2026, 5, 20);
  const invoices = [
    {
      date: iso(2026, 6, 5),
      items: [
        { productId: 'p1', name: 'Battery 150Ah', qty: 2, taxable: 29000 },
        { productId: 'p2', name: 'Inverter 900VA', qty: 1, taxable: 8200 },
      ],
    },
    {
      date: iso(2026, 6, 12),
      items: [{ productId: 'p2', name: 'Inverter 900VA', qty: 3, taxable: 24600 }],
    },
    {
      date: iso(2026, 4, 12), // different month, must be ignored
      items: [{ productId: 'p3', name: 'Solar Panel', qty: 9, taxable: 99999 }],
    },
  ];
  const top = topProducts(invoices, { end, limit: 5 });
  assert.equal(top[0].name, 'Inverter 900VA');
  assert.equal(top[0].qty, 4);
  assert.equal(top[0].revenue, 32800);
  assert.equal(top.length, 2);
});

test('categoryBreakdown computes shares that add up to 100%', () => {
  const end = new Date(2026, 5, 20);
  const products = [
    { id: 'p1', category: 'Battery' },
    { id: 'p2', category: 'Inverter' },
  ];
  const invoices = [{
    date: iso(2026, 6, 5),
    items: [
      { productId: 'p1', taxable: 7500 },
      { productId: 'p2', taxable: 2500 },
    ],
  }];
  const rows = categoryBreakdown(invoices, products, { end });
  assert.equal(rows[0].category, 'Battery');
  assert.equal(rows[0].share, 75);
  assert.equal(Math.round(rows.reduce((a, r) => a + r.share, 0)), 100);
});
