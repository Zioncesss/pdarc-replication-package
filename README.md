# P-DARC JSS Replication Package

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Python](https://img.shields.io/badge/python-%3E%3D3.10-blue)

This repository contains the complete replication package for the paper **"P-DARC: Predictive Decoupling with Adaptive Rate Control"** published in the Journal of Systems and Software (JSS).

## 📋 Contents

### Core Components

- **Simulator** (`experiments/nodejs/src/`)
  - P-DARC v5 adaptive rate control algorithm
  - Five baseline algorithms: Fixed Backpressure, AIMD, PIE, P-DARC-noI, P-DARC-staticL
  - Discrete-event simulator with coupled random numbers (CRN) for paired comparisons
  - Metrics collection: p50/p95/p99 latency, queue length, throughput, rejection rate

- **Experiment Scripts** (`experiments/nodejs/`)
  - `run_experiments_jss.js` - Primary study: 30 reps × 6 scenarios × 5 algorithms
  - `run_ablation_jss.js` - Ablation study: component contribution analysis
  - `run_gd_baseline.js` - Gradient Descent baseline comparison
  - `run_new_scenarios.js` - Extended scenarios (io_mixed, trace_like)
  - `smoke_test_jss.js` - Quick validation (5 seconds)

- **HTTP Experiment** (`experiments/http/`)
  - Real HTTP server implementation using same algorithms
  - Transport-boundary ranking validation
  - Stress test harnesses (Node.js, Go)

- **Statistical Analysis** (`experiments/analysis/`)
  - `statistical_tests.py` - Mann-Whitney U, Cliff's delta, confidence intervals
  - `generate_latex_tables.py` - LaTeX table generation for manuscript

- **Results** (`experiments/results/`)
  - Raw JSON data: 30 reps per configuration
  - CSV exports: per-scenario summary statistics
  - LaTeX tables: publication-ready significance tables
  - Statistical report: complete test results

## 🚀 Quick Start

### Requirements

- **Node.js** ≥18
- **Python** ≥3.10
- Python packages: `scipy`, `numpy`, `pandas` (see `experiments/analysis/requirements.txt`)

### 1. Smoke Test (5 seconds)
```bash
cd experiments/nodejs
npm run smoke
```

Expected output: 18/18 checks passed.

### 2. Run Main Experiment (50 seconds)
```bash
cd experiments/nodejs
npm install
npm test
```

This regenerates `experiments/results/results_jss_30rep.json` containing all primary results.

### 3. Statistical Analysis (10 seconds)
```bash
cd experiments/analysis
pip install -r requirements.txt
python statistical_tests.py
```

Outputs:
- `statistical_report.txt` - Human-readable summary
- `sig_table_heavy.tex` - LaTeX significance table
- `stat_results.json` - Machine-readable results

## 📊 Experiment Overview

### Primary Study (RQ1)
Compares P-DARC vs baselines under six scenarios:
- **steady**: Constant 800 tasks/sec
- **step_burst**: Step increase from 800 → 1500 at t=40s
- **pulse_burst**: 2-sec bursts at 1500 tasks/sec every 10 sec
- **interference_light**: 20% I/O blocking, t=40-80s
- **interference_heavy**: 50% I/O blocking, t=40-80s ← **Primary RQ1 scenario**
- **erratic**: 80% capacity oscillation every 4 steps (60ms period) ← **RQ2: Component analysis**

### Ablation Study (RQ2)
Tests P-DARC component contributions:
- Full P-DARC (α=0.2, integral control, L-feedback)
- P-DARC-noI (no integral term)
- P-DARC-noEMA (no exponential moving average)
- P-DARC-staticL (static queue threshold)
- Plus baselines for comparison

### Extended Scenarios
- **io_mixed**: 900 tasks/sec with periodic 85% interference (models realistic I/O)
- **trace_like**: Production-like 3-phase scenario: normal traffic → load surge with GC → recovery

## 🔄 Key Design Features

### Paired Common Random Numbers (CRN)
All algorithms use the same arrival sequence for each scenario, maximizing paired comparison power:
```bash
setRunSeed(JSS_BASE_SEED, repeatIndex)  # Same seed → same arrivals
```

### Deterministic Simulation
- Discrete-step simulator (T_step = 15ms)
- Coupled queue state management
- Results reproducible within ±0.1ms

### Validation Infrastructure
- Input validation (array lengths, RNG function type)
- Data validation (JSON parsing, repetition counts)
- Output verification (LaTeX compilation, statistical test assumptions)

## 📈 Main Results

**Primary comparison** (interference_heavy, 30 reps, Mann-Whitney U test):

| Algorithm | p99 (ms) | vs P-DARC | p-value | Cliff's δ |
|-----------|----------|-----------|---------|-----------|
| **P-DARC** | **209.5** | — | — | — |
| Fixed Backpressure | 387.2 | +84.7% | <0.0001 | 1.000 |
| AIMD | 412.1 | +96.6% | <0.0001 | 1.000 |
| PIE | 356.8 | +70.3% | <0.0001 | 1.000 |
| P-DARC-noI | 245.3 | +17.0% | 0.0002 | 0.867 |

✓ All comparisons: p < 0.05 and |δ| ≥ 0.474 (large effect) — meets JSS statistical rigor threshold.

## 📁 Repository Structure

```
.
├── README.md                          # This file
├── LICENSE                            # MIT License
├── .gitignore                         # Git exclusions
├── .gitattributes                     # Line-ending normalization
├── IMPROVEMENTS_APPLIED.md            # Code improvements log
│
├── experiments/
│   ├── nodejs/
│   │   ├── src/
│   │   │   ├── algorithms.js          # All algorithm implementations
│   │   │   ├── simulator.js           # Core SED simulator
│   │   │   ├── config.js              # All parameters (JSS § 3-4)
│   │   │   ├── metrics.js             # Statistics functions
│   │   │   ├── rng.js                 # Mulberry32 + Poisson RNG
│   │   │   └── scenarios.js           # Workload scenarios
│   │   ├── run_experiments_jss.js     # 30-rep main experiment
│   │   ├── run_ablation_jss.js        # Component ablation
│   │   ├── run_gd_baseline.js         # Gradient Descent test
│   │   ├── run_new_scenarios.js       # Extended scenarios
│   │   ├── smoke_test_jss.js          # Validation check
│   │   └── package.json               # npm scripts & metadata
│   │
│   ├── http/
│   │   ├── http_server.js             # Real HTTP server
│   │   ├── run_http_exp.js            # HTTP experiment driver
│   │   ├── quick_compare.js           # Algorithm comparison harness
│   │   └── gen_http_macros.js         # Macro generation for experiments
│   │
│   ├── analysis/
│   │   ├── requirements.txt           # Python dependencies
│   │   ├── statistical_tests.py       # Mann-Whitney U + Cliff's δ
│   │   └── generate_latex_tables.py   # LaTeX table generation
│   │
│   └── results/
│       ├── results_jss_30rep.json     # Full results with raw arrays
│       ├── results_jss_summary.json   # Aggregated statistics
│       ├── results_gd_baseline.json   # Gradient Descent results
│       ├── ablation_jss_30rep.json    # Component ablation results
│       ├── results_http_experiment.json # HTTP experiment results
│       ├── stat_results.json          # Statistical test outputs
│       ├── sig_table_heavy.tex        # LaTeX: interference_heavy comparison
│       ├── sig_table_erratic.tex      # LaTeX: erratic scenario comparison
│       ├── tab_main_heavy.tex         # LaTeX: primary results table
│       ├── tab_ablation.tex           # LaTeX: ablation study table
│       ├── *.csv                      # Per-scenario CSV exports
│       └── statistical_report.txt     # Human-readable analysis summary
│
├── README_REPLICATION.md              # Original replication instructions
└── OPEN_SCIENCE.md                    # JSS Open Science statement template
```

## 🔧 Advanced Usage

### Run All Experiments
```bash
cd experiments/nodejs
npm run all
```

Runs: smoke test → main (30 reps) → ablation → new scenarios → HTTP experiment.
Expected runtime: ~5 minutes on modern laptop.

### Run Individual Experiment Sets
```bash
npm run experiment          # Main 30-rep study
npm run ablation            # Component ablation (7 variants)
npm run gd                  # Gradient Descent baseline
npm run new-scenarios       # Extended scenarios (io_mixed, trace_like)
npm run http                # HTTP experiment (local TCP)
```

### Custom Experiments

Modify `experiments/nodejs/src/config.js`:
- Change `REPEATS` for more/fewer replications
- Adjust algorithm parameters (αβγ constants)
- Add new scenarios in `experiments/nodejs/src/scenarios.js`

Re-run: `npm test` then `python experiments/analysis/statistical_tests.py`

### HTTP Experiment with Custom Parameters

```bash
node experiments/http/run_http_exp.js \
  --algo P-DARC \
  --port 3001 \
  --duration 60 \
  --out results.json \
  --interf 0.5 \
  --interf-start 20 \
  --interf-end 50
```

## 📊 Data Formats

### results_jss_30rep.json
```json
{
  "scenario_name": {
    "algorithm_name": {
      "p99": {
        "mean": 209.5,
        "std": 12.3,
        "median": 208.1,
        "ci95_lo": 203.2,
        "ci95_hi": 215.8,
        "raw": [210.1, 211.2, 208.9, ...]  // 30 values
      },
      "p95": { ... },
      "reject_rate": { ... },
      ...
    }
  }
}
```

### statistical_report.txt (excerpt)
```
JSS Statistical Analysis Report
============================================================
Scenario: interference_heavy
  P-DARC p99: 209.5 ± 12.3 ms  CI95=[203.2, 215.8]
  Fixed Backpressure: p99=387.2ms  Δ=+177.7ms (+84.7%)  U=900.0  p=0.0001  [SIGNIFICANT]  Cliff's δ=1.000 [LARGE]
  ...
```

## 📚 Citation

If you use this code or data, please cite:

```bibtex
@article{pdarc-jss,
  title={P-DARC: Predictive Decoupling with Adaptive Rate Control},
  journal={Journal of Systems and Software},
  year={2026},
  note={Replication package available at: https://github.com/[username]/pdarc-jss}
}
```

## 📜 License

This code is released under the **MIT License** (see `LICENSE` file).
Data and documentation are released under **CC BY 4.0** (Creative Commons Attribution).

## ✅ Reproducibility Checklist

- ✓ All source code included (no external dependencies except npm/pip packages)
- ✓ All parameters documented (config.js, comments in code)
- ✓ Random number generation seeded for determinism (CRN)
- ✓ Statistical tests properly documented (scipy Mann-Whitney U, Cliff's delta)
- ✓ Data validation and error handling (input validation, JSON parsing, count checks)
- ✓ Instructions for running all experiments (npm scripts, Python analysis)
- ✓ Expected runtime documented (~50 sec main + ~10 sec analysis)
- ✓ Raw data included for verification (results/*.json)
- ✓ Git history clean (`.gitignore`, `.gitattributes` for cross-platform compatibility)

## 🐛 Troubleshooting

### "Results file not found" error
Make sure you've run the experiment first:
```bash
cd experiments/nodejs
npm test
```

### "ImportError: No module named scipy"
Install Python dependencies:
```bash
cd experiments/analysis
pip install -r requirements.txt
```

### Inconsistent results across runs
This is expected for real HTTP experiments due to OS scheduling variance. For the simulator, results should be deterministic within ±0.1ms due to floating-point rounding. If differences are larger, check that CRN seeds haven't changed.

### LaTeX table compilation fails
Ensure you're using `pdflatex` with `siunitx` package. If regenerating in a different environment, validate with:
```bash
pdflatex -interaction=nonstopmode sig_table_heavy.tex
```

## 📧 Contact & Questions

For questions about the code or experiments, please:
1. Check `IMPROVEMENTS_APPLIED.md` for recent changes
2. Review comments in `experiments/nodejs/src/config.js` for parameter explanations
3. Consult the manuscript (JSS paper §3–4) for algorithm details
4. Open an issue on GitHub

## 🙏 Acknowledgments

Thanks to:
- JSS reviewers for thorough feedback
- Reproducibility community for best practices in experiment packaging
- All contributors to the statistical libraries (scipy, numpy, pandas)

---

**Last updated**: 2026-05-29  
**Status**: ✅ Ready for submission

