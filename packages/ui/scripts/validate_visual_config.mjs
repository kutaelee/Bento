import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..', '..');
const configPath = path.join(rootDir, 'packages/ui/visual-regression.config.json');
const routeMapPath = path.join(rootDir, 'design/stitch/ko-kr_final/inventory/route_reference_map.md');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const routes = config.routes;
if (!Array.isArray(routes) || routes.length === 0) {
  fail('invalid-config:routes-empty');
}

const routeMapLines = fs.readFileSync(routeMapPath, 'utf8').split('\n');
let inside = false;
const routeMap = {};

for (const line of routeMapLines) {
  if (!line.trim().startsWith('|')) continue;
  const cols = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((col) => col.trim());
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

const requiredRoutes = new Set(['/files', '/login', '/admin']);
const seen = new Set();

for (const route of routes) {
  if (!route || typeof route !== 'object') fail('invalid-route');
  const routePath = route.path;
  const states = route.states;
  const seed = route.seed;
  const baseline = route.baseline;

  if (typeof routePath !== 'string' || !routePath) fail('invalid-path');
  if (!Array.isArray(states) || states.length === 0) fail(`missing-states:${routePath}`);
  if (typeof seed !== 'string' || !seed) fail(`missing-seed:${routePath}`);
  if (!baseline || typeof baseline !== 'object') fail(`missing-baseline:${routePath}`);
  if (!['reference', 'derived'].includes(baseline.mode)) fail(`invalid-baseline-mode:${routePath}`);
  if (!routeMap[routePath]) fail(`route-not-in-map:${routePath}`);

  const mapping = routeMap[routePath];
  const refScreen = (mapping.refScreen || '').trim();
  const derived = (mapping.derived || '').trim();
  const hasReference = !['', 'none', 'n/a', 'na', 'null'].includes(refScreen.toLowerCase());

  if (hasReference) {
    if (baseline.mode !== 'reference') fail(`baseline-mode-mismatch:${routePath}`);
    if (baseline.screen !== refScreen) fail(`reference-screen-mismatch:${routePath}`);
    if (!fs.existsSync(path.join(rootDir, refScreen))) fail(`reference-screen-missing:${routePath}`);
  } else {
    if (baseline.mode !== 'derived') fail(`baseline-mode-mismatch:${routePath}`);
    if (baseline.derived !== derived) fail(`derived-link-mismatch:${routePath}`);
  }

  seen.add(routePath);
}

const missingRequired = [...requiredRoutes].filter((route) => !seen.has(route));
if (missingRequired.length) {
  fail(`missing-required-routes:${missingRequired.join(',')}`);
}

const referenceRequired = Object.entries(routeMap)
  .filter(([, entry]) => !['', 'none', 'n/a', 'na', 'null'].includes((entry.refScreen || '').trim().toLowerCase()))
  .map(([route]) => route);
const missingReference = referenceRequired.filter((route) => !seen.has(route));
if (missingReference.length) {
  fail(`missing-reference-routes:${missingReference.join(',')}`);
}

for (const routePath of ['/files', '/admin', '/login']) {
  const entry = routes.find((route) => route.path === routePath);
  if (!entry) continue;
  const states = new Set(entry.states || []);
  if (routePath === '/files' && ['loading', 'empty', 'error'].some((state) => !states.has(state))) {
    fail('files-missing-state');
  }
  if (routePath === '/admin' && !states.has('forbidden')) {
    fail('admin-missing-forbidden-state');
  }
}

console.log('ok: visual config + route map validated');
