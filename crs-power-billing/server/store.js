/**
 * Node file-system storage adapter.
 *
 * Implements the same read()/write() contract as the browser adapter in
 * src/core/storage.js, so the shared service layer behaves identically whether
 * it is running behind Express or inside the packaged desktop/mobile app.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshDatabase, migrate } from '../src/core/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CRS_DATA_DIR || path.join(__dirname, '..', '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let cache = null;

function persist(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Write to a temp file then rename, so an interrupted write cannot corrupt
  // the shop's live data.
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  return db;
}

export function createFileAdapter() {
  return {
    read() {
      if (cache) return cache;
      try {
        if (fs.existsSync(DB_FILE)) {
          cache = migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
          return cache;
        }
      } catch (err) {
        console.warn('[store] could not read db.json, reseeding:', err.message);
      }
      cache = freshDatabase();
      persist(cache);
      return cache;
    },
    write(db) {
      cache = db;
      return persist(db);
    },
    reset({ withDemoData = true } = {}) {
      cache = freshDatabase({ withDemoData });
      return persist(cache);
    },
  };
}
