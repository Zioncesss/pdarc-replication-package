# Open Science Notes

This repository is the public replication package for the manuscript:

**P-DARC: Admission Control for Runtime-Local Queues under Time-Varying Capacity**

Repository: https://github.com/Zioncesss/pdarc-jss

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

A Zenodo release DOI is still recommended before final JSS submission or revision.
After creating the GitHub release and Zenodo archive, update this file, `CITATION.cff`,
and the manuscript Data Availability statement with the DOI.

## License

Code is released under the MIT License. Data and documentation are intended for
reuse with attribution; add a formal `CC BY 4.0` notice if the final archive
needs a separate data/documentation license statement.
