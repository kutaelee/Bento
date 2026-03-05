import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import net from 'net';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');
const configPath = path.join(rootDir, 'packages/ui/visual-regression.config.json');
const routeMapPath = path.join(rootDir, 'design/stitch/ko-kr_final/inventory/route_reference_map.md');
const requiredRoutes = new Set(['/files', '/login', '/admin']);
const VISUAL_NODE_ID = process.env.VISUAL_NODE_ID || '11111111-1111-1111-1111-111111111111';
const VISUAL_SEARCH_QUERY = process.env.VISUAL_SEARCH_QUERY || '프로젝트';
const VISUAL_INVITE_TOKEN = process.env.VISUAL_INVITE_TOKEN || 'visual-invite-token';
const resolveRoutePath = (routePath) => routePath.replace(/:nodeId/g, VISUAL_NODE_ID);

const DIFF_MODE = process.env.VISUAL_DIFF_MODE || 'structure';
// structure: assert key UI regions exist; do not pixel-diff
// pixel: pixel-diff only for allowlisted routes that are reference-ready
const PIXEL_DIFF_ALLOWLIST = new Set((process.env.VISUAL_PIXEL_ALLOWLIST || '/files').split(',').map(s => s.trim()).filter(Boolean));
const MAX_DIFF_RATIO = Number(process.env.VISUAL_MAX_DIFF_RATIO || '0.02');

// P26-T2: Prevent accidental baseline updates. Reference images should not change
// inside a PR unless an explicit approval flag is set.
const ALLOW_BASELINE_UPDATE = process.env.VISUAL_ALLOW_BASELINE_UPDATE === '1';

function enforceBaselineLock() {
  if (!process.env.CI) return;
  if (DIFF_MODE != 'pixel') return;
  if (ALLOW_BASELINE_UPDATE) return;

  try {
    // Detect PRs that modify reference assets (e.g. screen.png) without an explicit flag.
    // Use origin/main...HEAD so the check works in PR contexts.
    const out = execSync('git diff --name-only origin/main...HEAD -- design/stitch/ko-kr_final', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const changed = out.split('\n').map(s => s.trim()).filter(Boolean);
    const refChanges = changed.filter(f => /screen\.png$/i.test(f));
    if (refChanges.length) {
      fail('baseline-update-blocked:' + refChanges.join(','));
    }
  } catch (err) {
    // If git diff fails (e.g. shallow checkout), do not silently skip.
    fail('baseline-lock-check-failed');
  }
}


function fail(message) {
  console.error(message);
  process.exit(1);
}

function loadConfig() {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const routes = config.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    fail('invalid-config:routes-empty');
  }
  return routes;
}

function parseRouteMap() {
  const lines = fs.readFileSync(routeMapPath, 'utf8').split('\n');
  const routeMap = {};
  let inside = false;
  for (const line of lines) {
    if (!line.trim().startsWith('|')) continue;
    const cols = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    if (cols[0]?.toLowerCase() === 'route') {
      inside = true;
      continue;
    }
    if (!inside || cols.length < 4) continue;
    const route = cols[0];
    if (!route || !route.startsWith('/')) continue;
    routeMap[route] = {
      refScreen: cols[2],
      derived: cols[3],
    };
  }
  if (!Object.keys(routeMap).length) {
    fail('invalid-map:empty');
  }
  return routeMap;
}

