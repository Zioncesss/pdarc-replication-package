# Changelog

All notable changes to the P-DARC experiment package are documented here.

## [JSS Version 1.0] — 2026-05-29

### Added
- **Statistical rigor upgrade**: Increased repetitions from 10 to 30 per configuration (JSS requirement for Mann-Whitney U)
- **New scenario**: `erratic` — models GC pause patterns (80% capacity oscillation every 60ms)
- **New scenarios**: `io_mixed` (mixed CPU/I/O), `trace_like` (production-like 3-phase scenario)
- **Ablation study**: Component contribution analysis (7 variants: P-DARC, P-DARC-noI, P-DARC-noEMA, P-DARC-staticL, + baselines)
- **Extended baselines**: Gradient Descent algorithm comparison
- **HTTP validation**: Real HTTP server implementation for transport-boundary ranking evidence
- **Enhanced metrics module**:
  - `median()`, `medianAbsoluteDeviation()` for robust statistics
  - `confidenceInterval95()` for normal-approximation CI
  - Per-run raw arrays for downstream statistical testing
- **Statistical analysis**: Python scripts for Mann-Whitney U, Cliff's delta effect size, LaTeX table generation
- **Smoke test**: `smoke_test_jss.js` for quick validation (5 seconds)
- **Error handling**: Input validation, data validation, exception handling in all runners
- **Git infrastructure**: `.gitignore`, `.gitattributes` for clean repository
- **Documentation**: Comprehensive README.md, IMPROVEMENTS_APPLIED.md
- **Reproducibility**: `run_meta_jss.json` for experiment metadata logging

### Changed
- **JSS_BASE_SEED**: 42 → 1000 (avoids seed-space overlap with paper_v2)
- **Config module**: All 30 P-DARC parameters now explicitly listed with comments
- **Experiment runner**: `run_experiments_jss.js` replaces paper_v2 version
  - Structured exception handling
  - Per-run validation
  - Incremental progress reporting
- **Metrics aggregation**: Now returns full statistics objects (mean, std, median, CI95, raw arrays)
- **CSV export**: Extended to include median, CI95_lo, CI95_hi for each metric
- **Python requirements**: Updated to support scipy/numpy/pandas on modern systems
- **Algorithm imports in HTTP server**: Now imports from `../nodejs/src/algorithms.js` (no duplication)

### Fixed
- **CRN correctness**: Verified that `setRunSeed(baseSeed, repeatIndex)` produces identical arrivals across algorithms
- **HTTP step order**: Ensured admit → dequeue → update mirrors simulator exactly
- **Interference model**: Consistent capacity reduction across simulator and HTTP server
- **Statistical tests**: Added data validation to catch malformed results before analysis
- **Recovery time calculation**: Refined baseline detection (t=30-40s) and target threshold (1.5×baseline)

### Removed
- Duplicate algorithm implementations (HTTP server now imports from nodejs/src/)
- Unstable scenario variants (kept only well-characterized 6 core scenarios)
- Hard-coded parameter values in experiment runners (all now via config.js)

### Technical Details

#### Parameter Synchronization
- All parameters (PDARC_ALPHA, PDARC_BETA, ...) defined in single config.js
- Experiment runners: `import { PDARC_ALPHA, ... } from './src/config.js'`
- HTTP server: `import { CAPACITY, STEP_MS, ... } from '../nodejs/src/config.js'`
- This prevents parameter drift across implementations

#### Reproducibility Guarantees
- Mulberry32 RNG implemented inline (no external RNG library)
- Poisson sampling: standard rejection sampling algorithm
- Deterministic step order: arrival → admission → dequeue → update
- CRN: same `repeatIndex` → same Poisson seed → same arrival sequence across all algorithms within a scenario

#### Statistical Correctness
- Mann-Whitney U test: two-sided, α=0.05 (scipy.stats.mannwhitneyu)
- Cliff's delta: |d| ∈ [-1, 1], threshold interpretation per Romano et al. (2006)
- 95% CI: normal approximation (valid for n=30), mean ± 1.96·SE

