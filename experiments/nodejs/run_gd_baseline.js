/**
 * GradientDescent Baseline Experiment Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs 30 reps of GradientDescent across 6 primary + 2 extended scenarios.
 * Uses CRN (same seed per rep index across algorithms) for fair comparison.
 * Saves to results_gd_baseline.json.
 *
 * Usage: node run_gd_baseline.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  STEP_MS, DURATION_S, WARMUP_S,
  REPEATS, JSS_BASE_SEED, CAPACITY,
  SCENARIOS,
} from './src/config.js';
import { createAlgorithm } from './src/algorithms.js';
import { Simulator }       from './src/simulator.js';
import { createScenario }  from './src/scenarios.js';
import { summarizeRun, aggregateRuns } from './src/metrics.js';
import { setRunSeed }      from './src/rng.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '..', 'results');

const ALL_SCENARIOS = [...SCENARIOS, 'io_mixed', 'trace_like'];
const ALGO_NAME     = 'GradientDescent';
const steps         = Math.floor((DURATION_S * 1000) / STEP_MS);

console.log(`\nP-DARC GradientDescent Baseline`);
console.log(`Scenarios: ${ALL_SCENARIOS.join(', ')}`);
console.log(`Reps: ${REPEATS}  |  Base seed: ${JSS_BASE_SEED}\n`);

const allResults = {};

for (const scenario of ALL_SCENARIOS) {
  const rows = [];
  process.stdout.write(`  ${scenario.padEnd(22)}`);

  const { rates, interferences } = createScenario(scenario, steps);

  for (let r = 0; r < REPEATS; r++) {
    const rng  = setRunSeed(JSS_BASE_SEED, r);  // CRN: same arrivals across algorithms
    const algo = createAlgorithm(ALGO_NAME);
    const sim  = new Simulator(algo, {
      capacityPerSec: CAPACITY, stepMs: STEP_MS,
      durationS: DURATION_S, warmupS: WARMUP_S,
    });
    const { metrics, finishedTasks } = sim.run(rates, interferences, rng);
    rows.push(summarizeRun(metrics, finishedTasks, scenario));
  }

  const agg = aggregateRuns(rows);
  allResults[scenario] = { algorithm: ALGO_NAME, scenario, ...agg };
  process.stdout.write(
    `p99=${agg.p99.mean.toFixed(1)}±${agg.p99.std.toFixed(1)}ms` +
    `  rej=${(agg.reject_rate.mean * 100).toFixed(1)}%` +
    `  Lmax=${agg.q_max.mean.toFixed(0)}\n`
  );
}

const outPath = path.join(RESULTS_DIR, 'results_gd_baseline.json');
fs.writeFileSync(outPath, JSON.stringify({
  meta: { algorithm: ALGO_NAME, repeats: REPEATS, base_seed: JSS_BASE_SEED, timestamp: new Date().toISOString() },
  results: allResults,
}, null, 2));
console.log(`\nSaved: ${outPath}`);
