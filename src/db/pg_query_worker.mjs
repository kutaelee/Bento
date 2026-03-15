import fs from 'node:fs';
import { workerData } from 'node:worker_threads';
import pg from 'pg';

const { Client } = pg;

function writeState(value) {
  const view = new Int32Array(workerData.stateBuffer);
  Atomics.store(view, 0, value);
  Atomics.notify(view, 0, 1);
}

function normalizeResult(result) {
  const results = Array.isArray(result) ? result : [result];
  const lines = [];

  for (const entry of results) {
    if (!entry || !Array.isArray(entry.rows) || entry.rows.length === 0) {
      continue;
    }
    for (const row of entry.rows) {
      const firstKey = Object.keys(row)[0];
      const value = firstKey ? row[firstKey] : '';
      if (value === null || value === undefined) {
        lines.push('');
      } else if (typeof value === 'object') {
        lines.push(JSON.stringify(value));
      } else {
        lines.push(String(value));
      }
    }
  }

  return lines.join('\n');
}

(async () => {
  const client = new Client(workerData.connectionConfig);

  try {
    await client.connect();
    const result = await client.query(workerData.query);
    fs.writeFileSync(workerData.resultPath, normalizeResult(result), 'utf8');
    writeState(1);
  } catch (error) {
    fs.writeFileSync(
      workerData.errorPath,
      String(error && error.message ? error.message : error),
      'utf8',
    );
    writeState(2);
  } finally {
    try {
      await client.end();
    } catch (_) {
      // ignore close failure
    }
  }
})();
