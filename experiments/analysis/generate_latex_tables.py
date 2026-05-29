"""
JSS LaTeX Table Generator
=========================
Reads results_jss_30rep.json + stat_results.json and generates
publication-ready LaTeX tables for JSS submission.

Tables generated:
  - tab_main_heavy.tex   : interference_heavy main comparison (Table 2)
  - tab_ablation.tex     : ablation study (Table 3, from ablation_jss_30rep.json)
  - tab_all_scenarios.tex: p99 across all 6 scenarios (Table 4)

Usage:
    python generate_latex_tables.py
"""

import json
import numpy as np
from pathlib import Path

ROOT        = Path(__file__).parent.parent
RESULTS_DIR = ROOT / "results"

# ── Helpers ───────────────────────────────────────────────────────────────────

def load_json(fname: str) -> dict:
    p = RESULTS_DIR / fname
    if not p.exists():
        print(f"WARNING: {fname} not found — run experiments first.")
        return {}
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)

def merge_gradient_descent(data: dict) -> None:
    gd = load_json("results_gd_baseline.json")
    for scenario, row in gd.get("results", {}).items():
        if scenario in data:
            data[scenario]["GradientDescent"] = row

def get_mean(data, scenario, algo, metric):
    try:
        v = data[scenario][algo][metric]
        return v["mean"] if isinstance(v, dict) else v[0]
    except (KeyError, TypeError):
        return None

def get_std(data, scenario, algo, metric):
    try:
        v = data[scenario][algo][metric]
        return v["std"] if isinstance(v, dict) else v[1]
    except (KeyError, TypeError):
        return None

def fmt(val, digits=1):
    if val is None: return "—"
    return f"{val:.{digits}f}"

def pct(val):
    if val is None: return "—"
    return f"{val*100:.1f}"

# Significance markers from stat_results.json
def sig_marker(stat_results, scenario, baseline):
    try:
        r = stat_results[scenario][baseline]
        if r.get("significant") and r.get("large_effect"):
            return r"$^{\dag\dag}$"
        if r.get("significant"):
            return r"$^{\dag}$"
    except (KeyError, TypeError):
        pass
    return ""

# ── Table 1: Main comparison — interference_heavy ─────────────────────────────

def gen_tab_main_heavy(data, stat_results):
    scen = "interference_heavy"
    algos = ["Fixed Backpressure", "AIMD", "PIE", "GradientDescent", "P-DARC", "P-DARC-noI"]
    algo_labels = {
        "Fixed Backpressure": r"\textbf{Fixed BP}",
        "AIMD":               r"\textbf{AIMD}",
        "PIE":                r"\textbf{PIE}",
        "GradientDescent":     r"\textbf{GradientDescent}",
        "P-DARC":             r"\textbf{\pdarc}",
        "P-DARC-noI":         r"\textbf{\pdarc-noI}",
    }

    lines = [
        r"\begin{table}[!t]",
        r"\centering",
        r"\caption{Performance under \texttt{interference\_heavy} ($\iota=0.50$, "
        r"$t\in[40,80)$\,s). 30 independent repetitions. "
        r"$^\dag$ $p<0.05$; $^{\dag\dag}$ $p<0.05$ and Cliff's $|\delta|\geq0.474$.}",
        r"\label{tab:main_heavy_jss}",
        r"\small",
        r"\setlength{\tabcolsep}{4pt}",
        r"\begin{tabular}{@{}lrrrrr@{}}",
        r"\toprule",
        r"\textbf{Algorithm} & \textbf{$p_{99}$ (ms)} & \textbf{$L_{\max}$} "
        r"& \textbf{Throughput} & \textbf{Rej.\,(\%)} & \textbf{Rec.\,(s)} \\",
        r"\midrule",
    ]

    for algo in algos:
        m_p99  = get_mean(data, scen, algo, "p99")
        s_p99  = get_std(data, scen, algo, "p99")
        m_qmax = get_mean(data, scen, algo, "q_max")
        m_tp   = get_mean(data, scen, algo, "tp_mean")
        m_rej  = get_mean(data, scen, algo, "reject_rate")
        m_rec  = get_mean(data, scen, algo, "recovery_time")

        # Significance marker (only for baselines compared to P-DARC)
        marker = ""
        if algo not in ("P-DARC",):
            marker = sig_marker(stat_results, scen, algo)

        row = (
            f"{algo_labels[algo]} & "
            f"{fmt(m_p99)} $\\pm$ {fmt(s_p99)}{marker} & "
            f"{fmt(m_qmax, 0)} & "
            f"{fmt(m_tp, 1)} & "
            f"{pct(m_rej)} & "
            f"{fmt(m_rec, 2)} \\\\"
        )
        lines.append(row)
        if algo == "GradientDescent":
            lines.append(r"\midrule")   # separator before P-DARC

    lines += [
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ]
    return "\n".join(lines)

# ── Table 2: All scenarios p99 overview ──────────────────────────────────────

