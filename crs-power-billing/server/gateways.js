/**
 * Payment gateway integration — Razorpay, Cashfree and PayU.
 *
 * Design rules that matter for real money:
 *
 *  1. API SECRETS NEVER REACH THE BROWSER. Only the public key id is sent to
 *     the client; signing and verification happen here on the server.
 *  2. The amount charged is ALWAYS recomputed from the stored invoice. We never
 *     trust an amount supplied by the client, otherwise anyone could pay ₹1
 *     for a ₹18,000 battery.
 *  3. Callbacks are verified with an HMAC signature check using a
 *     timing-safe comparison before the invoice is marked paid.
 *
 * Without credentials configured the module runs in "simulation" mode so the
 * whole flow is demonstrable offline. Simulated payments are clearly flagged
 * as such in the API responses and in the UI.
 */

import crypto from 'node:crypto';

/** Read gateway config from the environment. */
export function gatewayConfig() {
  return {
    razorpay: {
      id: 'razorpay',
      label: 'Razorpay',
      keyId: process.env.RAZORPAY_KEY_ID || '',
      keySecret: process.env.RAZORPAY_KEY_SECRET || '',
      get live() { return Boolean(this.keyId && this.keySecret); },
    },
    cashfree: {
      id: 'cashfree',
      label: 'Cashfree',
      keyId: process.env.CASHFREE_APP_ID || '',
      keySecret: process.env.CASHFREE_SECRET_KEY || '',
      get live() { return Boolean(this.keyId && this.keySecret); },
    },
    payu: {
      id: 'payu',
      label: 'PayU',
      keyId: process.env.PAYU_MERCHANT_KEY || '',
      keySecret: process.env.PAYU_MERCHANT_SALT || '',
      get live() { return Boolean(this.keyId && this.keySecret); },
    },
  };
}

/** Public view of gateway status — safe to send to the browser. */
export function publicGatewayStatus() {
  const cfg = gatewayConfig();
  return Object.values(cfg).map((g) => ({
    id: g.id,
    label: g.label,
    live: g.live,
    keyId: g.live ? g.keyId : '',        // publishable id only; never the secret
    mode: g.live ? 'live' : 'simulation',
  }));
}

