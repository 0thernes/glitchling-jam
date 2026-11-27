"""Generate publication-quality vector PDF figures for paper/main.tex from real measured data."""

from __future__ import annotations

import csv
import math
import sys
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PAPER_DIR = ROOT / "paper"
sys.path.insert(0, str(ROOT))

from reference.glitchling_oracle import (  # noqa: E402
    solve_cry4_haberkorn,
    solve_fmo_forster,
    solve_fmo_gksl,
)

plt.rcParams.update(
    {
        "font.family": "serif",
        "font.size": 9.5,
        "axes.titlesize": 10.5,
        "axes.labelsize": 9.5,
        "xtick.labelsize": 8.5,
        "ytick.labelsize": 8.5,
        "legend.fontsize": 8.2,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "figure.dpi": 300,
    }
)


def t_crit_95(df: int) -> float:
    # Exact two-sided t_{0.975, 29} = 2.045230
    return 2.045230 if df == 29 else 1.96


def fig_results_v3() -> None:
    """Figure 1: Results v3 (n=30, seeds 500-529) paired deltas vs baseline with 95% t-CIs."""
    rows_by_cond: dict[str, dict[int, dict[str, float]]] = {}
    with (ROOT / "results" / "summary.csv").open("r", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            c = r["condition"]
            s = int(r["seed"])
            rows_by_cond.setdefault(c, {})[s] = {
                "forages": float(r["forages"]),
                "success": float(r["successRate"]),
                "half_diff": float(r["secondHalfSuccess"]) - float(r["firstHalfSuccess"]),
            }

    conds = ["misfire", "leaky", "scramble", "all", "all_mild", "backwards"]
    labels = ["misfire\n(jolt/60)", "leaky\n(6%/tick)", "scramble\n(rewire/90)", "all\n(v2 def.)", "all_mild\n(v1 def.)", "backwards\n(8 MOT+mir)"]
    seeds = sorted(rows_by_cond["baseline"].keys())
    n = len(seeds)
    tc = t_crit_95(n - 1)

    df_means, df_cis, ds_means, ds_cis, dz_f, dz_s = [], [], [], [], [], []
    for c in conds:
        d_for = np.array([rows_by_cond[c][s]["forages"] - rows_by_cond["baseline"][s]["forages"] for s in seeds])
        d_suc = np.array([rows_by_cond[c][s]["success"] - rows_by_cond["baseline"][s]["success"] for s in seeds])
        mf, sf = float(np.mean(d_for)), float(np.std(d_for, ddof=1))
        ms, ss = float(np.mean(d_suc)), float(np.std(d_suc, ddof=1))
        df_means.append(mf)
        df_cis.append(tc * sf / math.sqrt(n))
        ds_means.append(ms)
        ds_cis.append(tc * ss / math.sqrt(n))
        dz_f.append(mf / sf)
        dz_s.append(ms / ss)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.2, 4.1), sharey=True)
    y = np.arange(len(conds))
    colors = ["#64748b", "#0284c7", "#0d9488", "#7c3aed", "#9333ea", "#dc2626"]

    ax1.axvline(0.0, color="#334155", lw=1.0, ls="--", alpha=0.8)
    ax1.errorbar(df_means, y, xerr=df_cis, fmt="none", ecolor="#1e293b", elinewidth=1.4, capsize=3.5, zorder=2)
    ax1.scatter(df_means, y, c=colors, s=52, zorder=3, edgecolors="white", linewidths=0.6)
    for i, (m, ci, dz) in enumerate(zip(df_means, df_cis, dz_f)):
        ax1.text(m + ci + 2.2, i, f"{m:+.1f} ($d_z$={dz:.2f})", va="center", fontsize=7.8, color="#0f172a")
    ax1.set_yticks(y)
    ax1.set_yticklabels(labels)
    ax1.set_xlim(-18, 138)
    ax1.set_xlabel("Paired $\\Delta$ Forages vs. Baseline (2 sim-days, 95% $t$-CI)")
    ax1.set_title("(a) Compensatory Foraging Volume ($n=30$ seeds)")
    ax1.grid(axis="x", alpha=0.25, ls=":")

    ax2.axvline(0.0, color="#334155", lw=1.0, ls="--", alpha=0.8)
    ax2.errorbar(ds_means, y, xerr=ds_cis, fmt="none", ecolor="#1e293b", elinewidth=1.4, capsize=3.5, zorder=2)
    ax2.scatter(ds_means, y, c=colors, s=52, zorder=3, edgecolors="white", linewidths=0.6)
    for i, (m, ci, dz) in enumerate(zip(ds_means, ds_cis, dz_s)):
        ax2.text(m - ci - 0.004, i, f"{m:+.3f} ($d_z$={dz:.2f})", va="center", ha="right", fontsize=7.8, color="#0f172a")
    ax2.set_xlim(-0.22, 0.032)
    ax2.set_xlabel("Paired $\\Delta$ Hit Rate vs. Baseline (95% $t$-CI)")
    ax2.set_title("(b) Forage Hit-Rate Cost (210/210 Alive; Repeatable Bun Mode)")
    ax2.grid(axis="x", alpha=0.25, ls=":")

    fig.tight_layout(w_pad=1.6)
    fig.savefig(PAPER_DIR / "fig_results_v3.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_fmo_cry4_oracle() -> None:
    """Figure 2: Exact open-quantum differential physics (FMO ENAQT & Cry4 Liouville-Haberkorn)."""
    temps = np.linspace(-10.0, 54.0, 33)
    gammas = [0.08 if t < -6 else 22.0 * math.exp((t - 24.0) / 9.5) for t in temps]
    fmo_q = [solve_fmo_gksl(g)["sink_eff"] for g in gammas]
    fmo_c = [solve_fmo_forster(g) for g in gammas]

    thetas_deg = np.linspace(0.0, 180.0, 37)
    w_l = 0.176 * 48.5
    cry_zero = [solve_cry4_haberkorn(math.sin(math.radians(t)), 0.0, math.cos(math.radians(t)))["phi_s"] for t in thetas_deg]
    cry_off = [
        solve_cry4_haberkorn(
            math.sin(math.radians(t)), 0.0, math.cos(math.radians(t)), rf_amp_ut=1.5, rf_freq_rad_us=7.0 * w_l
        )["phi_s"]
        for t in thetas_deg
    ]
    cry_res = [
        solve_cry4_haberkorn(
            math.sin(math.radians(t)), 0.0, math.cos(math.radians(t)), rf_amp_ut=1.5, rf_freq_rad_us=w_l
        )["phi_s"]
        for t in thetas_deg
    ]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.2, 3.9))

    ax1.plot(temps, fmo_q, color="#2563eb", lw=2.0, label="GKSL Lindblad (49$\\times$49 exact)")
    ax1.plot(temps, fmo_c, color="#ea580c", lw=1.7, ls="--", label="Zero-param Pauli–Förster (7$\\times$7)")
    ax1.scatter([24.0], [solve_fmo_gksl(22.0)["sink_eff"]], color="#2563eb", s=34, zorder=4)
    ax1.annotate(
        "ENAQT peak (24 °C)\n0.8109 vs 0.8056",
        xy=(24.0, 0.8109),
        xytext=(4.0, 0.60),
        arrowprops=dict(arrowstyle="->", color="#334155", lw=0.9),
        fontsize=8.0,
    )
    ax1.annotate(
        "Classical limit\n(gap $1.3\\times 10^{-5}$)",
        xy=(54.0, 0.6388),
        xytext=(34.0, 0.44),
        arrowprops=dict(arrowstyle="->", color="#334155", lw=0.9),
        fontsize=8.0,
    )
    ax1.set_xlabel(r"Leaf Temperature $T$ ($^\circ$C)")
    ax1.set_ylabel(r"Reaction-Center Sink Yield $\Phi_{\mathrm{sink}}$")
    ax1.set_title("(a) 7-Site FMO ENAQT (JS–Python diff $3.44\\times 10^{-15}$)")
    ax1.set_ylim(0.20, 0.88)
    ax1.legend(loc="lower right", frameon=True, framealpha=0.92)
    ax1.grid(alpha=0.25, ls=":")

    ax2.plot(thetas_deg, cry_zero, color="#0f766e", lw=2.0, label="Geomagnetic $B_0=48.5\\,\\mu$T (no RF)")
    ax2.plot(thetas_deg, cry_off, color="#7c3aed", lw=1.6, ls="-.", label=r"Off-resonant RF ($7\omega_L$, $1.5\,\mu$T)")
    ax2.plot(thetas_deg, cry_res, color="#dc2626", lw=1.9, ls="--", label=r"Resonant Larmor RF ($\omega_L$, $1.5\,\mu$T)")
    ax2.axvline(90.0, color="#64748b", lw=0.9, ls=":")
    ax2.set_xlabel(r"Geomagnetic Inclination Angle $\theta$ (degrees)")
    ax2.set_ylabel(r"Singlet Quantum Yield $\Phi_S(\theta)$")
    ax2.set_title("(b) 8$\\times$8 Cry4 Haberkorn Parity (JS–Python diff $9.99\\times 10^{-16}$)")
    ax2.set_xlim(0, 180)
    ax2.set_ylim(0.22, 0.62)
    ax2.set_xticks([0, 45, 90, 135, 180])
    ax2.legend(loc="upper center", frameon=True, framealpha=0.95, fontsize=7.8)
    ax2.grid(alpha=0.25, ls=":")

    fig.tight_layout(w_pad=1.8)
    fig.savefig(PAPER_DIR / "fig_fmo_cry4_oracle.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_lesion_forest() -> None:
    """Figure 3: Multi-cohort standardized paired effect sizes (d_z) by claim tier ([M]/[D] vs [E])."""
    items = [
        ("T14b [E]: Rao–Ballard PC error cut", 7.26, "E"),
        ("T10b [D]: Shoggoth Level-2 Bayes payoff", 6.79, "D"),
        ("T13a [E]: Divergent thermOpt (Warm$-$Cool)", 6.71, "E"),
        ("T5b [M+D]: Quantum CHSH > 75% ceiling", 5.62, "M"),
        ("T14a [E]: Transformer-XL WM MSE cut", 5.19, "E"),
        ("T4 [M]: C3 cospectral QGT vs Spectral", 5.03, "M"),
        ("T15a [D]: Social alarm predations cut", 4.48, "D"),
        ("T9 [M+D]: RS[15,11] burst ECC survival", 4.17, "M"),
        ("T10a [D]: Titan IPD sanctioned payoff", 3.83, "D"),
        ("T14d [E]: DeltaFixed vs Superpose HDC", 3.68, "E"),
        ("T12b [D]: Per-dim Kuleshov 10-bin ECE", 3.54, "D"),
        ("T12d [E]: 3-edge TE vs motor-lesioned", 3.51, "E"),
        ("T15b [E]: 3-trophic Ecology-of-Fear fruit", 3.26, "E"),
        ("T12c [E]: 3-edge TE vs circular null", 3.10, "E"),
        ("T13b [E]: Divergent shift vs Neutral Shadow", 2.80, "E"),
        ("T14c [E]: Wiener vs DeltaFixed HDC", 2.52, "E"),
        ("T3a [M+D]: Cry4 night HD lesion error", 2.44, "M"),
        ("T7a [M+D]: NESTOR adaptive vs 1-bit NLL", 2.38, "M"),
        ("T12a [D]: Prequential proper Gaussian NLL", 2.05, "D"),
        ("T1 [M+D]: Solar PAR N2 fixation", 1.90, "M"),
        ("T11 [E]: Bedau–Packard activity vs Shadow", 1.45, "E"),
        ("T3b [M+D]: Cry4 resonant vs 7$\\omega_L$ RF", 1.19, "M"),
    ]
    items.reverse()
    labels = [x[0] for x in items]
    dzs = [x[1] for x in items]
    tier_colors = {"M": "#2563eb", "D": "#d97706", "E": "#059669"}
    cols = [tier_colors[x[2]] for x in items]

    fig, ax = plt.subplots(figsize=(9.6, 5.8))
    y = np.arange(len(items))
    ax.hlines(y, 0.0, dzs, color=cols, lw=2.0, alpha=0.85)
    ax.scatter(dzs, y, color=cols, s=44, zorder=3)
    for i, dz in enumerate(dzs):
        ax.text(dz + 0.12, i, f"{dz:.2f}", va="center", fontsize=7.6, color="#0f172a")
    ax.set_yticks(y)
    ax.set_yticklabels(labels, fontsize=8.0)
    ax.set_xlim(0, 8.2)
    ax.set_xlabel(r"Combined $N=24$ Paired Cohen's $d_z$ (All 26/26 Pass Full Bonferroni, $p_{\mathrm{Bonf},24} \leq 1.93\times 10^{-4}$)")
    ax.set_title("Multi-Cohort Lesion & Emergent Artificial-Life Effect Sizes Separated by Claim Tier")
    ax.grid(axis="x", alpha=0.25, ls=":")

    from matplotlib.lines import Line2D

    handles = [
        Line2D([0], [0], color="#059669", marker="o", lw=2, label="[E] Emergent adaptive / learning / trophic"),
        Line2D([0], [0], color="#d97706", marker="o", lw=2, label="[D] Designed causal lesion / control"),
        Line2D([0], [0], color="#2563eb", marker="o", lw=2, label="[M]/[M+D] Mathematical identity + closed-loop wiring"),
    ]
    ax.legend(handles=handles, loc="lower right", frameon=True, framealpha=0.95)
    fig.tight_layout()
    fig.savefig(PAPER_DIR / "fig_lesion_forest.pdf", bbox_inches="tight")
    plt.close(fig)


def fig_verification_pyramid() -> None:
    """Figure 4: Five-tier Glitchling v2.4.0 Verification Pyramid & Audit Hardening Progression."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10.2, 3.7), gridspec_kw={"width_ratios": [1.25, 1.0]})

    # Left: Horizontal stacked verification tiers
    tiers = [
        ("Tier 1: Lean 4.35.0 (6 Kernels)", "72 decls · 11 module files · 0 sorry · live tamper CI", "#1d4ed8"),
        ("Tier 2: Python Exact Oracle", "Kronecker + Fraction · JS diff < 3.5e-15 · pytest 9/9", "#0f766e"),
        ("Tier 3: JS Verification Ladder", "1,200 props · 7 reg · 8/8 mutants · 20/20 FULL", "#7c3aed"),
        ("Tier 4: 3-OS CI & Provenance", "9/9 check.mjs · 18/18 DOIs · RFC 3161 + OTS · SLSA", "#b45309"),
        ("Tier 5: Statistical Cohorts", "Results v3 (n=30) · T1-T15 (N=24+12) · T5 Z<4.26", "#be123c"),
    ]
    ax1.set_xlim(0, 10)
    ax1.set_ylim(-0.5, len(tiers) - 0.3)
    ax1.axis("off")
    ax1.set_title("(a) Five-Tier Epistemic Verification Architecture", pad=8)
    for idx, (title, detail, color) in enumerate(reversed(tiers)):
        width = 9.4 - idx * 0.65
        x0 = (10.0 - width) / 2.0
        rect = plt.Rectangle((x0, idx - 0.36), width, 0.72, facecolor=color, alpha=0.14, edgecolor=color, lw=1.6)
        ax1.add_patch(rect)
        ax1.text(5.0, idx + 0.11, title, ha="center", va="center", fontweight="bold", fontsize=8.8, color=color)
        ax1.text(5.0, idx - 0.15, detail, ha="center", va="center", fontsize=7.6, color="#1e293b")

    # Right: Build Standard v1.2.0 compliance progression
    stages = ["v2.1.0\nBaseline\n(Nov 24)", "v2.2.0\nCycle 1–2\n(Pre-Manifest)", "v2.4.0\nFinal\n(Nov 26)"]
    scores = [27.3, 98.7, 100.0]
    core_scores = [34.8, 100.0, 100.0]
    x = np.arange(len(stages))
    w = 0.36
    b1 = ax2.bar(x - w / 2 - 0.02, scores, width=w, color="#2563eb", label="All Applicable Items")
    b2 = ax2.bar(x + w / 2 + 0.02, core_scores, width=w, color="#059669", label="Core Items")
    for bars in (b1, b2):
        for bar in bars:
            h = bar.get_height()
            ax2.text(
                bar.get_x() + bar.get_width() / 2,
                h + 2.0,
                f"{h:.1f}%",
                ha="center",
                va="bottom",
                fontsize=7.0,
            )
    ax2.set_xticks(x)
    ax2.set_xticklabels(stages)
    ax2.set_ylim(0, 114)
    ax2.set_ylabel("Build Standard v1.2.0 Score (%)")
    ax2.set_title("(b) Build Standard v1.2.0 Audit Progression")
    ax2.legend(loc="lower right", frameon=True, framealpha=0.92)
    ax2.grid(axis="y", alpha=0.25, ls=":")

    fig.tight_layout(w_pad=1.5)
    fig.savefig(PAPER_DIR / "fig_verification_pyramid.pdf", bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    PAPER_DIR.mkdir(parents=True, exist_ok=True)
    fig_results_v3()
    fig_fmo_cry4_oracle()
    fig_lesion_forest()
    fig_verification_pyramid()
    print("Generated 4 vector PDF figures in paper/.")


if __name__ == "__main__":
    main()
