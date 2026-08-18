/**
 * Storage adapters. Each satisfies the same contract:
 *
 *   read()      -> the database object
 *   write(db)   -> persist it
 *
 * Because the service layer only talks to this interface, the identical
 * business rules run on a Node server, an Android tablet and a Windows PC.
 */

import { freshDatabase, migrate } from './database.js';

/**
 * Browser / WebView storage (Android + Windows packaged apps, and the web
 * app when it runs in offline mode).
 *
 * Writes are synchronous to localStorage, which keeps the service layer simple
 * and is comfortably fast for a single shop's data. A write failure (quota
 * exceeded) is surfaced rather than silently swallowed, because losing an
 * invoice without telling the shopkeeper would be unforgivable.
 */
export function createLocalStorageAdapter({ key = 'crs-power-db', storage = globalThis.localStorage } = {}) {
  let cache = null;

  function read() {
    if (cache) return cache;
    try {
      const raw = storage.getItem(key);
      cache = raw ? migrate(JSON.parse(raw)) : freshDatabase();
    } catch (err) {
      console.warn('[storage] could not parse saved data, starting fresh:', err.message);
      cache = freshDatabase();
    }
    if (!storage.getItem(key)) write(cache);
    return cache;
  }

  function write(db) {
    cache = db;
    try {
      storage.setItem(key, JSON.stringify(db));
    } catch (err) {
      const message =
        err?.name === 'QuotaExceededError'
          ? 'Device storage is full. Export a backup and remove old data.'
          : `Could not save data: ${err.message}`;
      throw new Error(message);
    }
    return db;
  }

  function reset({ withDemoData = true } = {}) {
    return write(freshDatabase({ withDemoData }));
  }

  return { read, write, reset };
}

/** In-memory adapter — used by the test suite. */
export function createMemoryAdapter(initial) {
  let db = initial || freshDatabase();
  return {
    read: () => db,
    write: (next) => { db = next; return db; },
    reset: ({ withDemoData = true } = {}) => { db = freshDatabase({ withDemoData }); return db; },
  };
}
