/**
 * P-DARC HTTP Server — Real HTTP experiment (v2)
 *
 * Step order matches simulator exactly:
 *   1. Admit / reject pending arrivals using LAST step's nAllow
 *   2. Dequeue (serve up to capacity)
 *   3. algo.update(ctx) → compute nAllow for NEXT step
 *
 * Algorithm implementations imported verbatim from ../nodejs/src/algorithms.js —
 * no duplicate logic, no parameter drift.
 *
 * Interference model: reduced per-step dequeue capacity (no event-loop blocking).
 *   capacity = round(CAPACITY × actualStepS × (1 − iotaNow))
 *
 * Args: --algo <name> --port <n> --out <file.json>
 *       [--interf <ι>] [--interf-start <s>] [--interf-end <s>]
 */

import http from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAlgorithm, StepContext } from '../nodejs/src/algorithms.js';
import { CAPACITY, STEP_MS, STEP_S } from '../nodejs/src/config.js';

// ── CLI args ───────────────────────────────────────────────────────────────────
const argv = {};
for (let i = 2; i < process.argv.length - 1; i += 2)
  argv[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];

const ALGO_NAME    = argv.algo                       || 'P-DARC';
const PORT         = parseInt(argv.port              || '3001');
const OUTFILE      = argv.out                        || '_http_result.json';
const IOTA         = parseFloat(argv.interf          || '0.5');
const INTERF_START = parseFloat(argv['interf-start'] || '20');
const INTERF_END   = parseFloat(argv['interf-end']   || '50');

const DURATION_S = 60;
const WARMUP_S   = 5;

// ── Algorithm (imported, not re-implemented) ───────────────────────────────────
const algo = createAlgorithm(ALGO_NAME);
algo.beginRun();

// ── State ──────────────────────────────────────────────────────────────────────
const pendingArrivals = [];   // arrived but not yet admitted/rejected (batch buffer)
const appQueue        = [];   // admitted tasks waiting to be dequeued

let startWallMs  = null;
let prevTickMs   = null;
let totalArrived = 0, totalRejected = 0;
const allLatenciesMs = [];

// ── Processing + control loop ──────────────────────────────────────────────────
// Step order:  admit-pending  →  dequeue  →  algo.update
// This mirrors the simulator: getNAllow() → arrive → dequeue → update()
const processTimer = setInterval(() => {
  const nowMs = performance.now();
  if (!startWallMs) { prevTickMs = nowMs; return; }

  const t          = (nowMs - startWallMs) / 1000;
  const actualStepS = Math.max((nowMs - prevTickMs) / 1000, STEP_S * 0.5);
  prevTickMs = nowMs;

  // ── 1. Admit / reject pending arrivals (LAST step's nAllow) ───────────────
  const nAllow  = algo.getNAllow();
  const batch   = pendingArrivals.splice(0);
  let nArrStep  = batch.length;
  let nAdmStep  = 0;
  let nRejStep  = 0;

  for (const item of batch) {
    totalArrived++;
    if (nAdmStep < nAllow) {
      nAdmStep++;
      appQueue.push({ res: item.res, arrivalWallMs: item.arrivalWallMs });
    } else {
      nRejStep++;
      totalRejected++;
      item.res.writeHead(503);
      item.res.end('rej');
    }
  }

  // ── 2. Dequeue (serve up to capacity) ─────────────────────────────────────
  const iotaNow  = (t >= INTERF_START && t < INTERF_END) ? IOTA : 0;
  // Use actual elapsed time so capacity estimate is consistent with throughput
  const capacity = Math.max(1, Math.round(CAPACITY * actualStepS * (1 - iotaNow)));

  let nOutStep = 0;
  const completedDelaysStep = [];

  for (let i = 0; i < capacity && appQueue.length > 0; i++) {
    const task  = appQueue.shift();
    const latMs = nowMs - task.arrivalWallMs;
    nOutStep++;
    completedDelaysStep.push(latMs / 1000);
    if (t >= WARMUP_S) allLatenciesMs.push(latMs);
    task.res.writeHead(200);
    task.res.end('ok');
  }

  const avgDelay = completedDelaysStep.length > 0
    ? completedDelaysStep.reduce((a, b) => a + b, 0) / completedDelaysStep.length
    : null;

  // ── 3. Update controller (sets nAllow for NEXT step) ──────────────────────
  const ctx = new StepContext(
    nOutStep,      // nOut
    0,             // tProc — not used by any current algorithm
    appQueue.length, // qlen (post-dequeue, before next admissions — mirrors simulator)
    nArrStep,      // nArrived
    nAdmStep,      // nAdmitted
    nRejStep,      // nRejected
    avgDelay,      // avgDelay (seconds)
    iotaNow,       // interference
    actualStepS,   // stepS (actual elapsed for accurate mu estimate)
  );
  algo.update(ctx);

  if (t >= DURATION_S) finish();
}, STEP_MS);

// ── HTTP server — buffer arrivals, do NOT admit/reject here ───────────────────
const server = http.createServer((req, res) => {
  if (!startWallMs) {
    startWallMs = performance.now();
    prevTickMs  = startWallMs;
  }
  pendingArrivals.push({ res, arrivalWallMs: performance.now() });
});

// ── Finish ─────────────────────────────────────────────────────────────────────
let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  clearInterval(processTimer);

  // Drain pending arrivals and remaining queue with 503
  for (const item of pendingArrivals.splice(0)) {
    totalRejected++;
    item.res.writeHead(503);
    item.res.end('rej');
  }
  for (const task of appQueue.splice(0)) {
    task.res.writeHead(503);
    task.res.end('rej');
  }

  const sorted = [...allLatenciesMs].sort((a, b) => a - b);
  const pct    = (p) => sorted.length > 0 ? sorted[Math.floor(sorted.length * p)] : 0;

  fs.writeFileSync(OUTFILE, JSON.stringify({
    algorithm:   ALGO_NAME,
    iota:        IOTA,
    n_completed: allLatenciesMs.length,
    p50:  pct(0.50),
    p99:  pct(0.99),
    p999: pct(0.999),
    reject_rate: totalRejected / Math.max(1, totalArrived),
  }));

  server.close(() => process.exit(0));
}

server.listen(PORT, () => process.stdout.write('READY\n'));
