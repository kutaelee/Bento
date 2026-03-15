#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const beforePath = process.env.BENCH_BEFORE ?? 'C:\\codex\\Bento\\artifacts\\perf\\backend-before.json';
const afterPath = process.env.BENCH_AFTER ?? 'C:\\codex\\Bento\\artifacts\\perf\\backend-after-container-fix.json';
const markdownPath = process.env.BENCH_DIFF_MD ?? 'C:\\codex\\Bento\\artifacts\\perf\\backend-diff.md';
const jsonPath = process.env.BENCH_DIFF_JSON ?? 'C:\\codex\\Bento\\artifacts\\perf\\backend-diff.json';

function round(value) {
  return Number(value.toFixed(2));
}

function formatSeconds(ms) {
  return `${round(ms / 1000)}s`;
}

function compareEndpoint(name, before, after) {
  const deltaTotal = before.total_ms - after.total_ms;
  const deltaAvg = before.avg_ms - after.avg_ms;
  const improvement = before.total_ms > 0
    ? ((deltaTotal / before.total_ms) * 100)
    : 0;

  return {
    endpoint: name,
    before_total_ms: round(before.total_ms),
    after_total_ms: round(after.total_ms),
    saved_total_ms: round(deltaTotal),
    before_avg_ms: round(before.avg_ms),
    after_avg_ms: round(after.avg_ms),
    saved_avg_ms: round(deltaAvg),
    improvement_pct: round(improvement),
  };
}

async function main() {
  const before = JSON.parse(await fs.readFile(beforePath, 'utf8'));
  const after = JSON.parse(await fs.readFile(afterPath, 'utf8'));

  const endpoints = Object.keys(before.results);
  const compared = endpoints.map((endpoint) =>
    compareEndpoint(endpoint, before.results[endpoint], after.results[endpoint]),
  );

  const totals = compared.reduce((acc, row) => {
    acc.before_total_ms += row.before_total_ms;
    acc.after_total_ms += row.after_total_ms;
    acc.saved_total_ms += row.saved_total_ms;
    return acc;
  }, {
    before_total_ms: 0,
    after_total_ms: 0,
    saved_total_ms: 0,
  });

  totals.before_total_ms = round(totals.before_total_ms);
  totals.after_total_ms = round(totals.after_total_ms);
  totals.saved_total_ms = round(totals.saved_total_ms);
  totals.improvement_pct = totals.before_total_ms > 0
    ? round((totals.saved_total_ms / totals.before_total_ms) * 100)
    : 0;

  const summary = {
    compared_at: new Date().toISOString(),
    before_path: beforePath,
    after_path: afterPath,
    endpoints: compared,
    totals,
  };

  const lines = [
    '# Backend Performance Diff',
    '',
    `- Before: \`${beforePath}\``,
    `- After: \`${afterPath}\``,
    `- Total saved across benchmarked authenticated GETs: **${formatSeconds(totals.saved_total_ms)}** (${totals.improvement_pct}%)`,
    '',
    '| Endpoint | Before total | After total | Saved | Before avg | After avg | Improvement |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...compared.map((row) =>
      `| \`${row.endpoint}\` | ${formatSeconds(row.before_total_ms)} | ${formatSeconds(row.after_total_ms)} | ${formatSeconds(row.saved_total_ms)} | ${row.before_avg_ms}ms | ${row.after_avg_ms}ms | ${row.improvement_pct}% |`
    ),
    '',
  ];

  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.writeFile(markdownPath, `${lines.join('\n')}\n`);
  await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
