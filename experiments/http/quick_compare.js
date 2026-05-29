/**
 * Quick 15s comparison of all 5 algorithms (1 rep each).
 * Confirms ordering before launching the 15-rep full experiment.
 */
import http from 'http';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER    = path.join(__dirname, 'http_server.js');
const ALGOS     = ['P-DARC', 'Fixed Backpressure', 'AIMD', 'PIE', 'GradientDescent'];
const TICK_MS   = 15;
const BATCH     = 12;
const DUR       = 15;
const WARMUP    = 3;
let   basePort  = 13300;

async function test(algo, port) {
  const proc = spawn('node', [
    SERVER, '--algo', algo, '--port', String(port),
    '--out',  '_quick_tmp.json',
    '--interf', '0.5', '--interf-start', '4', '--interf-end', '12',
  ], { stdio: ['ignore','pipe','pipe'] });
  proc.stderr.on('data', () => {});

  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), 8000);
    proc.stdout.once('data', () => { clearTimeout(t); res(); });
  });
  await new Promise(r => setTimeout(r, 100));

  const agent = new http.Agent({ keepAlive: true, maxSockets: 300 });
  const start = performance.now();
  const lats  = [];
  let rej = 0;

  await new Promise(done => {
    const timer = setInterval(() => {
      if ((performance.now() - start) / 1000 >= DUR) { clearInterval(timer); done(); return; }
      for (let i = 0; i < BATCH; i++) {
        const rs = performance.now();
        const req = http.request(
          { hostname: '127.0.0.1', port, path: '/', method: 'GET', agent },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => {
              const t2 = (performance.now() - start) / 1000;
              if (t2 >= WARMUP) {
                if (res.statusCode === 200) lats.push(performance.now() - rs);
                else rej++;
              }
            });
          }
        );
        req.on('error', () => {});
        req.end();
      }
    }, TICK_MS);
  });

  await new Promise(r => setTimeout(r, 2000));
  proc.kill();
  agent.destroy();

  const s = [...lats].sort((a, b) => a - b);
  const p = x => s[Math.floor(s.length * x)] ?? 0;
  return {
    algo,
    p50: p(0.5).toFixed(0),
    p99: p(0.99).toFixed(0),
    rej: (rej / Math.max(1, rej + lats.length) * 100).toFixed(1),
  };
}

console.log('Quick HTTP comparison (1 rep each, 15s, ι=0.5):\n');
for (const algo of ALGOS) {
  const port = basePort++;
  const r = await test(algo, port);
  console.log(`  ${r.algo.padEnd(22)} p50=${r.p50}ms  p99=${r.p99}ms  rej=${r.rej}%`);
  await new Promise(r => setTimeout(r, 500));
}
console.log('\nDone.');
