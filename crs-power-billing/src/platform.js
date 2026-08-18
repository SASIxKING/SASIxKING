/**
 * Platform integration for the packaged builds.
 *
 * Everything here degrades gracefully: on the web these are no-ops, so the
 * React components can call them unconditionally.
 */

import { APP_TARGET, IS_EMBEDDED } from './api.js';

export const isElectron = () => Boolean(globalThis.electronAPI);
export const isCapacitor = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());

export function platformLabel() {
  if (isElectron()) return 'Windows desktop';
  if (isCapacitor()) return 'Android';
  if (IS_EMBEDDED) return 'Offline app';
  return 'Web';
}

/** Subscribe to the Electron menu's navigation events. Returns an unsubscribe. */
export function onDesktopNavigate(handler) {
  if (!isElectron()) return () => {};
  return globalThis.electronAPI.onNavigate(handler) || (() => {});
}

export function onDesktopBackupRequest(handler) {
  if (!isElectron()) return () => {};
  return globalThis.electronAPI.onRequestBackup(handler) || (() => {});
}

export function onDesktopRestore(handler) {
  if (!isElectron()) return () => {};
  return globalThis.electronAPI.onRestoreBackup(handler) || (() => {});
}

/**
 * Save a backup. On Windows this opens a native save dialog through the
 * preload bridge; elsewhere it falls back to a browser download.
 */
export async function saveBackupFile(data) {
  const json = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);

  if (isElectron()) {
    const result = await globalThis.electronAPI.saveBackup(json);
    return result?.saved
      ? { saved: true, message: `Backup saved to ${result.filePath}` }
      : { saved: false, message: 'Backup cancelled' };
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CRS-Power-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { saved: true, message: 'Backup downloaded' };
}

export async function appInfo() {
  if (isElectron()) {
    try {
      return await globalThis.electronAPI.appInfo();
    } catch {
      /* fall through */
    }
  }
  return { version: '1.0.0', platform: APP_TARGET, dataPath: 'device storage' };
}
