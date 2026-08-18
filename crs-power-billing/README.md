# C.R.S Power Solution — Billing & Inventory

Billing, inventory and GST software for **C.R.S Power Solution**
No.16, ECR Main Road, Pillaichavady, Pondicherry – 605014.

Runs as **three applications from one codebase**:

| Platform | How it runs | Data |
|---|---|---|
| **Web** | React app + Express API | on the server |
| **Android** (APK) | Capacitor WebView, fully offline | on the device |
| **Windows** (.exe) | Electron desktop app, fully offline | on the PC |

The Android and Windows builds need **no server and no internet**. They embed the
same business core the API uses, so an invoice created offline on a shop tablet is
validated exactly as strictly as one created through the web API.

---

## Quick start (web)

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. One command runs the API (8787) and the web app
(5173); Vite proxies `/api`, so the browser only uses relative URLs.

```bash
npm test          # 43 unit tests over the money, inventory and analytics rules
npm run build     # production web bundle
```

## Getting the app files (APK + Windows installer)

Both installers are produced by GitHub Actions — nothing to install on your
machine:

```bash
cd crs-power-billing
./build-apps.sh --ci
```

That enables the workflow, commits and pushes it. About 5–8 minutes later, open
[the Actions tab](https://github.com/SASIxKING/SASIxKING/actions), click the
finished run and download from **Artifacts**:

| Artifact | Contains | Use |
|---|---|---|
| **CRS-Power-Billing-Android** | `app-release.apk`, `app-debug.apk` | install on the phone/tablet |
| **CRS-Power-Billing-Windows** | `CRS-Power-Billing-Setup-1.0.0.exe`, portable `.exe` | install on the shop PC |

> The workflow sits in `ci/build-apps.yml` rather than `.github/workflows/`
> because the automation account that created this branch is blocked from
> writing there. The command above just moves it. You can equally create the
> file by hand in the GitHub web UI and paste the contents in.

### Saving the APK to the phone

1. Download **CRS-Power-Billing-Android** on the phone (or copy it across by
   USB/WhatsApp). The zip contains `app-release.apk`.
2. Unzip and tap `app-release.apk`.
3. Android will ask to allow installs from that app (Chrome / Files) — allow it,
   then tap **Install**.
4. Open **CRS Power Billing**. It works with mobile data and Wi-Fi switched off;
   the invoices live on the phone.

The APK is signed with a key generated during the build, which is fine for
sideloading. For the Play Store, or to keep upgrades installing over the top of
each other, generate your own keystore once and store it as repository secrets.

### Installing on Windows

Run `CRS-Power-Billing-Setup-1.0.0.exe` and follow the prompts (it installs per
user, so no admin rights are needed). SmartScreen may warn that the publisher is
unknown — that is expected for an unsigned app; choose **More info ▸ Run anyway**.
A code-signing certificate removes that warning.

Prefer no installation? Use the portable `.exe` straight from a pen drive.

### Building locally instead

```bash
./build-apps.sh android     # needs JDK 17 + Android SDK
./build-apps.sh windows     # must be run ON Windows (or Linux + wine)
./build-apps.sh web         # hosted version
```

### Desktop development

```bash
npm run desktop:dev     # Electron pointed at the Vite dev server, with hot reload
npm run android:open    # opens the generated project in Android Studio
```

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

## How one codebase serves three platforms

```
src/core/service.js     ← every business rule lives here, once
      │
      ├── server/index.js   Express wraps it        → Web
      └── src/api.js        called in-process       → Android + Windows
```

`src/core/service.js` owns GST slabs, stock checks, payment limits and invoice
numbering. The web API is a thin HTTP layer over it; the packaged apps call it
directly against device storage through the same `read()/write()` adapter
interface (`src/core/storage.js`).

This matters for correctness: **if the rules were duplicated, the offline app
would drift and become the weak link.** A parity test runs identical hostile
payloads through both paths and asserts byte-identical responses — it has
already caught a real bug (a 500% discount produced a negative invoice).

The build target is selected at compile time, and the two bundles are mutually
exclusive: the embedded build contains **zero** `/api` calls, and the web build
contains none of the offline storage code.

## Notes & limitations

- **Each install is independent.** The Android tablet, the Windows PC and the
  web server each keep their own data — there is no sync between them. Use
  **Backup ▸ Save backup file** to move data across, and pick one device as the
  book of record. Multi-device sync would need a shared hosted database.
- **Take backups.** On the packaged apps the data lives only on that device, so
  a lost or wiped device means lost invoices. The Backup screen says this plainly
  and Windows has File ▸ Backup (Ctrl+S).
- **Online payment collection needs the hosted version.** Razorpay/Cashfree/PayU
  confirmations are verified with a server-side secret; a packaged app has no
  safe place to keep one, so it would be security theatre. The offline apps
  record Cash/UPI/Card receipts manually instead, and the "Collect online"
  button is hidden there rather than failing mysteriously.
- **No authentication yet** — anyone who can open the app can bill. Add a login
  before putting the web version on a public network.
- Storage is JSON (file on the server, localStorage on device). Fine for a single
  counter; move to Postgres/SQLite for many simultaneous terminals.
- "Print / PDF" uses the system print dialog (Save as PDF), keeping the invoice
  pixel-identical to the screen.
