/**
 * HTTP Experiment Orchestrator
 * ─────────────────────────────────────────────────────────────────────────────
 * For each algorithm × 15 reps:
 *   1. Spawn http_server.js as child process (ephemeral port)
 *   2. Wait for "READY" on stdout
 *   3. Send HTTP requests at 800 req/s for DURATION_S seconds (inline load gen)
 *   4. Wait for server to write results file and exit
 *   5. Collect per-rep results
 * Aggregates to results_http_experiment.json.
 *
 * Usage: node run_http_exp.js
 */

import http from 'http';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(__dirname, '..', 'results');
const SERVER_PATH = path.join(__dirname, 'http_server.js');

// ── Experiment parameters ────────────────────────────────────────────────────
const DURATION_S = 60;
const WARMUP_S   = 5;
const LOAD_RATE  = 800;    // req/s
const REPEATS    = 15;
const IOTA       = 0.50;
const ALGORITHMS = ['Fixed Backpressure', 'AIMD', 'PIE', 'GradientDescent', 'P-DARC'];
let basePort     = 13000;

// ── Stats helpers ─────────────────────────────────────────────────────────────
function mean(arr)   { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, arr.length - 1));
}
function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length * p)] ?? 0;
}

// ── Load generator (batched for Windows 15ms timer resolution) ────────────────
const TICK_MS = 15;
const BATCH   = Math.round(LOAD_RATE * TICK_MS / 1000);  // 12 req/tick
const agent   = new http.Agent({ keepAlive: true, maxSockets: 300 });

function runLoadGenerator(port, durationS) {
  return new Promise((resolve) => {
    const latencies = [];
    let rejected    = 0;
    let total       = 0;
    let stopped     = false;
    const startMs   = performance.now();

    const timer = setInterval(() => {
      if (stopped) return;
      const t = (performance.now() - startMs) / 1000;
      if (t >= durationS) {
        stopped = true;
        clearInterval(timer);
        resolve({ latencies, rejected, total });
        return;
      }

      for (let i = 0; i < BATCH; i++) {
        const reqStart = performance.now();
        total++;
        const req = http.request(
          { hostname: '127.0.0.1', port, path: '/', method: 'GET', agent },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => {
              const latMs = performance.now() - reqStart;
              const t2 = (performance.now() - startMs) / 1000;
              if (t2 >= WARMUP_S) {
                if (res.statusCode === 200) latencies.push(latMs);
                else rejected++;
              }
            });
          }
        );
        req.on('error', () => {
          // Count connection errors (ECONNRESET after server close, etc.)
          // Only within the measurement window so post-server-close bursts
          // don't inflate the rate.
          const t2 = (performance.now() - startMs) / 1000;
          if (t2 >= WARMUP_S && t2 < DURATION_S) rejected++;
        });
        req.end();
      }
    }, TICK_MS);
  });
}

// ── Single run ────────────────────────────────────────────────────────────────
function waitForReady(proc) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    proc.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('READY')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
}

async function runOnce(algoName, port, outFile) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      SERVER_PATH,
      '--algo',         algoName,
      '--port',         String(port),
      '--out',          outFile,
      '--interf',       String(IOTA),
      '--interf-start', '20',
      '--interf-end',   '50',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) process.stderr.write(`[${algoName}] ${msg}\n`);
    });

    waitForReady(proc).then(async () => {
      // Small delay to ensure server is fully ready
      await new Promise(r => setTimeout(r, 200));

      const { latencies, rejected, total } = await runLoadGenerator(port, DURATION_S + 2);

      // Wait for server to finish and write results
      // Generous 10s timeout: server needs to drain queue and write JSON
      await new Promise((res) => {
        const t = setTimeout(() => {
          proc.kill();
          res();
        }, 10000);
        proc.on('exit', () => { clearTimeout(t); res(); });
      });

      // Read server-side result
      let serverResult = {};
      try { serverResult = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch {}

      // Use client-side latencies (more accurate for end-to-end latency)
      resolve({
        client_p99:    pct(latencies, 0.99),
        client_p50:    pct(latencies, 0.50),
        client_rej:    rejected / Math.max(1, total),
        client_n:      latencies.length,
        server_p99:    serverResult.p99   ?? 0,
        server_rej:    serverResult.reject_rate ?? 0,
      });
    }).catch((err) => {
      proc.kill();
      reject(err);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
const allResults = {};

console.log('\nP-DARC JSS — HTTP Real-Request Experiment');
console.log(`Algorithms: ${ALGORITHMS.join(', ')}`);
console.log(`Reps: ${REPEATS} | Rate: ${LOAD_RATE} req/s | Duration: ${DURATION_S}s | ι=${IOTA}\n`);

for (const algo of ALGORITHMS) {
  const rows = [];
  process.stdout.write(`  ${algo.padEnd(22)}`);

  for (let r = 0; r < REPEATS; r++) {
    const port    = basePort++;
    const outFile = path.join(RESULTS_DIR, `_http_tmp_${algo.replace(/\s/g, '_')}_${r}.json`);
    try {
      const result = await runOnce(algo, port, outFile);
      rows.push(result);
      process.stdout.write('.');
    } catch (e) {
      process.stderr.write(`\n  [WARN] rep ${r} failed: ${e.message}\n`);
    }
    // Clean up temp file
    try { fs.unlinkSync(outFile); } catch {}
    // Brief pause between reps
    await new Promise(r => setTimeout(r, 500));
  }

  const p99s = rows.map(r => r.client_p99);
  const rejs = rows.map(r => r.client_rej * 100);

  allResults[algo] = {
    algorithm: algo,
    p99: { mean: mean(p99s).toFixed(1), std: std(p99s).toFixed(1) },
    reject_pct: { mean: mean(rejs).toFixed(1), std: std(rejs).toFixed(1) },
    n_reps: rows.length,
    raw_p99: p99s,
  };

  process.stdout.write(
    ` p99=${mean(p99s).toFixed(1)}±${std(p99s).toFixed(1)}ms  rej=${mean(rejs).toFixed(1)}%\n`
  );
}

const outPath = path.join(RESULTS_DIR, 'results_http_experiment.json');
fs.writeFileSync(outPath, JSON.stringify({
  meta: {
    experiment:   'HTTP real-request experiment',
    repeats:      REPEATS,
    load_rate:    LOAD_RATE,
    duration_s:   DURATION_S,
    iota:         IOTA,
    interf_window: [20, 50],
    timestamp:    new Date().toISOString(),
  },
  results: allResults,
}, null, 2));

agent.destroy();
console.log(`\nSaved: ${outPath}`);
