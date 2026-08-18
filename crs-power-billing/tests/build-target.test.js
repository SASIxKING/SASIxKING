import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Guards the packaging step.
 *
 * The Android APK and the Windows .exe load their assets from the device with
 * no server. If the wrong build target leaks through, the bundle gets absolute
 * /assets/ URLs and HTTP calls to an API that isn't there — the app launches to
 * a blank screen and the failure is invisible until someone installs it.
 *
 * That exact bug shipped once (a broken cross-env silently produced a web
 * build), so it is now pinned by a test.
 */

function build(script) {
  execFileSync('npm', ['run', script], {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, npm_lifecycle_event: undefined },
  });
  const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
  const assetsDir = path.join(root, 'dist', 'assets');
  const js = fs.readdirSync(assetsDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8'))
    .join('\n');
  return { html, js };
}

test('android build is fully self-contained', () => {
  const { html, js } = build('build:android');

  assert.match(html, /src="\.\/assets\//, 'assets must use relative paths for the WebView');
  assert.doesNotMatch(html, /src="\/assets\//, 'absolute paths break file:// loading');

  assert.ok(js.includes('Insufficient stock'), 'offline business rules must be bundled');
  assert.ok(js.includes('crs-power-db'), 'local storage layer must be bundled');
  assert.ok(!js.includes('fetch(`/api'), 'must not call an HTTP API that will not exist');
});

test('windows build is fully self-contained', () => {
  const { html, js } = build('build:windows');

  assert.match(html, /src="\.\/assets\//);
  assert.ok(js.includes('Insufficient stock'));
  assert.ok(!js.includes('fetch(`/api'));
});

test('web build keeps the HTTP client and absolute paths', () => {
  const { html, js } = build('build');

  assert.match(html, /src="\/assets\//, 'the hosted app is served from the site root');
  assert.ok(js.includes('/api'), 'the web build talks to the API server');
  assert.ok(!js.includes('Insufficient stock'),
    'server-side rules should not be shipped to the browser');
});
