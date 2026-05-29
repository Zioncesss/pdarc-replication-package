/**
 * JSS metrics module — extended from paper_v2 baseline
 *
 * Key additions vs original:
 *   - median() and medianAbsoluteDeviation() for robust location/spread reporting
 *   - confidenceInterval95() for normal-approximation 95% CI
 *   - aggregateRuns() now returns per-metric raw arrays (needed for Mann-Whitney U)
 *   - summarizeRun() unchanged (same per-run metrics as before)
 */
import { DURATION_S, WARMUP_S } from './config.js';

// ── Basic statistics ──────────────────────────────────────────────────────────

export function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function std(arr) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
}

export function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function medianAbsoluteDeviation(arr) {
  if (arr.length === 0) return 0;
  const med = median(arr);
  return median(arr.map((v) => Math.abs(v - med)));
}

/**
 * 95% confidence interval via normal approximation (mean ± 1.96·SE).
 * Valid when n ≥ 30 (CLT applies). Returns [lo, hi].
 */
export function confidenceInterval95(arr) {
  if (arr.length === 0) return [0, 0];
  const m = mean(arr);
  const se = std(arr) / Math.sqrt(arr.length);
  return [m - 1.96 * se, m + 1.96 * se];
}

export function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Recovery time ─────────────────────────────────────────────────────────────

export function calculateRecoveryTime(timeArr, qlenArr, endEventTime = 80) {
  const before = [];
  for (let i = 0; i < timeArr.length; i++) {
    if (timeArr[i] >= 30 && timeArr[i] < 40) before.push(qlenArr[i]);
  }
  const baselineQ = before.length ? mean(before) : 0;
  const targetQ = Math.max(10, baselineQ * 1.5);

  for (let i = 0; i < timeArr.length; i++) {
    if (timeArr[i] >= endEventTime && qlenArr[i] <= targetQ) {
      return timeArr[i] - endEventTime;
    }
  }
  return DURATION_S - endEventTime;
}

// ── Per-run summary (unchanged from original) ─────────────────────────────────

export function summarizeRun(metrics, finishedTasks, scenario) {
  const delaysMs = finishedTasks.map((d) => d * 1000);
  const maskIdx = metrics.time.map((t, i) => (t >= WARMUP_S ? i : -1)).filter((i) => i >= 0);

  const qValid  = maskIdx.map((i) => metrics.qlen[i]);
  const tpValid = maskIdx.map((i) => metrics.throughput[i]);
  const rej     = maskIdx.map((i) => metrics.nRejected[i]);
  const arr     = maskIdx.map((i) => metrics.nAdmitted[i] + metrics.nRejected[i]);

  let recoveryTime = 0;
  if (['step_burst', 'interference_light', 'interference_heavy'].includes(scenario)) {
    recoveryTime = calculateRecoveryTime(metrics.time, metrics.qlen);
  }

  const totalRej  = rej.reduce((a, b) => a + b, 0);
  const totalArr  = arr.reduce((a, b) => a + b, 0);
  const rejectRate = totalArr > 0 ? totalRej / totalArr : 0;

  return {
    q_mean:       mean(qValid),
    q_max:        qValid.length ? Math.max(...qValid) : 0,
    p50:          percentile(delaysMs, 50),
    p95:          percentile(delaysMs, 95),
    p99:          percentile(delaysMs, 99),
    p999:         percentile(delaysMs, 99.9),
    d_mean:       mean(delaysMs),
    tp_mean:      mean(tpValid),
    tp_std:       std(tpValid),
    reject_rate:  rejectRate,
    recovery_time: recoveryTime,
  };
}

// ── Multi-run aggregation (extended for JSS) ──────────────────────────────────

/**
 * Aggregate 30 per-run summaries into location/spread estimates.
 *
 * JSS extension: each metric now returns a full statistics object including
 * raw values for downstream Mann-Whitney U testing.
 *
 * Output schema per metric:
 * {
 *   mean, std,              // original: primary summary
 *   median, mad,            // robust alternatives
 *   ci95_lo, ci95_hi,       // 95% confidence interval (normal approx, valid at n=30)
 *   raw: number[],          // ALL per-run values (for statistical tests)
 * }
 */
export function aggregateRuns(rows) {
  const keys = Object.keys(rows[0]);
  const agg = {};
  for (const k of keys) {
    const vals = rows.map((r) => r[k]);
    const m    = mean(vals);
    const s    = std(vals);
    const med  = median(vals);
    const mad  = medianAbsoluteDeviation(vals);
    const [ci_lo, ci_hi] = confidenceInterval95(vals);
    agg[k] = {
      mean:    m,
      std:     s,
      median:  med,
      mad:     mad,
      ci95_lo: ci_lo,
      ci95_hi: ci_hi,
      raw:     vals,
    };
  }
  return agg;
}

// ── CSV export (backward compatible) ─────────────────────────────────────────

export function toCsv(scenario, results, algorithms) {
  const header = ['Algorithm'];
  const metricKeys = Object.keys(results[scenario][algorithms[0]]);
  for (const k of metricKeys) {
    header.push(`${k}_mean`, `${k}_std`, `${k}_median`, `${k}_ci95_lo`, `${k}_ci95_hi`);
  }
  const lines = [header.join(',')];
  for (const algo of algorithms) {
    const row = [algo];
    for (const k of metricKeys) {
      const r = results[scenario][algo][k];
      row.push(
        String(r.mean), String(r.std),
        String(r.median), String(r.ci95_lo), String(r.ci95_hi),
      );
    }
    lines.push(row.join(','));
  }
  return lines.join('\n');
}
