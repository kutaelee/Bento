import fs from 'node:fs';
import os from 'node:os';

const QOS_PROFILE = 'BALANCED';

// SSOT: x-constants.qos (openapi/openapi.yaml)
const QOS_THRESHOLDS = {
  cpu_percent_soft: 50.0,
  cpu_percent_hard: 70.0,
  iowait_percent_soft: 5.0,
  iowait_percent_hard: 10.0,
  api_p95_ms_soft: 300.0,
  api_p95_ms_hard: 800.0,
  mem_available_bytes_soft: 536_870_912,
};

const QOS_BACKGROUND = {
  bg_worker_concurrency_min: 0,
  bg_worker_concurrency_default: 1,
  bg_worker_concurrency_cap_max: 4,
};

const QOS_THUMBNAIL = {
  enqueue_rps_default: 1.0,
  enqueue_rps_cap_max: 5.0,
  worker_concurrency_default: 1,
};

const API_LATENCY_SAMPLE_LIMIT = 200;
const CPU_SAMPLE_DELAY_MS = 120;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clampLatencySample(value) {
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return clampNumber(value, 0, Number.MAX_SAFE_INTEGER);
}

function computePercentile(samples, percentile) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentile) - 1;
  const safeIndex = clampNumber(index, 0, sorted.length - 1);
  return sorted[safeIndex];
}

function readProcLine(pathname, prefix) {
  try {
    const text = fs.readFileSync(pathname, 'utf8');
    const line = text.split('\n').find((row) => row.startsWith(prefix));
    return line || null;
  } catch {
    return null;
  }
}

function parseCpuStatLine(line) {
  if (!line) return null;
  const parts = line.trim().split(/\s+/).slice(1).map((value) => Number(value));
  if (parts.length < 5 || parts.some((value) => Number.isNaN(value))) {
    return null;
  }
  const [user, nice, system, idle, iowait, irq, softirq, steal] = parts;
  const idleAll = idle + iowait;
  const total = parts.reduce((sum, value) => sum + value, 0);
  return {
    total,
    idle: idleAll,
    iowait: Number.isFinite(iowait) ? iowait : 0,
  };
}

function readCpuTimes() {
  const line = readProcLine('/proc/stat', 'cpu ');
  if (!line) return null;
  return parseCpuStatLine(line);
}

async function sampleCpuPercents() {
  const first = readCpuTimes();
  if (!first) {
    return { cpuPercent: 0, iowaitPercent: 0 };
  }
  await sleep(CPU_SAMPLE_DELAY_MS);
  const second = readCpuTimes();
  if (!second) {
    return { cpuPercent: 0, iowaitPercent: 0 };
  }

  const totalDelta = second.total - first.total;
  if (totalDelta <= 0) {
    return { cpuPercent: 0, iowaitPercent: 0 };
  }

  const idleDelta = second.idle - first.idle;
  const iowaitDelta = second.iowait - first.iowait;

  const cpuPercent = clampNumber((1 - idleDelta / totalDelta) * 100, 0, 100);
  const iowaitPercent = clampNumber((iowaitDelta / totalDelta) * 100, 0, 100);

  return { cpuPercent, iowaitPercent };
}

function readMemAvailableBytes() {
  const line = readProcLine('/proc/meminfo', 'MemAvailable:');
  if (!line) {
    return os.freemem();
  }
  const parts = line.split(/\s+/);
  const kib = Number(parts[1]);
  if (Number.isNaN(kib)) {
    return os.freemem();
  }
  return kib * 1024;
}

