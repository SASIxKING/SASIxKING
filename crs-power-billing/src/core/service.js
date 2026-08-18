/**
 * Transport-agnostic business core.
 *
 * This is the single source of truth for every rule that protects money:
 * GST slabs, stock levels, payment amounts and invoice numbering.
 *
 * It is used in two very different ways and MUST behave identically in both:
 *
 *   Web      → server/index.js wraps it behind Express (rules run on the server,
 *              the browser cannot bypass them)
 *   Android / Windows
 *            → the packaged app calls it directly in-process against local
 *              storage (no server, fully offline)
 *
 * Keeping one implementation means an offline invoice on a shop tablet is
 * validated exactly as strictly as one created through the web API. If these
 * ever diverged, the offline app would become the weak link.
 *
 * `store` is any object implementing the adapter contract:
 *   read()            -> db object
 *   write(db)         -> persists it
 */

import {
  computeInvoiceTotals,
  isInterState,
  nextInvoiceNo,
  money,
} from '../lib/gst.js';

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.status = status;
  }
}

export const VALID_GST_RATES = [18, 28];

export function uid(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function createService(store) {
  const read = () => store.read();
  const commit = (db) => store.write(db);

  /* ----------------------------------------------------------- business -- */

  function getBusiness() {
    return read().business;
  }

  function saveBusiness(patch) {
    const db = read();
    db.business = { ...db.business, ...patch };
    commit(db);
    return db.business;
  }

  /* ---------------------------------------------------------- customers -- */

  function listCustomers({ q = '' } = {}) {
    const db = read();
    const needle = String(q).toLowerCase().trim();

    return db.customers
      .filter((c) =>
        !needle
          ? true
          : [c.name, c.phone, c.city, c.gstin, c.email]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)))
      .map((c) => {
        const invs = db.invoices.filter((i) => i.customerId === c.id);
        const billed = money(invs.reduce((a, i) => a + i.grandTotal, 0));
        const paid = money(invs.reduce((a, i) => a + i.paidAmount, 0));
        return {
          ...c,
          totalBilled: billed,
          totalPaid: paid,
          balance: money(billed - paid),
          invoiceCount: invs.length,
        };
      });
  }

  function createCustomer(body = {}) {
    if (!body.name || !String(body.name).trim()) {
      throw new ValidationError('Customer name is required');
    }
    const db = read();
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
    commit(db);
    return customer;
  }

  function updateCustomer(id, patch = {}) {
    const db = read();
    const idx = db.customers.findIndex((c) => c.id === id);
    if (idx === -1) throw new ValidationError('Customer not found', 404);
    db.customers[idx] = { ...db.customers[idx], ...patch, id };
    commit(db);
    return db.customers[idx];
  }

  function deleteCustomer(id) {
    const db = read();
    if (db.invoices.some((i) => i.customerId === id)) {
      throw new ValidationError('Cannot delete a customer who already has invoices', 409);
    }
    db.customers = db.customers.filter((c) => c.id !== id);
    commit(db);
    return { deleted: true };
  }

  /* ----------------------------------------------------------- products -- */

  function listProducts({ q = '', category = 'All' } = {}) {
    const db = read();
    const needle = String(q).toLowerCase().trim();
    return db.products
      .filter((p) => (category === 'All' || !category ? true : p.category === category))
      .filter((p) =>
        !needle
          ? true
          : [p.name, p.brand, p.model, p.capacity, p.hsn]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)));
  }

  function assertGstRate(rate) {
    if (!VALID_GST_RATES.includes(Number(rate))) {
      throw new ValidationError('GST rate must be 18% or 28%');
    }
  }

  function createProduct(body = {}) {
    if (!body.name || !String(body.name).trim()) {
      throw new ValidationError('Product name is required');
    }
    assertGstRate(body.gstRate);

    const db = read();
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
      gstRate: Number(body.gstRate),
      stockQty: Number(body.stockQty) || 0,
      reorderLevel: Number(body.reorderLevel) || 0,
      warrantyMonths: Number(body.warrantyMonths) || 0,
      exchangeValue: Number(body.exchangeValue) || 0,
      trackSerial: Boolean(body.trackSerial),
    };
    db.products.push(product);
    commit(db);
    return product;
  }

  function updateProduct(id, patch = {}) {
    const db = read();
    const idx = db.products.findIndex((p) => p.id === id);
    if (idx === -1) throw new ValidationError('Product not found', 404);
    if (patch.gstRate !== undefined) assertGstRate(patch.gstRate);
    db.products[idx] = { ...db.products[idx], ...patch, id };
    commit(db);
    return db.products[idx];
  }

  function deleteProduct(id) {
    const db = read();
    db.products = db.products.filter((p) => p.id !== id);
    commit(db);
    return { deleted: true };
  }

  function adjustStock(id, { qty, reason = 'Manual adjustment' } = {}) {
    const db = read();
    const product = db.products.find((p) => p.id === id);
    if (!product) throw new ValidationError('Product not found', 404);

    const delta = Number(qty);
    if (!Number.isFinite(delta) || delta === 0) {
      throw new ValidationError('Quantity must be a non-zero number');
    }

    product.stockQty = money((Number(product.stockQty) || 0) + delta);
    db.stockMoves.unshift({
      id: uid('sm_'),
      productId: product.id,
      productName: product.name,
      type: delta > 0 ? 'IN' : 'ADJUST',
      qty: delta,
      reason,
      date: new Date().toISOString(),
    });
    db.stockMoves = db.stockMoves.slice(0, 500);
    commit(db);
    return product;
  }

  function listStockMoves() {
    return read().stockMoves.slice(0, 100);
  }

  /* ----------------------------------------------------------- invoices -- */

  function listInvoices({ q = '', status = 'All' } = {}) {
    const db = read();
    const needle = String(q).toLowerCase().trim();
    return [...db.invoices]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((i) => (status === 'All' || !status ? true : i.status === status))
      .filter((i) =>
        !needle
          ? true
          : [i.invoiceNo, i.customerName, i.customerPhone]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle)));
  }

  function getInvoice(id) {
    const inv = read().invoices.find((i) => i.id === id);
    if (!inv) throw new ValidationError('Invoice not found', 404);
    return inv;
  }

  function peekNextInvoiceNo(date = new Date()) {
    const db = read();
    const last = [...db.invoices].sort((a, b) => new Date(a.date) - new Date(b.date)).pop();
    return { invoiceNo: nextInvoiceNo(last?.invoiceNo, db.business.invoicePrefix, date) };
  }

  /**
   * Create an invoice.
   *
   * Every price-affecting field is re-derived from the product master, so a
   * tampered payload (or a buggy client) cannot invent GST rates or HSN codes.
   */
  function createInvoice(body = {}) {
    const db = read();

    const customer = db.customers.find((c) => c.id === body.customerId);
    if (!customer) throw new ValidationError('Select a valid customer');
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new ValidationError('Add at least one item to the invoice');
    }

    const lines = [];
    for (const item of body.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (!product) throw new ValidationError(`Unknown product: ${item.productId}`);

      const qty = Number(item.qty);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new ValidationError(`Invalid quantity for ${product.name}`);
      }

      const rate =
        item.rate !== undefined && item.rate !== '' ? Number(item.rate) : product.sellingPrice;
      if (!Number.isFinite(rate) || rate < 0) {
        throw new ValidationError(`Invalid rate for ${product.name}`);
      }

      const discountPct = Number(item.discountPct) || 0;
      if (discountPct < 0 || discountPct > 100) {
        throw new ValidationError(`Discount for ${product.name} must be between 0 and 100%`);
      }

      lines.push({
        productId: product.id,
        name: product.name,
        hsn: product.hsn,
        unit: product.unit,
        qty,
        rate,
        discountPct,
        gstRate: product.gstRate,      // always from the master
        serials: item.serials || '',
        warrantyMonths: product.warrantyMonths,
      });
    }

    // Validate stock for the whole basket before mutating anything.
    for (const line of lines) {
      const product = db.products.find((p) => p.id === line.productId);
      if (product.category === 'Service') continue;
      if ((Number(product.stockQty) || 0) < line.qty) {
        throw new ValidationError(
          `Insufficient stock for ${product.name}: ${product.stockQty} available, ${line.qty} requested`,
          409,
        );
      }
    }

    const interState = isInterState(customer.stateCode);
    const totals = computeInvoiceTotals(lines, {
      interState,
      exchange: Number(body.exchange) || 0,
    });

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
      customerAddress: [customer.address, customer.city, customer.pincode]
        .filter(Boolean)
        .join(', '),
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
      status:
        paidAmount >= totals.grandTotal - 0.01 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
      paymentMode: body.paymentMode || 'Cash',
      notes: body.notes || '',
      payments: paidAmount > 0
        ? [{
            id: uid('pay_'),
            amount: paidAmount,
            mode: body.paymentMode || 'Cash',
            gateway: 'manual',
            reference: '',
            date: date.toISOString(),
          }]
        : [],
    };

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
    commit(db);
    return invoice;
  }

  function addPayment(invoiceId, { amount, mode = 'Cash', reference = '', gateway = 'manual', simulated = false } = {}) {
    const db = read();
    const invoice = db.invoices.find((i) => i.id === invoiceId);
    if (!invoice) throw new ValidationError('Invoice not found', 404);

    const value = money(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      throw new ValidationError('Enter a valid amount');
    }

    const balance = money(invoice.grandTotal - invoice.paidAmount);
    if (value > balance + 0.01) {
      throw new ValidationError(
        `Amount exceeds the outstanding balance of ₹${balance.toFixed(2)}`,
      );
    }

    invoice.payments.push({
      id: uid('pay_'),
      amount: value,
      mode,
      gateway,
      reference,
      ...(simulated ? { simulated: true } : {}),
      date: new Date().toISOString(),
    });
    invoice.paidAmount = money(invoice.paidAmount + value);
    invoice.status = invoice.paidAmount >= invoice.grandTotal - 0.01 ? 'PAID' : 'PARTIAL';
    commit(db);
    return invoice;
  }

  function deleteInvoice(id) {
    const db = read();
    const invoice = db.invoices.find((i) => i.id === id);
    if (!invoice) throw new ValidationError('Invoice not found', 404);

    // Restore stock so inventory stays truthful.
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
    db.invoices = db.invoices.filter((i) => i.id !== id);
    commit(db);
    return { deleted: true };
  }

  /* ---------------------------------------------------------- dashboard -- */

  function dashboard() {
    const db = read();
    return {
      business: db.business,
      invoices: db.invoices,
      products: db.products,
      customers: db.customers,
    };
  }

  /** Full snapshot for backup / export. */
  function exportAll() {
    return { ...read(), exportedAt: new Date().toISOString() };
  }

  function importAll(payload) {
    if (!payload || !Array.isArray(payload.invoices) || !Array.isArray(payload.products)) {
      throw new ValidationError('That file is not a valid C.R.S Power Solution backup');
    }
    const db = read();
    const next = {
      business: payload.business || db.business,
      customers: payload.customers || [],
      products: payload.products || [],
      invoices: payload.invoices || [],
      stockMoves: payload.stockMoves || [],
      paymentOrders: payload.paymentOrders || [],
    };
    commit(next);
    return {
      imported: true,
      customers: next.customers.length,
      products: next.products.length,
      invoices: next.invoices.length,
    };
  }

  return {
    getBusiness, saveBusiness,
    listCustomers, createCustomer, updateCustomer, deleteCustomer,
    listProducts, createProduct, updateProduct, deleteProduct, adjustStock, listStockMoves,
    listInvoices, getInvoice, peekNextInvoiceNo, createInvoice, addPayment, deleteInvoice,
    dashboard, exportAll, importAll,
  };
}
