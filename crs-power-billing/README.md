# C.R.S Power Solution — Billing & Inventory

Billing, inventory and GST software for **C.R.S Power Solution**
No.16, ECR Main Road, Pillaichavady, Pondicherry – 605014.

Built to run in **[bolt.diy](https://github.com/stackblitz-labs/bolt.diy)** (browser
WebContainer) as well as any normal Node 18+ machine. React + Vite on the front,
Express on the back, JSON file storage — no native modules, no database server,
nothing to install beyond `npm install`.

---

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. That single command runs both the API (port 8787)
and the web app (port 5173); Vite proxies `/api` to the API, so the browser only
ever calls relative URLs.

```bash
npm test          # 25 unit tests over the money + analytics maths
npm run build     # production bundle into dist/
```

The app seeds itself on first run with the real product catalogue, 5 customers
and ~6 months of invoice history, so the trend dashboards are meaningful
immediately. `POST /api/reset` restores that starting state.

---

## What it does

### Customer management
Retail / Dealer / Corporate / AMC parties with GSTIN, address, credit terms and
a live outstanding balance computed from their invoices. The **state code drives
the tax treatment** — 34 (Puducherry) is local, anything else is inter-state.

### Product & inventory tracking
Purchase cost vs selling price with margin %, HSN codes, brand, model, capacity
(150Ah / 900VA / 330W), serial-number tracking and old-battery exchange values.

- Stock is **deducted automatically** when an invoice is saved and **restored**
  if the invoice is deleted
- Every movement is logged to an audit trail with the reason and invoice number
- Reorder-level alerts, plus stock valuation at both cost and retail

The API **refuses to oversell** — billing 9,999 units of a product with 11 in
stock returns a 409 rather than silently going negative.

### GST invoicing (18% / 28%)
Two slabs, exactly as the business uses them:

| Slab | Applies to |
|------|-----------|
| **28%** | Lead-acid batteries (HSN 8507) |
| **18%** | Inverters, solar, stabilizers, accessories, installation, AMC |

- **Intra-state → CGST + SGST**, **inter-state → IGST**, chosen automatically
  from the customer's state code
- Per-line discounts, old-battery exchange deduction, rupee round-off
- Amount in words using the Indian lakh/crore system
- Invoice numbers `CRS/2025-26/0001`, restarting each financial year on 1 April
- Print-ready A4 tax invoice with HSN summary, bank/UPI details and T&C

All tax is computed in **integer paise** and rounded half-up, so CGST + SGST is
guaranteed to equal the total tax exactly, with no floating-point drift.

### Month-over-month trend analysis
The dashboard leads with MoM comparisons: revenue, collections, GST liability
and invoice count, each with a percentage change versus the previous month.

- 6-month billed-vs-collected bar chart and a GST liability trend line
- Sales mix by category, top products, receivables ageing (not due / 1-30 /
  31-60 / 60+ days)
- A 12-month history table in **GST Reports** with per-month change

> A deliberate detail: when the previous month is zero, the change shows **—**
> rather than "+100%". Growth from nothing is undefined, and a fake number on a
> financial dashboard is worse than an honest blank.

### GST reports
GSTR-1 style monthly summary — taxable value, CGST, SGST, IGST, total liability,
B2B vs B2C split, rate-wise (18% vs 28%) contribution and an HSN-wise table.
One-click **CSV export** for your accountant.

### Payment gateways
**Razorpay, Cashfree and PayU** are all wired in. Add credentials to `.env` to go
live; leave them blank and the gateway runs in **simulation mode** so the whole
flow is demonstrable without an account. Simulated payments are labelled as such
in the payment history — they can never be mistaken for real ones.

---

## Going live with payments

```bash
cp .env.example .env
# fill in the keys for the gateway you use, then restart
```

Security decisions baked in, because this handles real money:

1. **Secrets never reach the browser.** Only the publishable key id is exposed
   via `/api/gateways`; the secret/salt stays in the server process.
2. **Amounts are recomputed server-side** from the stored invoice. A tampered
   request cannot pay ₹1 for an ₹18,000 battery — the charge is clamped to the
   real outstanding balance.
3. **Callbacks are signature-verified** (HMAC-SHA256 for Razorpay/Cashfree,
   SHA-512 reverse hash for PayU) using a timing-safe comparison *before* the
   invoice is marked paid. A forged confirmation is rejected.
4. **GST rates always come from the product master**, never from the client
   payload.

These are verified by the test suite and were exercised against a live-mode
server: a forged signature is refused, a correctly signed one is accepted.

---

## Project layout

```
server/
  index.js        Express API — all business rules and validation
  gateways.js     Razorpay / Cashfree / PayU orders + signature verification
  store.js        JSON persistence and demo-history seeding
  data/seed.js    Business details, product catalogue, customers
src/
  lib/gst.js       GST engine: slabs, CGST/SGST/IGST, ₹ formatting, words
  lib/analytics.js MoM trends, ageing, category mix, inventory health
  pages/           Dashboard, Invoices, NewInvoice, InvoiceDetail,
                   Customers, Inventory, Reports
  components/      Reusable UI + dependency-free SVG charts
tests/             25 unit tests (node:test, no framework needed)
```

Charts are hand-rolled SVG rather than a charting library — it keeps the bundle
at ~72 kB gzipped and avoids dependencies that struggle in WebContainer.

---

## Notes & limitations

- Storage is a JSON file (`.data/db.json`). Fine for a single shop counter;
  move to Postgres/SQLite if you need multiple simultaneous terminals.
- There is **no authentication yet** — anyone who can reach the URL can bill.
  Add a login before exposing this beyond your local network.
- "Print / PDF" uses the browser's print dialog (Save as PDF), which keeps the
  invoice pixel-identical to what you see on screen.