function evaluatePressure(pressure) {
  const reasons = [];
  let soft = false;
  let hard = false;

  if (pressure.cpu_percent >= QOS_THRESHOLDS.cpu_percent_hard) {
    hard = true;
    reasons.push(`cpu ${pressure.cpu_percent.toFixed(1)}% >= ${QOS_THRESHOLDS.cpu_percent_hard}%`);
  } else if (pressure.cpu_percent >= QOS_THRESHOLDS.cpu_percent_soft) {
    soft = true;
    reasons.push(`cpu ${pressure.cpu_percent.toFixed(1)}% >= ${QOS_THRESHOLDS.cpu_percent_soft}%`);
  }

  if (pressure.iowait_percent >= QOS_THRESHOLDS.iowait_percent_hard) {
    hard = true;
    reasons.push(`iowait ${pressure.iowait_percent.toFixed(1)}% >= ${QOS_THRESHOLDS.iowait_percent_hard}%`);
  } else if (pressure.iowait_percent >= QOS_THRESHOLDS.iowait_percent_soft) {
    soft = true;
    reasons.push(`iowait ${pressure.iowait_percent.toFixed(1)}% >= ${QOS_THRESHOLDS.iowait_percent_soft}%`);
  }

  if (pressure.api_p95_ms >= QOS_THRESHOLDS.api_p95_ms_hard) {
    hard = true;
    reasons.push(`api_p95 ${pressure.api_p95_ms.toFixed(1)}ms >= ${QOS_THRESHOLDS.api_p95_ms_hard}ms`);
  } else if (pressure.api_p95_ms >= QOS_THRESHOLDS.api_p95_ms_soft) {
    soft = true;
    reasons.push(`api_p95 ${pressure.api_p95_ms.toFixed(1)}ms >= ${QOS_THRESHOLDS.api_p95_ms_soft}ms`);
  }

  if (pressure.mem_available_bytes <= QOS_THRESHOLDS.mem_available_bytes_soft) {
    soft = true;
    reasons.push(`mem_available ${pressure.mem_available_bytes} <= ${QOS_THRESHOLDS.mem_available_bytes_soft}`);
  }

  const level = hard ? 'hard' : soft ? 'soft' : 'idle';
  return { level, reasons };
}

function adjustAllowed(current, level) {
  let nextBg = current.bg_worker_concurrency;

  if (level === 'hard') {
    nextBg = QOS_BACKGROUND.bg_worker_concurrency_min;
  } else if (level === 'soft') {
    nextBg = clampNumber(
      current.bg_worker_concurrency - 1,
      QOS_BACKGROUND.bg_worker_concurrency_min,
      QOS_BACKGROUND.bg_worker_concurrency_cap_max
    );
  } else {
    nextBg = clampNumber(
      current.bg_worker_concurrency + 1,
      QOS_BACKGROUND.bg_worker_concurrency_min,
      QOS_BACKGROUND.bg_worker_concurrency_cap_max
    );
  }

  return {
    bg_worker_concurrency: nextBg,
    thumbnail_rps: current.thumbnail_rps,
    transcode_concurrency: current.transcode_concurrency,
  };
}

export function createQosController() {
  let currentAllowed = {
    bg_worker_concurrency: QOS_BACKGROUND.bg_worker_concurrency_default,
    thumbnail_rps: QOS_THUMBNAIL.enqueue_rps_default,
    transcode_concurrency: 0,
  };
  const apiLatencySamples = [];

  function recordApiLatencyMs(value) {
    const sample = clampLatencySample(value);
    if (sample === null) return;
    apiLatencySamples.push(sample);
    if (apiLatencySamples.length > API_LATENCY_SAMPLE_LIMIT) {
      apiLatencySamples.shift();
    }
  }

  function getApiP95Ms() {
    if (apiLatencySamples.length < 5) {
      return 0;
    }
    const p95 = computePercentile(apiLatencySamples, 0.95);
    return Number(p95.toFixed(2));
  }

  return {
    recordApiLatencyMs,
    async sampleState() {
      const { cpuPercent, iowaitPercent } = await sampleCpuPercents();
      const pressure = {
        cpu_percent: Number(cpuPercent.toFixed(2)),
        iowait_percent: Number(iowaitPercent.toFixed(2)),
        mem_available_bytes: readMemAvailableBytes(),
        api_p95_ms: getApiP95Ms(),
      };

      const { level, reasons } = evaluatePressure(pressure);
      currentAllowed = adjustAllowed(currentAllowed, level);

      const notes = [
        `level=${level}`,
        reasons.length > 0 ? `reasons=${reasons.join(', ')}` : 'reasons=none',
      ].join(' | ');

      return {
        profile: QOS_PROFILE,
        limits: {
          bg_worker_concurrency_max: QOS_BACKGROUND.bg_worker_concurrency_cap_max,
          thumbnail_rps_max: QOS_THUMBNAIL.enqueue_rps_cap_max,
          transcode_concurrency_max: 0,
        },
        pressure,
        allowed: {
          bg_worker_concurrency: currentAllowed.bg_worker_concurrency,
          thumbnail_rps: currentAllowed.thumbnail_rps,
          transcode_concurrency: currentAllowed.transcode_concurrency,
          notes,
        },
      };
    },
  };
}
