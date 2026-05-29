/**
 * Read results_http_experiment.json and patch HTTP result macros
 * into main_assembly.tex.
 * Usage: node gen_http_macros.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS   = path.join(__dirname, '..', 'results', 'results_http_experiment.json');
const TEX       = path.join(__dirname, '..', '..', 'en', 'main_assembly.tex');

const data = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const r    = data.results;

function fmt(obj) {
  return `${parseFloat(obj.mean).toFixed(1)}$\\pm$${parseFloat(obj.std).toFixed(1)}`;
}

const map = {
  HTTPFBP:    fmt(r['Fixed Backpressure'].p99),
  HTTPFBPREJ: parseFloat(r['Fixed Backpressure'].reject_pct.mean).toFixed(1),
  HTTPAIMD:   fmt(r['AIMD'].p99),
  HTTPAIMDREJ: parseFloat(r['AIMD'].reject_pct.mean).toFixed(1),
  HTTPPIE:    fmt(r['PIE'].p99),
  HTTPPIEREJ: parseFloat(r['PIE'].reject_pct.mean).toFixed(1),
  HTTPGD:     fmt(r['GradientDescent'].p99),
  HTTPGDREJ:  parseFloat(r['GradientDescent'].reject_pct.mean).toFixed(1),
  HTTPPDARC:  fmt(r['P-DARC'].p99),
  HTTPPDARCREJ: parseFloat(r['P-DARC'].reject_pct.mean).toFixed(1),
};

let tex = fs.readFileSync(TEX, 'utf8');
for (const [name, val] of Object.entries(map)) {
  tex = tex.replace(
    new RegExp(`\\\\newcommand\\{\\\\${name}\\}\\{[^}]*\\}`),
    `\\newcommand{\\${name}}{${val}}`
  );
}
fs.writeFileSync(TEX, tex);
console.log('Patched macros in main_assembly.tex:');
for (const [k, v] of Object.entries(map)) console.log(`  \\${k} = ${v}`);
