"""
JSS Statistical Analysis: Mann-Whitney U + Cliff's delta
=========================================================
Reads JSS/experiments/results/results_jss_30rep.json and performs:
  1. Mann-Whitney U test (two-sided, alpha=0.05) for all pairwise comparisons
     of P-DARC vs each baseline, per scenario.
  2. Cliff's delta effect size with interpretation (negligible/small/medium/large).
  3. 95% confidence intervals for primary metrics.
  4. Generates a LaTeX-ready significance table and a plain summary report.

Usage:
    pip install -r requirements.txt
    python statistical_tests.py

Output:
    JSS/experiments/results/statistical_report.txt   — human-readable summary
    JSS/experiments/results/sig_table_heavy.tex      — LaTeX significance table
    JSS/experiments/results/stat_results.json        — machine-readable JSON

Reference:
    Wohlin et al. (2012), Experimentation in Software Engineering.
    Mann & Whitney (1947), Ann. Math. Statist.
    Cliff (1993), Pyschol. Bull. (effect size delta)
    Romano et al. (2006) thresholds: |d|<0.147 negligible, <0.33 small,
                                      <0.474 medium, >=0.474 large
"""

import json
import math
import sys
from pathlib import Path
from scipy.stats import mannwhitneyu
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent.parent  # JSS/experiments/
RESULTS_DIR = ROOT / "results"
DATA_FILE   = RESULTS_DIR / "results_jss_30rep.json"
GD_FILE     = RESULTS_DIR / "results_gd_baseline.json"

def merge_gradient_descent(data: dict) -> None:
    """Attach separately run GradientDescent results to the main result tree."""
    if not GD_FILE.exists():
        return
    with open(GD_FILE, "r", encoding="utf-8") as f:
        gd_data = json.load(f).get("results", {})
    for scenario, row in gd_data.items():
        if scenario in data:
            data[scenario]["GradientDescent"] = row

# ── Cliff's delta ─────────────────────────────────────────────────────────────

def cliffs_delta(x: list, y: list) -> float:
    """
    Cliff's delta: P(X > Y) - P(X < Y).
    Positive delta means X tends to be larger than Y.
    Here: x = baseline, y = P-DARC → positive delta means baseline > P-DARC
    (P-DARC has lower p99 → better).
    """
    n_x, n_y = len(x), len(y)
    dominance = sum(
        1 if xi > yi else (-1 if xi < yi else 0)
        for xi in x for yi in y
    )
    return dominance / (n_x * n_y)

def interpret_delta(d: float) -> str:
    """Romano et al. (2006) thresholds."""
    a = abs(d)
    if a < 0.147: return "negligible"
    if a < 0.330: return "small"
    if a < 0.474: return "medium"
    return "large"

def ci_95_mean(vals: list) -> tuple:
    """95% CI via normal approximation (valid at n=30)."""
    n  = len(vals)
    m  = np.mean(vals)
    se = np.std(vals, ddof=1) / math.sqrt(n)
    return m - 1.96 * se, m + 1.96 * se

# ── Core test function ────────────────────────────────────────────────────────

def compare(baseline_vals: list, pdarc_vals: list, metric: str, label: str) -> dict:
    """
    Compare baseline vs P-DARC on a metric.
    For p99 and rejection rate: lower is better for P-DARC.
    """
    stat, p = mannwhitneyu(baseline_vals, pdarc_vals, alternative="two-sided")
    d = cliffs_delta(baseline_vals, pdarc_vals)  # positive = baseline > P-DARC = P-DARC wins

    base_mean = np.mean(baseline_vals)
    pdarc_mean = np.mean(pdarc_vals)
    delta_abs = base_mean - pdarc_mean  # positive = P-DARC is better (lower p99)

    ci_lo, ci_hi = ci_95_mean(pdarc_vals)

    return {
        "comparison":   label,
        "metric":       metric,
        "baseline_mean": round(base_mean, 2),
        "pdarc_mean":   round(pdarc_mean, 2),
        "delta_abs":    round(delta_abs, 2),
        "delta_pct":    round(delta_abs / base_mean * 100, 1) if base_mean != 0 else None,
        "U_stat":       float(stat),
        "p_value":      float(p),
        "significant":  bool(p < 0.05),
        "cliffs_delta": round(d, 3),
        "effect_size":  interpret_delta(d),
        "pdarc_ci95":   [round(ci_lo, 2), round(ci_hi, 2)],
        "large_effect": bool(abs(d) >= 0.474),
    }

# ── LaTeX table generator ─────────────────────────────────────────────────────

