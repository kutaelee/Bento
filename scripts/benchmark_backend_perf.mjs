#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.BENCH_BASE_URL ?? 'http://127.0.0.1:18080';
const username = process.env.BENCH_USERNAME ?? 'admin';
const password = process.env.BENCH_PASSWORD ?? 'admin1234!';
const iterations = Number(process.env.BENCH_ITERATIONS ?? '10');
const outputPath = process.env.BENCH_OUTPUT ?? '';

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((sum, value) => sum + value, 0);
  return {
    count: samples.length,
    avg_ms: Number((total / samples.length).toFixed(2)),
    min_ms: Number(sorted[0].toFixed(2)),
    p50_ms: Number(percentile(sorted, 0.5).toFixed(2)),
    p95_ms: Number(percentile(sorted, 0.95).toFixed(2)),
    max_ms: Number(sorted[sorted.length - 1].toFixed(2)),
    total_ms: Number(total.toFixed(2)),
  };
}

async function timedFetch(url, init) {
  const started = performance.now();
  const response = await fetch(url, init);
  const elapsed = performance.now() - started;
  return { response, elapsed };
}

async function login() {
  const { response, elapsed } = await timedFetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`login failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return { tokens: payload.tokens ?? payload, elapsed };
}

async function measureEndpoint(endpoint, token) {
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const { response, elapsed } = await timedFetch(`${baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${endpoint} failed on iteration ${i + 1}: ${response.status} ${text}`);
    }
    await response.text();
    samples.push(elapsed);
  }
  return summarize(samples);
}

async function main() {
  const startedAt = new Date().toISOString();
  const { tokens, elapsed: loginMs } = await login();
  const accessToken = tokens.access_token;
  if (!accessToken) {
    throw new Error('login response missing access_token');
  }

  const endpoints = [
    '/me',
    '/me/preferences',
    '/admin/volumes',
    '/jobs',
  ];

  const results = {};
  for (const endpoint of endpoints) {
    results[endpoint] = await measureEndpoint(endpoint, accessToken);
  }

  const summary = {
    started_at: startedAt,
    base_url: baseUrl,
    iterations,
    login_ms: Number(loginMs.toFixed(2)),
    results,
  };

  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