### Testing
- `npm run smoke`: 18 checks, <5 seconds
- `npm test`: 30 reps × 6 scenarios × 5 algorithms, ~50 seconds
- `npm run all`: full suite (smoke + main + ablation + new-scenarios + http), ~5 minutes
- `python statistical_tests.py`: validates data, computes statistics, generates LaTeX tables

### Files Changed
```
experiments/nodejs/
  src/
    - config.js (JSS parameters, REPEATS=30, JSS_BASE_SEED=1000, 6 scenarios, extended ALGORITHMS)
    - simulator.js (input validation added)
    - metrics.js (median, MAD, CI95, raw arrays added)
    - algorithms.js (unchanged, all params from config.js)
    - rng.js (unchanged)
    - scenarios.js (erratic, io_mixed, trace_like added)
  - run_experiments_jss.js (new; 30 reps, exception handling)
  - run_ablation_jss.js (new; 7-variant component study)
  - run_gd_baseline.js (new; Gradient Descent test)
  - run_new_scenarios.js (new; extended scenarios)
  - smoke_test_jss.js (new; validation checks)
  - package.json (added npm scripts: smoke, gd, ablation, new-scenarios, all)
experiments/http/
  - http_server.js (imports algorithms from ../nodejs/src/)
  - run_http_exp.js (unchanged)
experiments/analysis/
  - statistical_tests.py (new; Mann-Whitney U, Cliff's delta, LaTeX tables)
  - generate_latex_tables.py (new; LaTeX table generation)
  - requirements.txt (scipy≥1.10.0, numpy≥1.24.0, pandas≥2.0.0)
experiments/results/
  - results_jss_30rep.json (30 reps per config)
  - results_jss_summary.json (aggregated, no raw arrays)
  - results_gd_baseline.json (Gradient Descent results)
  - ablation_jss_30rep.json (7 variants × scenarios)
  - results_http_experiment.json (HTTP ranking validation)
  - stat_results.json (Mann-Whitney U outputs)
  - sig_table_heavy.tex (LaTeX: RQ1 primary comparison)
  - sig_table_erratic.tex (LaTeX: RQ2 component analysis)
  - statistical_report.txt (human-readable analysis)
  - tab_main_heavy.tex (LaTeX: main results)
  - tab_ablation.tex (LaTeX: ablation results)
  - *.csv (per-scenario CSV exports)
Root:
  - README.md (new; comprehensive guide)
  - LICENSE (new; MIT)
  - CHANGELOG.md (this file)
  - .gitignore (new; git exclusions)
  - .gitattributes (new; line-ending normalization)
  - IMPROVEMENTS_APPLIED.md (new; code quality improvements)
```

### Known Limitations
- HTTP experiment is Windows-only (uses TCP sockets, OS-dependent scheduling)
- Simulator uses single-threaded Node.js (not parallelized)
- GC pause model simplified (constant 80% interference on erratic scenario)
- Pure async I/O workloads remain future work

### Breaking Changes
- **JSS_BASE_SEED changed** (42 → 1000): Results not directly comparable to paper_v2
- **Metrics output format**: Now includes .raw arrays (backward compatible via .mean, .std)
- **Requires Node.js ≥18** (uses ES modules)

### Backward Compatibility
- ✅ Paper v2 baseline results preserved in comments/documentation
- ✅ Same core algorithms (Fixed Backpressure, AIMD, PIE, P-DARC)
- ✅ Same parameter values (P-DARC α=0.2, β=1.0, etc.)
- ✅ Manual comparison possible by rerunning with paper_v2 seed (42)

---

## [Paper v2 Version] — (baseline, for reference)

Version used in the paper submission (10 reps, 5 core scenarios, basic statistics).
Not directly comparable to JSS version due to different seed and repetition count.

---

## Future Roadmap

Potential enhancements (not planned for JSS):
- [ ] Parallel experiment runner (Node.js cluster module)
- [ ] GPU-accelerated simulator (CUDA/OpenCL for large-scale studies)
- [ ] Distributed testing framework (cross-region validation)
- [ ] Interactive dashboard (live experiment monitoring)
- [ ] Extended baselines (ML-based rate control methods)

