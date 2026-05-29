/**
 * JSS Main Experiment Runner
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs 30 independent repetitions per (scenario × algorithm) configuration.
 * Outputs raw per-run data for downstream Mann-Whitney U / Cliff's δ analysis.
 *
 * Usage:
 *   node run_experiments_jss.js
 *
 * Output files (JSS/experiments/results/):
 *   results_jss_30rep.json     — full results with raw arrays
 *   results_jss_summary.json   — aggregated stats only (compatible with paper_v2 format)
 *   <scenario>_jss.csv         — per-scenario CSV with mean/std/median/CI95
 *   run_meta_jss.json          — experiment metadata
 *
 * Key differences from paper_v2/run_experiments.js:
 *   - REPEATS = 30 (was 10)
 *   - JSS_BASE_SEED = 1000 (was 42; avoids seed overlap)
 *   - 'erratic' scenario added to SCENARIOS
 *   - Raw per-run values stored for statistical testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  STEP_MS, DURATION_S, WARMUP_S,
  REPEATS, JSS_BASE_SEED, CAPACITY, D_REF,
  N_MIN, N_MAX, NOMINAL_N_PER_STEP, LAMBDA_MAX, L_REF_STATIC,
  PDARC_ALPHA, PDARC_BETA, PDARC_GAMMA, PDARC_GAMMA_REF,
  PDARC_THETA, PDARC_GAMMA_I, PDARC_RHO, PDARC_GAMMA_Q, PDARC_RHO_Q,
  SCENARIOS, ALGORITHMS,
} from './src/config.js';
import { createAlgorithm }              from './src/algorithms.js';
import { Simulator }                    from './src/simulator.js';
import { createScenario }               from './src/scenarios.js';
import { summarizeRun, aggregateRuns, toCsv } from './src/metrics.js';
import { setRunSeed }                   from './src/rng.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '..', 'results');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

// ── Metadata ─────────────────────────────────────────────────────────────────

function buildMeta() {
  return {
    experiment:  'JSS 30-repetition main study',
    platform:    'Node.js SED discrete-step simulator (paper-aligned v2)',
    runtime:     process.version,
    timestamp:   new Date().toISOString(),
    repeats:     REPEATS,
    base_seed:   JSS_BASE_SEED,
    crn_note:    'Same repeatIndex uses same Poisson seed across algorithms (CRN)',
    T_step_ms:   STEP_MS,
    D_ref_s:     D_REF,
    capacity:    CAPACITY,
    duration_s:  DURATION_S,
    warmup_s:    WARMUP_S,
    N_min:       N_MIN,
    N_max:       N_MAX,
    scenarios:   SCENARIOS,
    algorithms:  ALGORITHMS,
    pdarc_params: {
      alpha: PDARC_ALPHA, beta: PDARC_BETA, gamma: PDARC_GAMMA,
      gamma_ref: PDARC_GAMMA_REF, theta: PDARC_THETA,
      gamma_I: PDARC_GAMMA_I, rho: PDARC_RHO,
      gamma_Q: PDARC_GAMMA_Q, rho_Q: PDARC_RHO_Q,
    },
  };
}

// ── Core runner ───────────────────────────────────────────────────────────────

/**
 * Run REPEATS trials of one (scenario, algorithm) combination.
 * Returns aggregated stats with embedded raw arrays.
 * @throws {Error} If experiment fails
 */