SIGNIFICANCE_MARKERS = {
    (True, True):  r"$^{\dag\dag}$",   # significant + large effect
    (True, False): r"$^{\dag}$",        # significant only
    (False, True): r"$^{\circ}$",       # large effect, not significant (rare)
    (False, False): "",
}

def generate_latex_table(results: dict, scenario: str) -> str:
    """
    Generate a LaTeX table showing p99 results for a scenario.
    Significance markers: †† = p<0.05 and large effect; † = p<0.05 only.
    """
    baselines = ["Fixed Backpressure", "AIMD", "PIE", "GradientDescent"]
    header = (
        r"\begin{table}[!t]" + "\n"
        r"\centering" + "\n"
        r"\caption{P-DARC vs.\ baselines under \texttt{" + scenario.replace("_", r"\_") + r"}"
        " (30 reps; $\\dag\\dag$ = $p<0.05$ and large Cliff's $\\delta$)}" + "\n"
        r"\label{tab:sig_" + scenario + "}\n"
        r"\small" + "\n"
        r"\begin{tabular}{@{}lccccc@{}}" + "\n"
        r"\toprule" + "\n"
        r"\textbf{Algorithm} & \textbf{$p_{99}$ mean (ms)} & \textbf{95\% CI} "
        r"& \textbf{$p$-value} & \textbf{Cliff's $\delta$} & \textbf{Effect} \\" + "\n"
        r"\midrule" + "\n"
    )

    rows = []
    scen_results = results.get(scenario, {})
    pdarc_raw = scen_results.get("P-DARC", {}).get("p99", {}).get("raw", [])

    # P-DARC row first
    if pdarc_raw:
        pdarc_mean = np.mean(pdarc_raw)
        ci_lo, ci_hi = ci_95_mean(pdarc_raw)
        rows.append(
            rf"\pdarc & {pdarc_mean:.1f} & [{ci_lo:.1f}, {ci_hi:.1f}] & — & — & (reference) \\"
        )

    for bl in baselines:
        bl_raw = scen_results.get(bl, {}).get("p99", {}).get("raw", [])
        if not bl_raw or not pdarc_raw:
            rows.append(f"{bl} & — & — & — & — & — \\\\")
            continue
        r = compare(bl_raw, pdarc_raw, "p99", f"{bl} vs P-DARC")
        marker = SIGNIFICANCE_MARKERS[(r["significant"], r["large_effect"])]
        ci_str = f"[{r['pdarc_ci95'][0]:.1f}, {r['pdarc_ci95'][1]:.1f}]"
        p_str = f"{r['p_value']:.4f}" if r["p_value"] >= 0.0001 else "$<$0.0001"
        rows.append(
            f"{bl.replace('-', r'--').replace('_', r'\_')} & "
            f"{r['baseline_mean']:.1f}{marker} & {ci_str} & "
            f"{p_str} & {r['cliffs_delta']:.3f} & {r['effect_size']} \\\\"
        )

    footer = (
        r"\bottomrule" + "\n"
        r"\end{tabular}" + "\n"
        r"\end{table}"
    )

    return header + "\n".join(rows) + "\n" + footer

# ── Data validation ──────────────────────────────────────────────────────────

def validate_data(data: dict, min_reps: int = 30) -> None:
    """Validate that data contains all expected scenarios and reps."""
    if not isinstance(data, dict):
        raise ValueError("Data must be a dictionary")

    for scenario, algos in data.items():
        if not isinstance(algos, dict):
            raise ValueError(f"Scenario {scenario} value must be a dict")

        for algo, metrics in algos.items():
            p99_data = metrics.get("p99", {}).get("raw", [])
            if not isinstance(p99_data, list):
                raise ValueError(f"{scenario}/{algo}: p99.raw must be a list")
            if len(p99_data) < min_reps:
                raise ValueError(
                    f"{scenario}/{algo}: expected ≥{min_reps} reps, got {len(p99_data)}"
                )

# ── Main analysis ─────────────────────────────────────────────────────────────

