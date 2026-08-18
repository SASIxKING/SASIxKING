import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeLine,
  computeInvoiceTotals,
  formatINR,
  amountInWords,
  wordsForNumber,
  nextInvoiceNo,
  financialYear,
  isInterState,
  hsnSummary,
  money,
} from '../src/lib/gst.js';

test('28% battery slab splits into equal CGST and SGST intra-state', () => {
  const line = computeLine({ qty: 1, rate: 14500, gstRate: 28 }, false);
  assert.equal(line.taxable, 14500);
  assert.equal(line.cgst, 2030);
  assert.equal(line.sgst, 2030);
  assert.equal(line.igst, 0);
  assert.equal(line.total, 18560);
});

test('18% inverter slab computes correctly', () => {
  const line = computeLine({ qty: 1, rate: 8200, gstRate: 18 }, false);
  assert.equal(line.taxable, 8200);
  assert.equal(line.cgst, 738);
  assert.equal(line.sgst, 738);
  assert.equal(line.total, 9676);
});

test('inter-state supply uses IGST only', () => {
  const line = computeLine({ qty: 1, rate: 12500, gstRate: 18 }, true);
  assert.equal(line.igst, 2250);
  assert.equal(line.cgst, 0);
  assert.equal(line.sgst, 0);
  assert.equal(line.total, 14750);
});

test('CGST + SGST always sum exactly to the total tax, even on odd paise', () => {
  // 28% of 1234.57 = 345.6796 -> 345.68, which is an odd number of paise
  const line = computeLine({ qty: 1, rate: 1234.57, gstRate: 28 }, false);
  assert.equal(money(line.cgst + line.sgst), line.tax);
});

test('line discount reduces the taxable value before tax is applied', () => {
  const line = computeLine({ qty: 2, rate: 14500, discountPct: 5, gstRate: 28 }, false);
  assert.equal(line.gross, 29000);
  assert.equal(line.discount, 1450);
  assert.equal(line.taxable, 27550);
  assert.equal(line.tax, money(27550 * 0.28));
});

test('invoice totals aggregate mixed 18% and 28% slabs', () => {
  const lines = [
    { qty: 2, rate: 14500, gstRate: 28, hsn: '8507' }, // batteries
    { qty: 1, rate: 8200, gstRate: 18, hsn: '8504' },  // inverter
  ];
  const t = computeInvoiceTotals(lines);
  assert.equal(t.taxable, 37200);
  assert.equal(t.cgst, money((29000 * 0.28 + 8200 * 0.18) / 2));
  assert.equal(t.cgst, t.sgst);
  assert.equal(t.totalTax, money(29000 * 0.28 + 8200 * 0.18));
});

test('old battery exchange is deducted and the total is rounded to the rupee', () => {
  const t = computeInvoiceTotals(
    [{ qty: 1, rate: 14500, gstRate: 28 }],
    { exchange: 1200 },
  );
  assert.equal(t.exchange, 1200);
  assert.equal(t.grandTotal, 17360); // 18560 - 1200
  assert.equal(Number.isInteger(t.grandTotal), true);
});

test('round off never exceeds half a rupee', () => {
  const t = computeInvoiceTotals([{ qty: 3, rate: 1449.5, gstRate: 18 }]);
  assert.ok(Math.abs(t.roundOff) <= 0.5, `roundOff was ${t.roundOff}`);
  assert.equal(Number.isInteger(t.grandTotal), true);
});

test('grand total equals taxable + tax - exchange + roundOff', () => {
  const t = computeInvoiceTotals(
    [
      { qty: 2, rate: 14500, discountPct: 5, gstRate: 28 },
      { qty: 1, rate: 8200, gstRate: 18 },
      { qty: 1, rate: 800, gstRate: 18 },
    ],
    { exchange: 1200 },
  );
  const reconstructed = money(t.taxable + t.totalTax - t.exchange + t.roundOff);
  assert.equal(reconstructed, t.grandTotal);
});

test('Indian digit grouping', () => {
  assert.equal(formatINR(123456.78), '₹1,23,456.78');
  assert.equal(formatINR(999.5), '₹999.50');
  assert.equal(formatINR(12345678), '₹1,23,45,678.00');
  assert.equal(formatINR(0), '₹0.00');
  assert.equal(formatINR(-5000), '-₹5,000.00');
});

test('amount in words uses lakh and crore', () => {
  assert.equal(wordsForNumber(123456), 'One Lakh Twenty Three Thousand Four Hundred Fifty Six');
  assert.equal(wordsForNumber(10000000), 'One Crore');
  assert.equal(amountInWords(17360), 'Rupees Seventeen Thousand Three Hundred Sixty Only');
  assert.match(amountInWords(1200.5), /and Fifty Paise Only$/);
});

test('invoice numbers increment inside a financial year and reset across it', () => {
  const march = new Date('2026-03-15T10:00:00');
  const april = new Date('2026-04-02T10:00:00');

  assert.equal(financialYear(march), '2025-26');
  assert.equal(financialYear(april), '2026-27');

  const first = nextInvoiceNo(null, 'CRS', march);
  assert.equal(first, 'CRS/2025-26/0001');
  assert.equal(nextInvoiceNo(first, 'CRS', march), 'CRS/2025-26/0002');

  // crossing into the new FY restarts the sequence
  assert.equal(nextInvoiceNo('CRS/2025-26/0042', 'CRS', april), 'CRS/2026-27/0001');
});

test('state code 34 (Puducherry) is intra-state, everything else is inter-state', () => {
  assert.equal(isInterState('34'), false);
  assert.equal(isInterState('33'), true);  // Tamil Nadu
  assert.equal(isInterState(''), false);   // unregistered walk-in -> local
});

test('HSN summary groups by HSN code', () => {
  const rows = hsnSummary([
    { qty: 2, rate: 14500, gstRate: 28, hsn: '8507' },
    { qty: 1, rate: 9000, gstRate: 28, hsn: '8507' },
    { qty: 1, rate: 8200, gstRate: 18, hsn: '8504' },
  ]);
  assert.equal(rows.length, 2);
  const battery = rows.find((r) => r.hsn === '8507');
  assert.equal(battery.qty, 3);
  assert.equal(battery.taxable, 38000);
});
