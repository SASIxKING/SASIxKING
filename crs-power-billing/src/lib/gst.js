/**
 * GST engine for C.R.S Power Solution.
 *
 * Pondicherry (Puducherry) — state code 34.
 * Intra-state supply  -> CGST + SGST (half the slab each)
 * Inter-state supply  -> IGST (full slab)
 *
 * Slabs used by the business:
 *   18% — inverters, UPS, solar controllers, stabilizers, accessories, services
 *   28% — lead-acid batteries (HSN 8507)
 *
 * All money is handled in paise internally to avoid floating point drift,
 * then returned as rupees rounded to 2 decimals.
 */

export const HOME_STATE_CODE = '34';
export const GST_SLABS = [18, 28];

/** Round half-up to 2 decimals (accounting convention). */
export function money(value) {
  const n = Number(value) || 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convert rupees to integer paise. */
function toPaise(rupees) {
  return Math.round((Number(rupees) || 0) * 100);
}

/** ₹1,23,456.78 — Indian digit grouping (lakh / crore). */
export function formatINR(value, { withSymbol = true } = {}) {
  const n = money(value);
  const negative = n < 0;
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const paise = Math.round((abs - whole) * 100);

  const s = String(whole);
  let grouped;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    const parts = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length) parts.unshift(rest);
    grouped = `${parts.join(',')},${last3}`;
  }

  const body = `${grouped}.${String(paise).padStart(2, '0')}`;
  return `${negative ? '-' : ''}${withSymbol ? '₹' : ''}${body}`;
}

/**
 * Cost a single invoice line.
 *
 * @param {object} line
 * @param {number} line.qty
 * @param {number} line.rate            price per unit, GST-exclusive
 * @param {number} [line.discountPct]   0-100
 * @param {number} line.gstRate         18 or 28
 * @param {boolean} interState
 */
export function computeLine(line, interState = false) {
  const qty = Number(line.qty) || 0;
  const rate = Number(line.rate) || 0;
  const discountPct = Number(line.discountPct) || 0;
  const gstRate = Number(line.gstRate) || 0;

  const grossPaise = toPaise(qty * rate);
  const discountPaise = Math.round((grossPaise * discountPct) / 100);
  const taxablePaise = grossPaise - discountPaise;
  const taxPaise = Math.round((taxablePaise * gstRate) / 100);

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (interState) {
    igstPaise = taxPaise;
  } else {
    // split so the halves always sum exactly to the total tax
    cgstPaise = Math.floor(taxPaise / 2);
    sgstPaise = taxPaise - cgstPaise;
  }

  return {
    gross: money(grossPaise / 100),
    discount: money(discountPaise / 100),
    taxable: money(taxablePaise / 100),
    gstRate,
    cgst: money(cgstPaise / 100),
    sgst: money(sgstPaise / 100),
    igst: money(igstPaise / 100),
    tax: money(taxPaise / 100),
    total: money((taxablePaise + taxPaise) / 100),
  };
}

/**
 * Aggregate lines into invoice totals, applying an optional old-battery
 * exchange (buy-back) deduction and rupee round-off.
 */
export function computeInvoiceTotals(lines, { interState = false, exchange = 0 } = {}) {
  const computed = lines.map((l) => computeLine(l, interState));

  const sum = (key) => computed.reduce((acc, l) => acc + toPaise(l[key]), 0);

  const grossPaise = sum('gross');
  const discountPaise = sum('discount');
  const taxablePaise = sum('taxable');
  const cgstPaise = sum('cgst');
  const sgstPaise = sum('sgst');
  const igstPaise = sum('igst');
  const exchangePaise = toPaise(exchange);

  const beforeRoundPaise =
    taxablePaise + cgstPaise + sgstPaise + igstPaise - exchangePaise;

  const roundedPaise = Math.round(beforeRoundPaise / 100) * 100;
  const roundOffPaise = roundedPaise - beforeRoundPaise;

  return {
    lines: computed,
    subTotal: money(grossPaise / 100),
    discount: money(discountPaise / 100),
    taxable: money(taxablePaise / 100),
    cgst: money(cgstPaise / 100),
    sgst: money(sgstPaise / 100),
    igst: money(igstPaise / 100),
    totalTax: money((cgstPaise + sgstPaise + igstPaise) / 100),
    exchange: money(exchangePaise / 100),
    roundOff: money(roundOffPaise / 100),
    grandTotal: money(roundedPaise / 100),
    interState,
  };
}

/** Decide intra vs inter state from the customer's GSTIN / state code. */
export function isInterState(customerStateCode) {
  if (!customerStateCode) return false;
  return String(customerStateCode).trim() !== HOME_STATE_CODE;
}

/** HSN-wise tax summary for the GSTR-1 style report and the invoice footer. */
export function hsnSummary(lines, interState = false) {
  const map = new Map();
  for (const line of lines) {
    const c = computeLine(line, interState);
    const key = line.hsn || '—';
    const row = map.get(key) || {
      hsn: key,
      gstRate: line.gstRate,
      qty: 0,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
    };
    row.qty += Number(line.qty) || 0;
    row.taxable = money(row.taxable + c.taxable);
    row.cgst = money(row.cgst + c.cgst);
    row.sgst = money(row.sgst + c.sgst);
    row.igst = money(row.igst + c.igst);
    map.set(key, row);
  }
  return [...map.values()];
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const out = [];
  if (h) out.push(`${ONES[h]} Hundred`);
  if (r) out.push(twoDigits(r));
  return out.join(' ');
}

/** Indian numbering system: crore / lakh / thousand. */
export function wordsForNumber(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (n) parts.push(threeDigits(n));
  return parts.join(' ');
}

/** "Rupees Fifty Three Thousand Twenty Two and Fifty Paise Only" */
export function amountInWords(value) {
  const n = money(Math.abs(value));
  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  let out = `Rupees ${wordsForNumber(rupees)}`;
  if (paise > 0) out += ` and ${wordsForNumber(paise)} Paise`;
  return `${out} Only`;
}

/**
 * Invoice numbering: CRS/2025-26/0001, restarting each Indian financial year
 * (which begins on 1 April).
 */
export function financialYear(date = new Date()) {
  const y = date.getFullYear();
  const startYear = date.getMonth() < 3 ? y - 1 : y; // Jan-Mar belong to the previous FY
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

export function nextInvoiceNo(lastInvoiceNo, prefix = 'CRS', date = new Date()) {
  const fy = financialYear(date);
  let seq = 1;
  if (lastInvoiceNo) {
    const parts = String(lastInvoiceNo).split('/');
    const lastFy = parts[1];
    const lastSeq = parseInt(parts[2], 10);
    if (lastFy === fy && Number.isFinite(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}/${fy}/${String(seq).padStart(4, '0')}`;
}