function validateRoutes(routes, routeMap) {
  const seen = new Set();
  routes.forEach((r, idx) => {
    if (!r || typeof r !== 'object') fail(`invalid-route:${idx + 1}`);
    const p = r.path;
    const states = r.states;
    const seed = r.seed;
    const baseline = r.baseline;
    if (typeof p !== 'string' || !p) fail(`invalid-path:${idx + 1}`);
    if (!Array.isArray(states) || states.length === 0) fail(`missing-states:${p}`);
    if (typeof seed !== 'string' || !seed) fail(`missing-seed:${p}`);
    if (!baseline || typeof baseline !== 'object') fail(`missing-baseline:${p}`);
    const mode = baseline.mode;
    if (!['reference', 'derived'].includes(mode)) fail(`invalid-baseline-mode:${p}`);
    if (!routeMap[p]) fail(`route-not-in-map:${p}`);

    const mapping = routeMap[p];
    const refScreen = (mapping.refScreen || '').trim();
    const derived = (mapping.derived || '').trim();
    const hasReference = !['', 'none', 'n/a', 'na', 'null'].includes(refScreen.toLowerCase());

    if (hasReference) {
      if (mode !== 'reference') fail(`baseline-mode-mismatch:${p}`);
      if (baseline.screen !== refScreen) fail(`reference-screen-mismatch:${p}`);
      const refPath = path.join(rootDir, refScreen);
      if (!fs.existsSync(refPath)) fail(`reference-screen-missing:${p}`);
    } else {
      if (mode !== 'derived') fail(`baseline-mode-mismatch:${p}`);
      if (baseline.derived !== derived) fail(`derived-link-mismatch:${p}`);
    }

    seen.add(p);
  });

  const missing = [...requiredRoutes].filter(r => !seen.has(r));
  if (missing.length) fail('missing-required-routes:' + missing.join(','));

  for (const p of ['/files', '/admin', '/login']) {
    const entry = routes.find(r => r.path === p);
    if (!entry) continue;
    const states = new Set(entry.states || []);
    if (p === '/files' && ['loading', 'empty', 'error'].some(s => !states.has(s))) {
      fail('files-missing-state');
    }
    if (p === '/admin' && !states.has('forbidden')) {
      fail('admin-missing-forbidden-state');
    }
  }
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch (err) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 500));
  }
  fail('dev-server-timeout');
}


function readPng(filePath) {
  const data = fs.readFileSync(filePath);
  return PNG.sync.read(data);
}