def gen_tab_all_scenarios(data):
    scenarios = ["steady", "step_burst", "pulse_burst",
                 "interference_light", "interference_heavy", "erratic"]
    scen_labels = {
        "steady":             r"\texttt{steady}",
        "step_burst":         r"\texttt{step\_burst}",
        "pulse_burst":        r"\texttt{pulse\_burst}",
        "interference_light": r"\texttt{interf\_light}",
        "interference_heavy": r"\texttt{interf\_heavy}$^\star$",
        "erratic":            r"\texttt{erratic}",
    }
    algos  = ["Fixed Backpressure", "AIMD", "PIE", "P-DARC"]
    labels = {"Fixed Backpressure": "Fixed BP", "AIMD": "AIMD",
              "PIE": "PIE", "P-DARC": r"\pdarc"}

    lines = [
        r"\begin{table}[!t]",
        r"\centering",
        r"\caption{$p_{99}$ latency (ms, mean $\pm$ std, 30 reps) across all six evaluation "
        r"scenarios. $^\star$ = primary RQ1 comparison scenario. "
        r"Dashes indicate recovery time not applicable.}",
        r"\label{tab:all_scenarios_jss}",
        r"\small",
        r"\begin{tabular}{@{}l" + "r" * len(algos) + r"@{}}",
        r"\toprule",
        r"\textbf{Scenario} & " + " & ".join(f"\\textbf{{{labels[a]}}}" for a in algos) + r" \\",
        r"\midrule",
    ]

    for scen in scenarios:
        row_vals = []
        for algo in algos:
            m = get_mean(data, scen, algo, "p99")
            s = get_std(data, scen, algo, "p99")
            if m is None:
                row_vals.append("—")
            else:
                row_vals.append(f"{fmt(m)} $\\pm$ {fmt(s)}")
        lines.append(f"{scen_labels[scen]} & " + " & ".join(row_vals) + r" \\")

    lines += [
        r"\bottomrule",
        r"\end{tabular}",
        r"\end{table}",
    ]
    return "\n".join(lines)

# ── Table 3: Ablation ─────────────────────────────────────────────────────────

def gen_tab_ablation(ablation):
    scen   = "interference_heavy"
    algos  = ["P-DARC", "P-DARC-noI", "P-DARC-staticL", "P-DARC-noEMA",
              "Fixed Backpressure", "AIMD", "PIE"]
    labels = {
        "P-DARC":             r"\pdarc (full)",
        "P-DARC-noI":         r"\pdarc-noI ($\beta{=}0$)",
        "P-DARC-staticL":     r"\pdarc-staticL",
        "P-DARC-noEMA":       r"\pdarc-noEMA",
        "Fixed Backpressure": "Fixed BP",
        "AIMD":               "AIMD",
        "PIE":                "PIE",
    }

    lines = [
        r"\begin{table}[!t]",
        r"\centering",
        r"\caption{Ablation study under \texttt{interference\_heavy} (30 reps). "
        r"$\Delta p_{99}$ relative to \pdarc (full); positive = worse than full controller.}",
        r"\label{tab:ablation_jss}",
        r"\small",
        r"\begin{tabular}{@{}lrrrr@{}}",
        r"\toprule",
        r"\textbf{Algorithm} & \textbf{$p_{99}$ (ms)} & \textbf{$\Delta p_{99}$ (ms)} "
        r"& \textbf{$L_{\max}$} & \textbf{Rej.\,(\%)} \\",
        r"\midrule",
    ]

    base_p99 = get_mean(ablation, scen, "P-DARC", "p99")

    for algo in algos:
        m    = get_mean(ablation, scen, algo, "p99")
        s    = get_std(ablation, scen, algo, "p99")
        qmax = get_mean(ablation, scen, algo, "q_max")
        rej  = get_mean(ablation, scen, algo, "reject_rate")

        delta = (m - base_p99) if (m is not None and base_p99 is not None) else None
        delta_str = f"+{fmt(delta, 0)}" if (delta is not None and delta >= 0) else fmt(delta, 0)

        lines.append(
            f"{labels[algo]} & {fmt(m)} $\\pm$ {fmt(s)} & {delta_str} & "
            f"{fmt(qmax, 0)} & {pct(rej)} \\\\"
        )
        if algo == "P-DARC-noEMA":
            lines.append(r"\midrule")

    lines += [r"\bottomrule", r"\end{tabular}", r"\end{table}"]
    return "\n".join(lines)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    data         = load_json("results_jss_30rep.json")
    merge_gradient_descent(data)
    stat_results = load_json("stat_results.json")
    ablation     = load_json("ablation_jss_30rep.json")

    tables = {
        "tab_main_heavy.tex":    gen_tab_main_heavy(data, stat_results),
        "tab_all_scenarios.tex": gen_tab_all_scenarios(data),
        "tab_ablation.tex":      gen_tab_ablation(ablation),
    }

    for fname, content in tables.items():
        out = RESULTS_DIR / fname
        with open(out, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Written: {out}")

    print("\nDone. Include tables in LaTeX with \\input{path/to/tab_*.tex}")


if __name__ == "__main__":
    main()
