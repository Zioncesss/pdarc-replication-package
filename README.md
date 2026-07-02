# P-DARC Replication Package

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20481448.svg)](https://doi.org/10.5281/zenodo.20481448)
![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![Python](https://img.shields.io/badge/python-%3E%3D3.10-blue)

This repository contains the replication package for the manuscript:

**P-DARC: Lightweight Admission Control for Node.js and Go Service Queues under Runtime Capacity Fluctuation**

Repository: https://github.com/Zioncesss/pdarc-replication-package

Archived release: https://doi.org/10.5281/zenodo.20481448

## Contents

- `experiments/nodejs/src/`: P-DARC, baselines, scenarios, metrics, RNG, and the discrete-event simulator.
- `experiments/nodejs/`: primary simulation, ablation, GradientDescent, extended-scenario, and smoke-test runners.
- `experiments/http/`: real HTTP/TCP validation harness using the same controller implementations.
- `experiments/analysis/`: Python scripts for statistical reports and LaTeX table generation.
- `experiments/results/`: raw JSON results, CSV summaries, generated tables, and statistical reports.

## Requirements

- Node.js >= 18
- Python >= 3.10
- Python packages listed in `experiments/analysis/requirements.txt`

No npm package install is required for the current simulator because it uses only built-in Node.js modules.

## Quick Start

Run a fast simulator smoke test:

```bash
cd experiments/nodejs
npm run smoke
```

Expected result: `18 passed, 0 failed`.

Regenerate the six-scenario primary simulator results (five canonical scenarios plus the erratic scenario):

```bash
cd experiments/nodejs
npm test
```

Regenerate statistical reports and manuscript tables:

```bash
cd experiments/analysis
pip install -r requirements.txt
python statistical_tests.py
python generate_latex_tables.py
```

## Experiment Runners

From `experiments/nodejs`:

```bash
npm run smoke          # quick validation
npm test               # primary 30-rep simulation study
npm run gd             # GradientDescent baseline
npm run ablation       # controller component ablation
npm run new-scenarios  # io_mixed and trace_like scenarios
npm run http           # local TCP/HTTP validation
npm run all            # smoke + primary + gd + ablation + new scenarios
```

The HTTP validation is intentionally separate from `npm run all` because local TCP scheduling is OS-dependent.

## Main Heavy-Interference Result

Primary comparison: `interference_heavy`, 30 paired common-random-number simulation replications.

| Algorithm | p99 (ms) | SLA exceedance | p-value | Cliff's delta |
| --- | ---: | ---: | ---: | ---: |
| P-DARC | 209.5 | +5% | - | - |
| Fixed Backpressure | 451.6 | +126% | <0.0001 | 1.000 |
| AIMD | 354.7 | +77% | <0.0001 | 1.000 |
| PIE | 379.7 | +90% | <0.0001 | 1.000 |
| GradientDescent | 314.2 | +57% | <0.0001 | 1.000 |

`P-DARC-noI` is reported as an ablation/control. It is indistinguishable from full P-DARC in the heavy-interference scenario, while the integral path contributes under the erratic-interference scenario.

## Reproducibility Notes

- The simulator uses paired common random numbers: the same repetition index gives the same arrival stream across algorithms.
- Simulation results are controlled algorithm comparisons, not independent deployment samples.
- HTTP runs are interpreted as transport-boundary ranking evidence, not as production throughput benchmarks.
- The manuscript's main heavy-interference result is P-DARC `p99 = 209.5 ms`.
- Filenames containing `` are retained as legacy dataset identifiers for the archived 30-repetition experiment package.

## Repository Structure

```text
.
|-- README.md
|-- README_REPLICATION.md
|-- OPEN_SCIENCE.md
|-- CITATION.cff
|-- LICENSE
|-- CHANGELOG.md
|-- IMPROVEMENTS_APPLIED.md
|-- .github/workflows/reproducibility.yml
`-- experiments/
    |-- nodejs/
    |-- http/
    |-- analysis/
    `-- results/
```

## Citation

If you use this code or data, please cite the associated manuscript and this repository:

```bibtex
@misc{pdarc-replication-package,
  author={Song, Chengen},
  title={Replication Package for P-DARC: Lightweight Admission Control for Node.js and Go Service Queues under Runtime Capacity Fluctuation},
  year={2026},
  doi={10.5281/zenodo.20481448},
  url={https://github.com/Zioncesss/pdarc-replication-package},
  note={Replication package for the submitted manuscript}
}
```

## License

Code is released under the MIT License. Data and documentation are intended for reuse with attribution.

