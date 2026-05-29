/**
 * JSS Ablation Runner (RQ2: Component Contribution)
 * ─────────────────────────────────────────────────────────────────────────────
 * Isolates the contribution of:
 *   - adaptive L_ref   (compare P-DARC vs P-DARC-staticL)
 *   - degradation integral  (compare P-DARC vs P-DARC-noI)
 *   - EMA estimator    (compare P-DARC vs P-DARC-noEMA)
 *
 * 30 reps per (scenario × algorithm variant).
 * Same JSS_BASE_SEED as run_experiments_jss.js for CRN consistency.
 *
 * Output: JSS/experiments/results/ablation_jss_30rep.json
 *         JSS/experiments/results/ablation_jss_summary.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  DURATION_S, REPEATS, JSS_BASE_SEED, SCENARIOS, ABLATION_ALGORITHMS,
} from './src/config.js';
import { createAlgorithm }                    from './src/algorithms.js';
import { Simulator }                          from './src/simulator.js';
import { createScenario }                     from './src/scenarios.js';
import { summarizeRun, aggregateRuns, mean }  from './src/metrics.js';
import { setRunSeed }                         from './src/rng.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '..', 'results');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

function runConfig(scenarioName, algoName) {
  const steps = Math.floor((DURATION_S * 1000) / 15);
  const { rates, interferences } = createScenario(scenarioName, steps);
  const rows = [];
  for (let r = 0; r < REPEATS; r++) {
    const rng  = setRunSeed(JSS_BASE_SEED, r);
    const algo = createAlgorithm(algoName);
    const sim  = new Simulator(algo);
    const { metrics, finishedTasks } = sim.run(rates, interferences, rng);
    rows.push(summarizeRun(metrics, finishedTasks, scenarioName));
  }
  return aggregateRuns(rows);
}

function printTable(scenario, ablation) {
  process.stderr.write(`\n=== ${scenario} ===\n`);
  process.stderr.write(`${'Algorithm'.padEnd(22)} ${'p99_mean'.padStart(9)} ${'±std'.padStart(7)} ${'rej%'.padStart(7)} ${'q_max'.padStart(7)}\n`);
  process.stderr.write('─'.repeat(56) + '\n');
  for (const algo of ABLATION_ALGORITHMS) {
    const r = ablation[algo];
    process.stderr.write(
      `${algo.padEnd(22)}` +
      ` ${r.p99.mean.toFixed(1).padStart(9)}` +
      ` ±${r.p99.std.toFixed(1).padEnd(5)}` +
      ` ${(r.reject_rate.mean * 100).toFixed(1).padStart(6)}%` +
      ` ${r.q_max.mean.toFixed(0).padStart(7)}\n`,
    );
  }
}

function gapAnalysis(ablation) {
  const primary = ['interference_heavy', 'erratic'];
  process.stderr.write('\n=== RQ2 Gap Analysis ===\n');
  for (const scen of primary) {
    if (!ablation[scen]) continue;
    const s   = ablation[scen];
    const full = s['P-DARC'];
    const noI  = s['P-DARC-noI'];
    const noL  = s['P-DARC-staticL'];
    const gap_I = noI.p99.mean - full.p99.mean;
    const gap_L = noL.p99.mean - full.p99.mean;
    process.stderr.write(
      `\n[${scen}]\n` +
      `  Integral contribution: +${gap_I.toFixed(1)} ms (${(gap_I / full.p99.mean * 100).toFixed(1)}%)\n` +
      `  L_ref contribution:    +${gap_L.toFixed(1)} ms (${(gap_L / full.p99.mean * 100).toFixed(1)}%)\n`,
    );
  }
}

function main() {
  ensureDir(RESULTS_DIR);

  const ablation = {};
  const totalConfigs = SCENARIOS.length * ABLATION_ALGORITHMS.length;
  let done = 0;
  const t0 = Date.now();

  for (const scen of SCENARIOS) {
    process.stderr.write(`\nScenario: ${scen}\n`);
    ablation[scen] = {};
    for (const algo of ABLATION_ALGORITHMS) {
      process.stderr.write(`  ${algo} ... `);
      ablation[scen][algo] = runConfig(scen, algo);
      done++;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      process.stderr.write(`done (${done}/${totalConfigs}, ${elapsed}s elapsed)\n`);
    }
    printTable(scen, ablation[scen]);
  }

  gapAnalysis(ablation);

  // Build summary (no raw arrays)
  const summary = {};
  for (const scen of SCENARIOS) {
    summary[scen] = {};
    for (const algo of ABLATION_ALGORITHMS) {
      summary[scen][algo] = {};
      for (const [k, v] of Object.entries(ablation[scen][algo])) {
        const { raw: _r, ...rest } = v;
        summary[scen][algo][k] = rest;
      }
    }
  }

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'ablation_jss_30rep.json'),
    JSON.stringify(ablation, null, 2),
  );
  fs.writeFileSync(
    path.join(RESULTS_DIR, 'ablation_jss_summary.json'),
    JSON.stringify(summary, null, 2),
  );

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  process.stderr.write(`\n✓ Ablation done in ${total}s → results/ablation_jss_30rep.json\n`);
}

main();
