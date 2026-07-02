# Open Science Notes

This repository is the public replication package for the manuscript:

**P-DARC: Lightweight Admission Control for Node.js and Go Service Queues under Runtime Capacity Fluctuation**

Repository: https://github.com/Zioncesss/pdarc-replication-package

Archived release: https://doi.org/10.5281/zenodo.20481448

## Contents

- Node.js discrete-event simulator and controller implementations.
- Experiment runners for the primary six-scenario simulation study.
- Ablation, GradientDescent baseline, extended scenario, and HTTP validation scripts.
- Raw JSON results, CSV summaries, generated LaTeX tables, and statistical reports.
- Python analysis scripts for significance/effect-size summaries and table generation.

## Reproducibility

Primary simulator check:

```bash
cd experiments/nodejs
npm run smoke
npm test
```

Statistical tables:

```bash
cd experiments/analysis
pip install -r requirements.txt
python statistical_tests.py
python generate_latex_tables.py
```

The manuscript's main heavy-interference result is P-DARC `p99 = 209.5 ms`.

## Archival DOI

The release archive is available at Zenodo:

https://doi.org/10.5281/zenodo.20481448

## License

Code is released under the MIT License. Data and documentation are intended for
reuse with attribution; add a formal `CC BY 4.0` notice if the final archive
needs a separate data/documentation license statement.
