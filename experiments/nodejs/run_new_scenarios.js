/**
 * New-Scenario Runner 鈥? Revision (R1/R2 Response)
 * 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
 * Runs io_mixed and trace_like scenarios, 30 reps each.
 * Outputs to /experiments/results/ without touching existing result files.
 *
 * Usage:
 *   node run_new_scenarios.js
 *
 * Output files:
 *   results_new_scenarios.json    鈥?aggregated stats + raw arrays
 *   io_mixed.csv              鈥?per-algorithm CSV
 *   trace_like.csv            鈥?per-algorithm CSV
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  STEP_MS, DURATION_S, WARMUP_S,
  REPEATS, _BASE_SEED, CAPACITY, D_REF,
  N_MIN, N_MAX, NOMINAL_N_PER_STEP, LAMBDA_MAX, L_REF_STATIC,
  PDARC_ALPHA, PDARC_BETA, PDARC_GAMMA, PDARC_GAMMA_REF,
  PDARC_THETA, PDARC_GAMMA_I, PDARC_RHO, PDARC_GAMMA_Q, PDARC_RHO_Q,
  ALGORITHMS,
} from './src/config.js';
import { createAlgorithm }              from './src/algorithms.js';
import { Simulator }                    from './src/simulator.js';
import { createScenario }               from './src/scenarios.js';
import { summarizeRun, aggregateRuns, toCsv } from './src/metrics.js';
import { setRunSeed }                   from './src/rng.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '..', 'results');

const NEW_SCENARIOS = ['io_mixed', 'trace_like'];

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function runExperiment(scenarioName, algoName) {
  const steps = Math.floor((DURATION_S * 1000) / STEP_MS);
  const { rates, interferences } = createScenario(scenarioName, steps);
  const rows = [];

  for (let r = 0; r < REPEATS; r++) {
    const rng  = setRunSeed(_BASE_SEED, r);
    const algo = createAlgorithm(algoName);
    const sim  = new Simulator(algo);
    const { metrics, finishedTasks } = sim.run(rates, interferences, rng);
    rows.push(summarizeRun(metrics, finishedTasks, scenarioName));
  }

  return aggregateRuns(rows);
}

function formatElapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printRow(label, r) {
  process.stdout.write(
    `  ${label.padEnd(22)} p99=${r.p99.mean.toFixed(1).padStart(7)}ms` +
    ` 卤${r.p99.std.toFixed(1).padEnd(5)} | L_max=${r.q_max.mean.toFixed(0).padStart(4)}` +
    ` | rej=${(r.reject_rate.mean * 100).toFixed(1).padStart(5)}%` +
    ` | CI95=[${r.p99.ci95_lo.toFixed(1)}, ${r.p99.ci95_hi.toFixed(1)}]\n`,
  );
}

function main() {
  ensureDir(RESULTS_DIR);

  const totalConfigs = NEW_SCENARIOS.length * ALGORITHMS.length;
  let done = 0;
  const t0 = Date.now();

  const results = {};

  for (const scen of NEW_SCENARIOS) {
    results[scen] = {};
    console.log(`\n鈺斺晲鈺?Scenario: ${scen} (${REPEATS} reps each) 鈺愨晲`);

    for (const algo of ALGORITHMS) {
      const t1 = Date.now();
      process.stdout.write(`  Running ${algo} ... `);
      results[scen][algo] = runExperiment(scen, algo);
      done++;
      const elapsed = Date.now() - t1;
      const totalElapsed = Date.now() - t0;
      const eta = (totalElapsed / done) * (totalConfigs - done);
      process.stdout.write(`done [${formatElapsed(elapsed)}] (${done}/${totalConfigs}, ETA ${formatElapsed(eta)})\n`);
    }

    console.log(`鈺犫攢鈹€ Summary (p99 | L_max | rej%):`);
    for (const algo of ALGORITHMS) {
      printRow(algo, results[scen][algo]);
    }
  }

  // Strip raw arrays for summary JSON
  const summary = {};
  for (const scen of NEW_SCENARIOS) {
    summary[scen] = {};
    for (const algo of ALGORITHMS) {
      summary[scen][algo] = {};
      for (const [k, v] of Object.entries(results[scen][algo])) {
        const { raw: _raw, ...rest } = v;
        summary[scen][algo][k] = rest;
      }
    }
  }

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'results_new_scenarios.json'),
    JSON.stringify(summary, null, 2),
  );

  for (const scen of NEW_SCENARIOS) {
    fs.writeFileSync(
      path.join(RESULTS_DIR, `${scen}.csv`),
      toCsv(scen, results, ALGORITHMS),
    );
  }

  const totalTime = formatElapsed(Date.now() - t0);
  console.log(`\n鉁?Done in ${totalTime}. Results 鈫?/experiments/results/`);
}

main();