/** Rupees -> the smallest currency unit (paise) that gateways expect. */
export function toMinorUnit(rupees) {
  return Math.round((Number(rupees) || 0) * 100);
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Create a payment order for an invoice.
 *
 * @param {string} gatewayId  razorpay | cashfree | payu
 * @param {object} invoice    the stored invoice (source of truth for amount)
 * @param {number} amount     amount to collect, validated against the balance
 */
export async function createOrder(gatewayId, invoice, amount) {
  const cfg = gatewayConfig()[gatewayId];
  if (!cfg) {
    const err = new Error(`Unknown gateway: ${gatewayId}`);
    err.status = 400;
    throw err;
  }

  const balance = Math.max(
    0,
    Math.round(((invoice.grandTotal || 0) - (invoice.paidAmount || 0)) * 100) / 100,
  );

  // Never charge more than what is actually outstanding.
  const requested = Number(amount) > 0 ? Number(amount) : balance;
  const payable = Math.min(requested, balance);

  if (payable <= 0) {
    const err = new Error('This invoice is already fully paid.');
    err.status = 400;
    throw err;
  }

  const base = {
    gateway: gatewayId,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    amount: payable,
    amountMinor: toMinorUnit(payable),
    currency: 'INR',
    customer: {
      name: invoice.customerName,
      phone: invoice.customerPhone || '',
      email: invoice.customerEmail || '',
    },
    createdAt: new Date().toISOString(),
  };

  if (!cfg.live) {
    // Simulation: mirrors the real response shape so the UI code is identical.
    return {
      ...base,
      mode: 'simulation',
      orderId: randomId(`${gatewayId}_sim_order`),
      keyId: '',
      note: `${cfg.label} credentials are not configured. This is a simulated order — no real money moves.`,
    };
  }

  if (gatewayId === 'razorpay') {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: base.amountMinor,
        currency: 'INR',
        receipt: invoice.invoiceNo,
        notes: { invoiceId: invoice.id, business: 'C.R.S Power Solution' },
      }),
    });
    if (!res.ok) throw new Error(`Razorpay order failed: ${await res.text()}`);
    const order = await res.json();
    return { ...base, mode: 'live', orderId: order.id, keyId: cfg.keyId };
  }

  if (gatewayId === 'cashfree') {
    const res = await fetch('https://api.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': cfg.keyId,
        'x-client-secret': cfg.keySecret,
      },
      body: JSON.stringify({
        order_amount: payable,
        order_currency: 'INR',
        order_id: `${invoice.invoiceNo.replace(/\//g, '-')}-${Date.now()}`,
        customer_details: {
          customer_id: invoice.customerId,
          customer_name: invoice.customerName,
          customer_phone: invoice.customerPhone || '9999999999',
          customer_email: invoice.customerEmail || 'billing@crspower.in',
        },
      }),
    });
    if (!res.ok) throw new Error(`Cashfree order failed: ${await res.text()}`);
    const order = await res.json();
    return {
      ...base,
      mode: 'live',
      orderId: order.order_id,
      paymentSessionId: order.payment_session_id,
      keyId: cfg.keyId,
    };
  }

  if (gatewayId === 'payu') {
    // PayU uses a form post signed with a SHA-512 hash rather than a REST order.
    const txnid = `${invoice.invoiceNo.replace(/\//g, '-')}-${Date.now()}`;
    const productinfo = `Invoice ${invoice.invoiceNo}`;
    const firstname = (invoice.customerName || 'Customer').split(' ')[0];
    const email = invoice.customerEmail || 'billing@crspower.in';
    const amountStr = payable.toFixed(2);

    const hash = crypto
      .createHash('sha512')
      .update([cfg.keyId, txnid, amountStr, productinfo, firstname, email,
        '', '', '', '', '', '', '', '', '', '', cfg.keySecret].join('|'))
      .digest('hex');

    return {
      ...base,
      mode: 'live',
      orderId: txnid,
      keyId: cfg.keyId,
      payuForm: { key: cfg.keyId, txnid, amount: amountStr, productinfo, firstname, email, hash },
    };
  }

  throw new Error(`Unsupported gateway: ${gatewayId}`);
}

/** Constant-time string comparison to avoid leaking signatures via timing. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8');
  const bufB = Buffer.from(String(b || ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a gateway callback. Returns true only when the signature genuinely
 * matches, so a forged browser POST cannot mark an invoice as paid.
 */
export function verifyPayment(gatewayId, payload = {}) {
  const cfg = gatewayConfig()[gatewayId];
  if (!cfg) return { ok: false, reason: 'unknown gateway' };

  if (!cfg.live) {
    // Simulation mode: accept, but label it so it is never mistaken for real.
    return { ok: true, simulated: true, reason: 'simulation mode' };
  }

  if (gatewayId === 'razorpay') {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
    const expected = crypto
      .createHmac('sha256', cfg.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    return { ok: safeEqual(expected, razorpay_signature), simulated: false };
  }

  if (gatewayId === 'cashfree') {
    // Cashfree webhook: base64 HMAC-SHA256 over (timestamp + raw body)
    const { timestamp, rawBody, signature } = payload;
    const expected = crypto
      .createHmac('sha256', cfg.keySecret)
      .update(`${timestamp}${rawBody}`)
      .digest('base64');
    return { ok: safeEqual(expected, signature), simulated: false };
  }

  if (gatewayId === 'payu') {
    // Reverse hash: salt|status|||||||udf5..udf1|email|firstname|productinfo|amount|txnid|key
    const { status, email, firstname, productinfo, amount, txnid, hash } = payload;
    const expected = crypto
      .createHash('sha512')
      .update([cfg.keySecret, status, '', '', '', '', '', '', '', '', '',
        email, firstname, productinfo, amount, txnid, cfg.keyId].join('|'))
      .digest('hex');
    return { ok: safeEqual(expected, hash), simulated: false };
  }

  return { ok: false, reason: 'unsupported gateway' };
}
