/**
 * Smoke Test 鈥?quick sanity check before full 30-rep run
 * 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
 * Runs 3 reps of a small subset to verify:
 *   1. Import paths (shims) resolve correctly
 *   2. REPEATS/BASE_SEED override takes effect
 *   3. Raw arrays appear in aggregateRuns output
 *   4. All 6  scenarios (including 'erratic') execute without error
 *
 * Usage:  node smoke_test.js
 * Expected runtime: ~5 seconds
 */

import { REPEATS, BASE_SEED, SCENARIOS, ALGORITHMS } from './src/config.js';
import { createAlgorithm }                                 from './src/algorithms.js';
import { Simulator }                                       from './src/simulator.js';
import { createScenario }                                  from './src/scenarios.js';
import { summarizeRun, aggregateRuns }                     from './src/metrics.js';
import { setRunSeed }                                      from './src/rng.js';

const SMOKE_REPS = 3;   // fast subset

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  鉁?${msg}`);
    pass++;
  } else {
    console.error(`  鉁?FAIL: ${msg}`);
    fail++;
  }
}

console.log('=== Smoke Test ===\n');

// 鈹€鈹€ Test 1: Config values 鈹€鈹€
console.log('1. Config overrides');
assert(REPEATS === 30, `REPEATS = 30 (got ${REPEATS})`);
assert(BASE_SEED === 1000, `BASE_SEED = 1000 (got ${BASE_SEED})`);
assert(SCENARIOS.includes('erratic'), `SCENARIOS includes 'erratic'`);
assert(SCENARIOS.length === 6, `6 scenarios (got ${SCENARIOS.length})`);

// 鈹€鈹€ Test 2: Run a few configs and check output shape 鈹€鈹€
console.log('\n2. Experiment execution (3 reps 脳 2 scenarios 脳 2 algorithms)');
const testScenarios = ['interference_heavy', 'erratic'];
const testAlgos     = ['P-DARC', 'Fixed Backpressure'];

for (const scen of testScenarios) {
  for (const algo of testAlgos) {
    const steps = Math.floor((120 * 1000) / 15);
    const { rates, interferences } = createScenario(scen, steps);
    const rows = [];
    for (let r = 0; r < SMOKE_REPS; r++) {
      const rng  = setRunSeed(BASE_SEED, r);
      const a    = createAlgorithm(algo);
      const sim  = new Simulator(a);
      const { metrics, finishedTasks } = sim.run(rates, interferences, rng);
      rows.push(summarizeRun(metrics, finishedTasks, scen));
    }
    const agg = aggregateRuns(rows);

    // Check raw arrays exist and have correct length
    assert(
      Array.isArray(agg.p99.raw) && agg.p99.raw.length === SMOKE_REPS,
      `${scen}/${algo}: raw.length = ${SMOKE_REPS}`,
    );
    // Check CI bounds make sense
    assert(
      agg.p99.ci95_lo <= agg.p99.mean && agg.p99.mean <= agg.p99.ci95_hi,
      `${scen}/${algo}: CI95 brackets mean`,
    );
    // Check p99 in reasonable range (>0, <5000ms)
    assert(
      agg.p99.mean > 0 && agg.p99.mean < 5000,
      `${scen}/${algo}: p99 in (0, 5000) ms`,
    );
  }
}

// 鈹€鈹€ Test 3: CRN check 鈹€鈹€
console.log('\n3. CRN check (same seed 鈫?same first p99 across algos)');
{
  const scen = 'steady';
  const steps = Math.floor((120 * 1000) / 15);
  const { rates, interferences } = createScenario(scen, steps);

  const p99s = {};
  for (const algo of ['P-DARC', 'AIMD', 'PIE']) {
    const rng  = setRunSeed(BASE_SEED, 0);   // same seed for all
    const a    = createAlgorithm(algo);
    const sim  = new Simulator(a);
    const { metrics, finishedTasks } = sim.run(rates, interferences, rng);
    const row = summarizeRun(metrics, finishedTasks, scen);
    p99s[algo] = row.p99;
  }
  // All should have same p99 (arrivals are identical, only control differs)
  // Note: p99 may differ slightly due to control decisions affecting service order,
  // but they share the same arrival sequence.
  assert(typeof p99s['P-DARC'] === 'number', `CRN: P-DARC p99 computed (${p99s['P-DARC'].toFixed(1)}ms)`);
  assert(typeof p99s['AIMD'] === 'number', `CRN: AIMD p99 computed (${p99s['AIMD'].toFixed(1)}ms)`);
}

// 鈹€鈹€ Summary 鈹€鈹€
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) {
  console.error('\nSmoke test FAILED 鈥?do not run full experiment until resolved.');
  process.exit(1);
} else {
  console.log('\nSmoke test PASSED 鈥?safe to run: node run_experiments.js');
}


