/**
 * Quick smoke test: 1 rep of P-DARC, 15s, 800 req/s (batched).
 * Uses batch-per-tick load generation to work around Windows 15ms timer resolution.
 */
import http from 'http';
import { performance } from 'perf_hooks';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, 'http_server.js');
const OUTFILE     = path.join(__dirname, '_smoke_result.json');
const PORT        = 13099;

const RATE    = 800;     // req/s target
const TICK_MS = 15;      // timer tick (match Windows resolution)
const BATCH   = Math.round(RATE * TICK_MS / 1000);  // requests per tick = 12
const WARMUP  = 3;
const DUR     = 15;

// Keep-alive agent for connection reuse
const agent = new http.Agent({ keepAlive: true, maxSockets: 300 });

console.log(`HTTP smoke test: P-DARC, ${DUR}s, ${RATE} req/s (${BATCH}/tick), ι=0.5 (t=5-10s)`);
console.log(`Batch size: ${BATCH} per ${TICK_MS}ms tick\n`);

const proc = spawn('node', [
  SERVER_PATH,
  '--algo',  'P-DARC',
  '--port',  String(PORT),
  '--out',   OUTFILE,
  '--interf', '0.5',
  '--interf-start', '4',
  '--interf-end',   '12',
], { stdio: ['ignore', 'pipe', 'pipe'] });

proc.stderr.on('data', d => process.stderr.write(d.toString()));

await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Server start timeout')), 8000);
  proc.stdout.on('data', (d) => {
    if (d.toString().includes('READY')) { clearTimeout(t); resolve(); }
  });
});
console.log('Server ready.');

const startMs  = performance.now();
const latencies = [];
let rejected = 0, total = 0, ticksFired = 0;

const timer = setInterval(() => {
  const elapsed = (performance.now() - startMs) / 1000;
  if (elapsed >= DUR) { clearInterval(timer); return; }
  ticksFired++;

  for (let i = 0; i < BATCH; i++) {
    const reqStart = performance.now();
    total++;
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path: '/', method: 'GET', agent },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const t2 = (performance.now() - startMs) / 1000;
          if (t2 >= WARMUP) {
            if (res.statusCode === 200) latencies.push(performance.now() - reqStart);
            else rejected++;
          }
        });
      }
    );
    req.on('error', () => {});
    req.end();
  }
}, TICK_MS);

await new Promise(r => setTimeout(r, (DUR + 3) * 1000));
proc.kill();

const sorted = [...latencies].sort((a, b) => a - b);
const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? 0;

console.log(`\nClient-side (${latencies.length} admitted, ${rejected} rejected, ${total} total):`);
console.log(`  p50 latency  : ${p50.toFixed(1)} ms`);
console.log(`  p99 latency  : ${p99.toFixed(1)} ms`);
console.log(`  reject rate  : ${(rejected / Math.max(1, total) * 100).toFixed(1)}%`);
console.log(`  actual rate  : ${(total / DUR).toFixed(0)} req/s (ticks fired: ${ticksFired})`);

try {
  const srv = JSON.parse(fs.readFileSync(OUTFILE, 'utf8'));
  console.log(`  server p99   : ${(srv.p99 ?? 0).toFixed(1)} ms`);
  fs.unlinkSync(OUTFILE);
} catch {}

agent.destroy();
console.log(p99 > 0 && p99 < 5000 ? '\n✓ Smoke test PASSED' : '\n✗ Smoke test FAILED');