def main():
    try:
        if not DATA_FILE.exists():
            print(f"ERROR: {DATA_FILE} not found.")
            print("Run 'node run_experiments_jss.js' first to generate results.")
            sys.exit(1)

        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"ERROR: Failed to parse {DATA_FILE}: {e}")
            sys.exit(1)

        # Validate data structure and counts
        try:
            validate_data(data, min_reps=30)
        except ValueError as e:
            print(f"ERROR: Data validation failed: {e}")
            sys.exit(1)

        merge_gradient_descent(data)

    baselines    = ["Fixed Backpressure", "AIMD", "PIE", "GradientDescent", "P-DARC-noI"]
    primary_scen = "interference_heavy"     # RQ1 primary comparison
    all_scenarios = list(data.keys())

    stat_results = {}
    report_lines = []

    report_lines.append("JSS Statistical Analysis Report")
    report_lines.append("=" * 60)
    report_lines.append(f"Data: {DATA_FILE}")
    report_lines.append(f"Scenarios: {all_scenarios}")
    report_lines.append(f"Repetitions per config: "
                        f"{len(next(iter(next(iter(data.values())).values())).get('p99', {}).get('raw', []))} reps")
    report_lines.append("")

    for scenario in all_scenarios:
        scen_data = data.get(scenario, {})
        pdarc_raw = scen_data.get("P-DARC", {}).get("p99", {}).get("raw", [])
        if not pdarc_raw:
            continue

        stat_results[scenario] = {}
        report_lines.append(f"\n{'─'*60}")
        report_lines.append(f"Scenario: {scenario}")
        report_lines.append(f"  P-DARC p99: {np.mean(pdarc_raw):.1f} ± {np.std(pdarc_raw, ddof=1):.1f} ms"
                            f"  CI95=[{ci_95_mean(pdarc_raw)[0]:.1f}, {ci_95_mean(pdarc_raw)[1]:.1f}]")

        for bl in baselines:
            bl_raw = scen_data.get(bl, {}).get("p99", {}).get("raw", [])
            if not bl_raw:
                continue

            r = compare(bl_raw, pdarc_raw, "p99", f"{bl} vs P-DARC [{scenario}]")
            stat_results[scenario][bl] = r

            sig_str = "[SIGNIFICANT]" if r["significant"] else "[not significant]"
            eff_str = r["effect_size"].upper()
            report_lines.append(
                f"  {bl:<22} p99={r['baseline_mean']:.1f}ms"
                f"  Δ={r['delta_abs']:+.1f}ms ({r['delta_pct']:+.1f}%)"
                f"  U={r['U_stat']:.0f}  p={r['p_value']:.4f}  [{sig_str}]"
                f"  Cliff's δ={r['cliffs_delta']:.3f} [{eff_str}]"
            )

        # Also run reject_rate comparison
        pdarc_rej = scen_data.get("P-DARC", {}).get("reject_rate", {}).get("raw", [])
        for bl in ["Fixed Backpressure", "AIMD", "PIE", "GradientDescent"]:
            bl_rej = scen_data.get(bl, {}).get("reject_rate", {}).get("raw", [])
            if not bl_rej or not pdarc_rej:
                continue
            r_rej = compare(bl_rej, pdarc_rej, "reject_rate", f"{bl} vs P-DARC rej [{scenario}]")
            stat_results[scenario].setdefault("reject_rate", {})[bl] = r_rej

    # ── Primary comparison summary (RQ1) ──
    report_lines.append(f"\n{'═'*60}")
    report_lines.append(f"RQ1 PRIMARY COMPARISON: {primary_scen}")
    report_lines.append("JSS requirement: p < 0.05 AND |Cliff's δ| ≥ 0.474 (large effect)")
    report_lines.append("")
    if primary_scen in stat_results:
        for bl, r in stat_results[primary_scen].items():
            if isinstance(r, dict) and "p_value" in r:
                jss_pass = r["significant"] and r["large_effect"]
                status = "[SUPPORTED]" if jss_pass else "[NEEDS REVISION]"
                report_lines.append(f"  {bl}: {status}")
                report_lines.append(f"    p={r['p_value']:.4f}, δ={r['cliffs_delta']:.3f} ({r['effect_size']})")

        # ── Write outputs ──
        try:
            report_text = "\n".join(report_lines)
            print(report_text)

            with open(RESULTS_DIR / "statistical_report.txt", "w", encoding="utf-8") as f:
                f.write(report_text)

            with open(RESULTS_DIR / "stat_results.json", "w", encoding="utf-8") as f:
                json.dump(stat_results, f, indent=2)

            # LaTeX significance table for interference_heavy
            if primary_scen in data:
                tex = generate_latex_table(data, primary_scen)
                with open(RESULTS_DIR / "sig_table_heavy.tex", "w", encoding="utf-8") as f:
                    f.write(tex)
                print(f"\nLaTeX table -> results/sig_table_heavy.tex")

            # LaTeX table for erratic (RQ2: integral contribution)
            if "erratic" in data:
                tex_e = generate_latex_table(data, "erratic")
                with open(RESULTS_DIR / "sig_table_erratic.tex", "w", encoding="utf-8") as f:
                    f.write(tex_e)
                print(f"LaTeX table -> results/sig_table_erratic.tex")

            print(f"\nFull report → results/statistical_report.txt")
            print(f"JSON data   → results/stat_results.json")
        except IOError as e:
            print(f"ERROR: Failed to write output files: {e}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"FATAL ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
