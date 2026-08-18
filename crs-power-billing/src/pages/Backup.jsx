import React, { useEffect, useRef, useState } from 'react';
import { api, APP_TARGET, IS_EMBEDDED } from '../api.js';
import { appInfo, platformLabel, saveBackupFile } from '../platform.js';
import { Field, ErrorBanner } from '../components/ui.jsx';

/**
 * Backup / restore, and a plain-language explanation of where the shop's data
 * actually lives. On the packaged builds this is the most important screen in
 * the app: there is no server, so the only protection against a lost or broken
 * device is the user taking backups.
 */
export default function Backup({ data, refresh, notify }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  useEffect(() => { appInfo().then(setInfo); }, []);

  const counts = {
    invoices: data.invoices.length,
    customers: data.customers.length,
    products: data.products.length,
  };

  async function doBackup() {
    setBusy(true); setError('');
    try {
      const snapshot = await api.exportAll();
      const result = await saveBackupFile(snapshot);
      if (result.saved) notify(result.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function doRestore(file) {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const summary = await api.importAll(payload);
      await refresh();
      notify(`Restored ${summary.invoices} invoices, ${summary.customers} customers`);
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? 'That file is not a valid backup (could not read it as JSON).'
          : err.message,
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function doReset() {
    const warning = IS_EMBEDDED
      ? 'This erases every invoice, customer and product on this device and restores the sample data. Take a backup first. Continue?'
      : 'This resets the demo data on the server. Continue?';
    if (!window.confirm(warning)) return;
    setBusy(true); setError('');
    try {
      await api.reset();
      await refresh();
      notify('Data reset to the starting sample');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ErrorBanner message={error} />

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Where your data is stored</h2>
        <p className="mt-2 text-sm text-slate-600">
          {IS_EMBEDDED ? (
            <>
              This copy runs <strong>completely offline</strong> on this {platformLabel().toLowerCase()}.
              Every invoice is saved on this device only — nothing is sent to a server, and the app
              keeps working with no internet. The flip side is that{' '}
              <strong>if the device is lost, reset or damaged, the data goes with it</strong>, so
              take a backup regularly and keep it somewhere else.
            </>
          ) : (
            <>
              This copy talks to the C.R.S Power Solution server, which holds the invoices and
              stock. Backups let you keep an off-server copy or move the data into the Android or
              Windows app.
            </>
          )}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Invoices" value={counts.invoices} />
          <Stat label="Customers" value={counts.customers} />
          <Stat label="Products" value={counts.products} />
          <Stat label="Platform" value={platformLabel()} small />
        </dl>

        {info?.dataPath && info.dataPath !== 'device storage' ? (
          <p className="mt-3 break-all text-xs text-slate-400">
            Data folder: {info.dataPath}
          </p>
        ) : null}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Backup</h2>
        <p className="mt-1 text-sm text-slate-600">
          Saves everything — invoices, customers, stock and settings — into a single{' '}
          <code className="rounded bg-slate-100 px-1">.json</code> file. Keep it on a pen drive or
          email it to yourself.
        </p>
        <button type="button" className="btn-primary mt-3" onClick={doBackup} disabled={busy}>
          {busy ? 'Working…' : 'Save backup file'}
        </button>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Restore</h2>
        <p className="mt-1 text-sm text-slate-600">
          Loads a backup file. <strong className="text-rose-600">This replaces everything</strong>{' '}
          currently in the app, so back up first if the current data matters.
        </p>
        <Field label="Backup file">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="input"
            disabled={busy}
            onChange={(e) => doRestore(e.target.files?.[0])}
          />
        </Field>
      </div>

      <div className="card border-rose-200 p-5">
        <h2 className="text-sm font-semibold text-rose-700">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-600">
          Wipe everything and go back to the sample catalogue and demo history.
        </p>
        <button type="button" className="btn-danger mt-3" onClick={doReset} disabled={busy}>
          Reset all data
        </button>
      </div>

      <p className="pb-4 text-center text-xs text-slate-400">
        {info ? `Version ${info.version} · ${APP_TARGET}` : null}
      </p>
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-bold text-ink ${small ? 'text-sm' : 'text-lg tnum'}`}>{value}</dd>
    </div>
  );
}