async function run() {

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('port-discovery-failed')));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

  enforceBaselineLock();
  const routes = loadConfig();
  const routeMap = parseRouteMap();
  validateRoutes(routes, routeMap);

  const port = await getFreePort();
  const devLogs = { out: [], err: [] };

  const devProc = spawn('pnpm', ['-C', 'packages/ui', 'dev', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none', VISUAL_FIXTURES: '1', VITE_DISABLE_PROXY: '1' },
  });

  const pushLog = (arr, chunk) => {
    const text = chunk.toString('utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      arr.push(line);
      if (arr.length > 200) arr.shift();
    }
  };

  devProc.stdout?.on('data', (c) => pushLog(devLogs.out, c));
  devProc.stderr?.on('data', (c) => pushLog(devLogs.err, c));

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl + '/');

  const browser = await chromium.launch({
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-font-subpixel-positioning',
    ],
  });

  // Stabilize rendering across runners:
  // - fixed locale/timezone
  // - reduced motion
  // - deterministic screenshots (no animations/transitions)
  const context = await browser.newContext({
    locale: process.env.VISUAL_LOCALE || 'ko-KR',
    timezoneId: process.env.VISUAL_TIMEZONE || 'UTC',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  const pageLogs = [];
  page.on('console', (msg) => {
    try {
      pageLogs.push(`[console:${msg.type()}] ${msg.text()}`);
      if (pageLogs.length > 200) pageLogs.shift();
    } catch (_) {}
  });
  page.on('pageerror', (err) => {
    try {
      pageLogs.push(`[pageerror] ${err?.message || String(err)}`);
      if (pageLogs.length > 200) pageLogs.shift();
    } catch (_) {}
  });

  // Ensure /files route is treated as authenticated.
  // The UI checks presence of tokens; for visual structure gate we do not need a real backend session.
  const accessToken = process.env.VISUAL_ACCESS_TOKEN || 'visual-dummy-access-token';
  const refreshToken = process.env.VISUAL_REFRESH_TOKEN || 'visual-dummy-refresh-token';
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('nd.access_token', t.accessToken);
      window.localStorage.setItem('nd.refresh_token', t.refreshToken);
      window.localStorage.setItem('ui.appearance.theme', 'dark');
    } catch (_) {}

    // Disable animations/transitions for deterministic screenshots.
    const inject = () => {
      try {
        const style = document.createElement('style');
        style.setAttribute('data-visual-stabilize', '1');
        style.textContent = `*{animation:none !important; transition:none !important; caret-color: transparent !important;}`;
        (document.head || document.documentElement).appendChild(style);
        try { document.documentElement.classList.add('dark'); document.documentElement.dataset.theme = 'dark'; } catch (_) {}
      } catch (_) {}
    };
    if (document.head || document.documentElement) {
      inject();
    } else {
      window.addEventListener('DOMContentLoaded', inject, { once: true });
    }
  }, { accessToken, refreshToken });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-gate-'));
  const errors = [];
  const diffSummary = [];

  for (const route of routes) {
    const { path: routePath, states, seed, baseline } = route;
    let viewport = { width: 1440, height: 900 };

    if (baseline.mode === 'reference') {
      const refPath = path.join(rootDir, baseline.screen);
      const refPng = readPng(refPath);
      viewport = { width: refPng.width, height: refPng.height };
    }

    await page.setViewportSize(viewport);

    for (const state of states) {
      const actualPath = resolveRoutePath(routePath);
      const url = new URL(baseUrl + actualPath);
      if (routePath === '/search') {
        url.searchParams.set('q', VISUAL_SEARCH_QUERY);
      }
      if (routePath === '/invite/accept') {
        url.searchParams.set('token', VISUAL_INVITE_TOKEN);
      }
      url.searchParams.set('visualState', state);
      url.searchParams.set('seed', seed);
      url.searchParams.set('visualFixtures', '1');

      try {
        await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
        // Give the client app time to render deterministically.
        await page.waitForSelector('#root', { state: 'attached', timeout: 15000 }).catch(() => {});
        if (routePath === '/files') {
          // For /files, wait for the AppShell frame (except loading state).
          if (state !== 'loading') {
            await page.waitForSelector('header,aside', { state: 'attached', timeout: 15000 }).catch(() => {});
          }
        }
        if ((routePath === '/files' || routePath.startsWith('/files/')) && state !== 'loading') {
          // Wait for the Files page content to finish initial data render; otherwise pixel-diff
          // can capture a loading/skeleton frame that diverges heavily from reference.
          await page.waitForSelector('.files-view__table,.files-view__name', { state: 'attached', timeout: 15000 }).catch(() => {});
        }
        await page.waitForTimeout(800);
        const snapshotKey = actualPath;
        const screenshotPath = path.join(tmpDir, snapshotKey.replace(/\//g, '_').replace(/^_/, '') + `__${state}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // STRUCTURE CHECK (SSOT): Topbar-first 레이아웃은 AppShell(/files 등)에서만 강제한다.
        // /login 같은 auth 화면은 AppShell을 갖지 않으므로 구조 게이트에서 제외.
        const shouldCheckStructure = (routePath === '/files' || routePath.startsWith('/files')) && state !== 'loading';
        if (shouldCheckStructure) {
          const structure = await page.evaluate(() => {
            const topbar = document.querySelector('header,[data-ui=topbar],[aria-label="Topbar"]');
            const left = document.querySelector('aside,[data-ui=leftnav],[aria-label="Folder Tree"]');
            const inspector = document.querySelector('[data-ui=inspector],aside[aria-label="Inspector"],.nd-detail-inspector');
            const main = document.querySelector('main,[role="main"]');
            const breadcrumb = document.querySelector('nav[aria-label="breadcrumb"],[aria-label="breadcrumb"]');
            const actionable = document.querySelector('button,[role="button"],a[href],input,select,textarea');
            return {
              hasTopbar: !!topbar,
              hasLeft: !!left,
              hasInspector: !!inspector,
              hasMain: !!main,
              hasBreadcrumb: !!breadcrumb,
              hasActionable: !!actionable,
            };
          });
          if (!structure.hasTopbar || !structure.hasLeft) {
            errors.push(`${routePath}:${state}:structure-missing(topbar=${structure.hasTopbar},left=${structure.hasLeft})`);
          }
          if (!structure.hasMain || !structure.hasBreadcrumb || !structure.hasActionable) {
            errors.push(`${routePath}:${state}:basic-a11y-missing(main=${structure.hasMain},breadcrumb=${structure.hasBreadcrumb},actionable=${structure.hasActionable})`);
          }
        }

        const allowlisted = PIXEL_DIFF_ALLOWLIST.has(routePath)
          // Back-compat: treating '/files' as the File Explorer family allowlists /files/:nodeId as well.
          || (routePath === '/files/:nodeId' && PIXEL_DIFF_ALLOWLIST.has('/files'));
        const shouldPixelDiff = DIFF_MODE === 'pixel'
          && baseline.mode === 'reference'
          && allowlisted
          // Avoid pixel-diffing synthetic /files states (loading/empty/error) against the reference screen.
          && (routePath !== '/files' || state === 'default');
        if (shouldPixelDiff) {
          const refPath = path.join(rootDir, baseline.screen);
          const shot = readPng(screenshotPath);
          const ref = readPng(refPath);
          if (shot.width !== ref.width || shot.height !== ref.height) {
            errors.push(`${routePath}:${state}:size-mismatch`);
            continue;
          }
          const diff = new PNG({ width: shot.width, height: shot.height });
          const diffPixels = pixelmatch(shot.data, ref.data, diff.data, shot.width, shot.height, {
            threshold: 0.1,
            includeAA: true,
          });
          const ratio = diffPixels / (shot.width * shot.height);
          diffSummary.push(`${routePath}:${state}:diffRatio=${ratio.toFixed(4)}`);
          if (ratio > MAX_DIFF_RATIO) {
            errors.push(`${routePath}:${state}:diff-too-high(${ratio.toFixed(4)})`);
          }
        }
      } catch (err) {
        errors.push(`${routePath}:${state}:error:${err.message}`);
      }
    }
  }

  await browser.close();

  // Best-effort cleanup: ensure dev server does not keep the Node event loop alive.
  try {
    devProc.kill('SIGTERM');
  } catch (_) {}

  const waitExit = () => new Promise((resolve) => {
    devProc.once('exit', resolve);
    devProc.once('close', resolve);
  });

  // Give it a moment to exit gracefully; then force-kill.
  await Promise.race([
    waitExit(),
    new Promise((r) => setTimeout(r, 1500)),
  ]);

  if (!devProc.killed) {
    try {
      devProc.kill('SIGKILL');
    } catch (_) {}
  }

  try {
    devProc.stdout?.destroy();
    devProc.stderr?.destroy();
  } catch (_) {}

  if (diffSummary.length) {
    console.log('[visual-diff] ' + diffSummary.join(' | '));
  }


  if (errors.length) {
    try {
      const tail = (arr, n=40) => arr.slice(Math.max(0, arr.length-n));
      const lines = [];
      lines.push('[visual-debug] dev.stdout.tail=' + JSON.stringify(tail(devLogs.out)));
      lines.push('[visual-debug] dev.stderr.tail=' + JSON.stringify(tail(devLogs.err)));
      lines.push('[visual-debug] page.logs.tail=' + JSON.stringify(tail(pageLogs)));
      console.log(lines.join('\n'));
    } catch (_) {}
  }
  if (errors.length) {
    fail('visual-gate-failed:' + errors.join(','));
  }

  console.log('[visual-regression] ok');
}

run().catch(err => {
  console.error('fatal:' + err.message);
  process.exit(1);
});
