# P-DARC Replication Package

This package contains the simulator, HTTP experiment harness, generated results, and analysis scripts used by the associated manuscript.

## Requirements

- Node.js >= 18
- Python 3.10+ for statistical analysis
- Python packages from `experiments/analysis/requirements.txt`

## Quick checks

```powershell
cd experiments\nodejs
npm run smoke
```

## Reproduce primary simulator results

```powershell
cd experiments\nodejs
npm install
npm test
```

This regenerates `experiments/results/results_jss_30rep.json` for the six primary simulation scenarios (five canonical scenarios plus the erratic scenario). The manuscript's main heavy-interference result is P-DARC `p99 = 209.5 ms`.

## Reproduce additional result sets

```powershell
cd experiments\nodejs
npm run gd
npm run ablation
npm run new-scenarios
```

The HTTP experiment is longer and uses local TCP sockets:

```powershell
cd experiments\nodejs
npm run http
```

## Regenerate statistical reports and tables

```powershell
cd experiments\analysis
python statistical_tests.py
python generate_latex_tables.py
```

## Important scope notes

- The simulator uses paired common random numbers for controlled algorithm comparison.
- The HTTP experiment is interpreted as transport-boundary ranking evidence, not as a production throughput benchmark.
- Filenames containing `_jss` are retained as legacy dataset identifiers for the archived 30-repetition experiment package.
- Public repository: https://github.com/Zioncesss/pdarc-replication-package
- Archived release DOI: https://doi.org/10.5281/zenodo.20481448
