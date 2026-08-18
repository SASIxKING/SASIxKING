/**
 * Month-over-month trend analysis for the dashboard.
 * Pure functions over the invoice/payment arrays — no I/O, easy to test.
 */

import { money } from './gst.js';

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM' bucket key for a date-ish value. */
export function monthKey(dateish) {
  const d = new Date(dateish);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_LABELS[Number(m) - 1]} ${String(y).slice(2)}`;
}

/** The last `count` month keys ending at `end` (inclusive), oldest first. */
export function recentMonthKeys(count = 6, end = new Date()) {
  const keys = [];
  const d = new Date(end.getFullYear(), end.getMonth(), 1);
  for (let i = count - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(monthKey(m));
  }
  return keys;
}

/**
 * Percentage change from `previous` to `current`.
 * Returns null when there is no meaningful baseline, so the UI can show "—"
 * instead of a misleading "+100%" or a division-by-zero Infinity.
 */
export function percentChange(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : null;
  return money(((c - p) / Math.abs(p)) * 100);
}

/**
 * Bucket invoices into a monthly series.
 * @returns {{key:string,label:string,revenue:number,tax:number,count:number,collected:number}[]}
 */
export function monthlySeries(invoices, { months = 6, end = new Date() } = {}) {
  const keys = recentMonthKeys(months, end);
  const buckets = new Map(keys.map((k) => [k, {
    key: k, label: monthLabel(k), revenue: 0, tax: 0, count: 0, collected: 0,
  }]));

  for (const inv of invoices) {
    const k = monthKey(inv.date);
    const bucket = buckets.get(k);
    if (!bucket) continue;
    bucket.revenue = money(bucket.revenue + (Number(inv.grandTotal) || 0));
    bucket.tax = money(bucket.tax + (Number(inv.totalTax) || 0));
    bucket.collected = money(bucket.collected + (Number(inv.paidAmount) || 0));
    bucket.count += 1;
  }

  return keys.map((k) => buckets.get(k));
}

/** Headline metrics comparing this month against last month. */
export function monthOverMonth(invoices, { end = new Date() } = {}) {
  const series = monthlySeries(invoices, { months: 2, end });
  const [prev, curr] = series;

  return {
    current: curr,
    previous: prev,
    revenueChange: percentChange(curr.revenue, prev.revenue),
    taxChange: percentChange(curr.tax, prev.tax),
    invoiceChange: percentChange(curr.count, prev.count),
    collectedChange: percentChange(curr.collected, prev.collected),
  };
}

/** Revenue split by product category for the current month. */
export function categoryBreakdown(invoices, products, { end = new Date() } = {}) {
  const key = monthKey(end);
  const byId = new Map(products.map((p) => [p.id, p]));
  const totals = new Map();

  for (const inv of invoices) {
    if (monthKey(inv.date) !== key) continue;
    for (const item of inv.items || []) {
      const cat = byId.get(item.productId)?.category || 'Other';
      totals.set(cat, money((totals.get(cat) || 0) + (Number(item.taxable) || 0)));
    }
  }

  const rows = [...totals.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);

  const sum = rows.reduce((a, r) => a + r.value, 0);
  return rows.map((r) => ({
    ...r,
    share: sum > 0 ? money((r.value / sum) * 100) : 0,
  }));
}

/** Best selling products this month, by revenue. */
export function topProducts(invoices, { end = new Date(), limit = 5 } = {}) {
  const key = monthKey(end);
  const totals = new Map();

  for (const inv of invoices) {
    if (monthKey(inv.date) !== key) continue;
    for (const item of inv.items || []) {
      const row = totals.get(item.name) || { name: item.name, qty: 0, revenue: 0 };
      row.qty += Number(item.qty) || 0;
      row.revenue = money(row.revenue + (Number(item.taxable) || 0));
      totals.set(item.name, row);
    }
  }

  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

/** Receivables ageing buckets, driven by invoice due dates. */
export function receivablesAgeing(invoices, { asOf = new Date() } = {}) {
  const buckets = [
    { label: 'Not due', min: -Infinity, max: 0, amount: 0, count: 0 },
    { label: '1-30 days', min: 1, max: 30, amount: 0, count: 0 },
    { label: '31-60 days', min: 31, max: 60, amount: 0, count: 0 },
    { label: '60+ days', min: 61, max: Infinity, amount: 0, count: 0 },
  ];

  for (const inv of invoices) {
    const balance = money((Number(inv.grandTotal) || 0) - (Number(inv.paidAmount) || 0));
    if (balance <= 0.009) continue;
    const days = Math.floor((asOf - new Date(inv.dueDate)) / 86400000);
    const bucket = buckets.find((b) => days >= b.min && days <= b.max);
    if (bucket) {
      bucket.amount = money(bucket.amount + balance);
      bucket.count += 1;
    }
  }

  return buckets;
}

/** Stock valuation + items at or below their reorder level. */
export function inventoryHealth(products) {
  let costValue = 0;
  let retailValue = 0;
  const lowStock = [];
  const outOfStock = [];

  for (const p of products) {
    if (p.category === 'Service') continue;
    const qty = Number(p.stockQty) || 0;
    costValue = money(costValue + qty * (Number(p.purchasePrice) || 0));
    retailValue = money(retailValue + qty * (Number(p.sellingPrice) || 0));
    if (qty <= 0) outOfStock.push(p);
    else if (qty <= (Number(p.reorderLevel) || 0)) lowStock.push(p);
  }

  return {
    costValue,
    retailValue,
    potentialMargin: money(retailValue - costValue),
    lowStock,
    outOfStock,
  };
}