function runExperiment(scenarioName, algoName) {
  try {
    const steps = Math.floor((DURATION_S * 1000) / STEP_MS);
    const { rates, interferences } = createScenario(scenarioName, steps);

    if (!Array.isArray(rates) || !Array.isArray(interferences)) {
      throw new Error('createScenario failed to return rates/interferences arrays');
    }

    const rows = [];

    for (let r = 0; r < REPEATS; r++) {
      try {
        const rng  = setRunSeed(JSS_BASE_SEED, r);   // CRN: same arrival pattern across algos
        const algo = createAlgorithm(algoName);
        const sim  = new Simulator(algo);
        const { metrics, finishedTasks } = sim.run(rates, interferences, rng);
        rows.push(summarizeRun(metrics, finishedTasks, scenarioName));
      } catch (err) {
        throw new Error(`Rep ${r}: ${err.message}`);
      }
    }

    if (rows.length !== REPEATS) {
      throw new Error(`Expected ${REPEATS} results, got ${rows.length}`);
    }

    return aggregateRuns(rows);   // includes .raw arrays for Mann-Whitney U
  } catch (err) {
    throw new Error(`${scenarioName}/${algoName}: ${err.message}`);
  }
}

// ── Progress & display ────────────────────────────────────────────────────────

function formatElapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printRow(label, r) {
  process.stdout.write(
    `  ${label.padEnd(22)} p99=${r.p99.mean.toFixed(1).padStart(7)}ms` +
    ` ±${r.p99.std.toFixed(1).padEnd(5)} | rej=${(r.reject_rate.mean * 100).toFixed(1)}%` +
    ` | CI95=[${r.p99.ci95_lo.toFixed(1)}, ${r.p99.ci95_hi.toFixed(1)}]\n`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  try {
    ensureDir(RESULTS_DIR);

    const totalConfigs = SCENARIOS.length * ALGORITHMS.length;
    let done = 0;
    const t0 = Date.now();

    const results = {};

    for (const scen of SCENARIOS) {
      results[scen] = {};
      console.log(`\n╔══ Scenario: ${scen} (${REPEATS} reps each) ══`);

      for (const algo of ALGORITHMS) {
        const t1 = Date.now();
        process.stdout.write(`  Running ${algo} ... `);
        try {
          results[scen][algo] = runExperiment(scen, algo);
        } catch (err) {
          console.error(`\n✗ FAILED: ${err.message}`);
          process.exit(1);
        }
        done++;
        const elapsed = Date.now() - t1;
        const totalElapsed = Date.now() - t0;
        const eta = (totalElapsed / done) * (totalConfigs - done);
        process.stdout.write(`done [${formatElapsed(elapsed)}] (${done}/${totalConfigs}, ETA ${formatElapsed(eta)})\n`);
      }

      console.log(`╠── Summary:`);
      for (const algo of ALGORITHMS) {
        printRow(algo, results[scen][algo]);
      }
    }

    // ── Build summary (without raw arrays, for compactness) ──
    const summary = {};
    for (const scen of SCENARIOS) {
      summary[scen] = {};
      for (const algo of ALGORITHMS) {
        summary[scen][algo] = {};
        for (const [k, v] of Object.entries(results[scen][algo])) {
          const { raw: _raw, ...rest } = v;   // strip raw for summary file
          summary[scen][algo][k] = rest;
        }
      }
    }

    // ── Write outputs ──
    try {
      fs.writeFileSync(
        path.join(RESULTS_DIR, 'run_meta_jss.json'),
        JSON.stringify(buildMeta(), null, 2),
      );
      fs.writeFileSync(
        path.join(RESULTS_DIR, 'results_jss_30rep.json'),
        JSON.stringify(results, null, 2),
      );
      fs.writeFileSync(
        path.join(RESULTS_DIR, 'results_jss_summary.json'),
        JSON.stringify(summary, null, 2),
      );
      for (const scen of SCENARIOS) {
        fs.writeFileSync(
          path.join(RESULTS_DIR, `${scen}_jss.csv`),
          toCsv(scen, results, ALGORITHMS),
        );
      }
    } catch (err) {
      console.error(`✗ Failed to write output files: ${err.message}`);
      process.exit(1);
    }

    const totalTime = formatElapsed(Date.now() - t0);
    console.log(`\n✓ Done in ${totalTime}. Results → JSS/experiments/results/`);
    console.log('  Next step: python analysis/statistical_tests.py');
  } catch (err) {
    console.error(`✗ Experiment failed: ${err.message}`);
    process.exit(1);
  }
}

main();
