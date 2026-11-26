"""End-to-end exact verification, differential JS-vs-Python oracle check, Lean static audit,
and results/summary.csv consistency audit for Glitchling v2.2.0.
"""

from __future__ import annotations

import csv
import json
import math
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from reference.glitchling_oracle import (  # noqa: E402
    poincare_dist,
    poincare_mobius_add_exact,
    rs15_11_encode,
    rs15_11_syndromes,
    solve_cry4_haberkorn,
    solve_fmo_forster,
    solve_fmo_gksl,
    verify_c3_cospectral_exact,
    verify_cega18_exact,
    verify_hoggar_exact,
)


def strip_lean_comments_and_strings(src: str) -> str:
    """Strip nested Lean block comments `/- ... -/`, line comments `-- ...`, and string literals."""
    out: list[str] = []
    i = 0
    n = len(src)
    block_depth = 0
    in_str = False
    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if block_depth > 0:
            if ch == "/" and nxt == "-":
                block_depth += 1
                i += 2
            elif ch == "-" and nxt == "/":
                block_depth -= 1
                i += 2
            else:
                if ch == "\n":
                    out.append("\n")
                i += 1
            continue
        if in_str:
            if ch == "\\" and i + 1 < n:
                i += 2
            elif ch == '"':
                in_str = False
                i += 1
            else:
                i += 1
            continue
        if ch == "/" and nxt == "-":
            block_depth = 1
            i += 2
        elif ch == "-" and nxt == "-":
            while i < n and src[i] != "\n":
                i += 1
        elif ch == '"':
            in_str = True
            out.append('""')
            i += 1
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def audit_lean_static() -> dict[str, int]:
    """Static hygiene audit across all `.lean` files in `lean/`."""
    lean_dir = ROOT / "lean"
    lean_files = sorted(lean_dir.rglob("*.lean"))
    lean_files = [p for p in lean_files if ".lake" not in p.parts]
    forbidden = ("sorry", "admit", "axiom ", "native_decide", "unsafe ", "implemented_by", "extern ")
    checked = 0
    for path in lean_files:
        text = path.read_text(encoding="utf-8")
        cleaned = strip_lean_comments_and_strings(text)
        if path.name == "Challenge.lean":
            imports = [ln.strip() for ln in cleaned.splitlines() if ln.strip().startswith("import ")]
            if imports != ["import GlitchlingProofs.Spec"]:
                raise AssertionError(f"Challenge.lean must import ONLY GlitchlingProofs.Spec, got {imports}")
            continue
        for tok in forbidden:
            if tok in cleaned:
                raise AssertionError(f"Forbidden token {tok!r} found in {path.relative_to(ROOT)}")
        checked += 1
    return {"lean_proof_files_clean": checked}


def differential_js_vs_python() -> dict[str, float]:
    """Cross-check live/ JS implementations against the independent Python reference oracle (`B11`, `B12`)."""
    js_script = r"""
    import { encodeNeuraleseRS15_11, decodeNeuraleseRS15_11, solveCry4Haberkorn8x8 } from './js/sim/heptarch.js';
    import { solveFMOLindbladExact, solveFMOForsterExact } from './js/sim/world.js';
    import { evalCospectralTwins, poincareMobiusAdd, poincareDist } from './js/tsotchke/qgtl.js';

    const msg = [3, 14, 1, 5, 9, 2, 6, 5, 3, 5, 10];
    const cw = Array.from(encodeNeuraleseRS15_11(msg));
    const corrupted = cw.slice();
    corrupted[2] ^= 7;
    corrupted[13] ^= 11;
    const dec = decodeNeuraleseRS15_11(corrupted);

    const fmo = [0.08, 22.0, 518.0].map((g) => ({
      g,
      gksl: solveFMOLindbladExact(g),
      forster: solveFMOForsterExact(g),
    }));

    const cry4 = [
      { b: [0, 0, 1], opts: {} },
      { b: [0, 0, -1], opts: {} },
      { b: [1, 0, 0], opts: {} },
      { b: [0.6, 0.3, 0.7416198487095663], opts: { gammaSpin: 0.4 } },
      { b: [0, 0, 1], opts: { rfAmpUT: 1.5, rfFreqRadUs: 0.176 * 48.5 } },
    ].map(({ b, opts }) => ({ b, opts, res: solveCry4Haberkorn8x8(b[0], b[1], b[2], opts) }));

    const twins = evalCospectralTwins();
    const mob = poincareMobiusAdd(0.3, -0.4, -0.2, 0.5);
    const pdist = poincareDist(0.3, -0.4, -0.2, 0.5);

    console.log(JSON.stringify({
      cw,
      decMsg: Array.from(dec.msg),
      decCorrected: dec.correctedSymbols,
      fmo,
      cry4,
      twins: {
        sectionSize: twins.sectionSize,
        outsideSize: twins.outsideSize,
        tr2_0: twins.lambdaTr2Sigma0,
        tr2_1: twins.lambdaTr2Sigma1,
        tr3_0: twins.lambdaTr3Sigma0,
        tr3_1: twins.lambdaTr3Sigma1,
        eigDiff: twins.carrierEigMaxDiff,
      },
      mob,
      pdist,
    }));
    """
    proc = subprocess.run(
        ["node", "--input-type=module", "-e", js_script],
        cwd=str(ROOT / "live"),
        capture_output=True,
        text=True,
        check=True,
    )
    js = json.loads(proc.stdout)

    # 1. RS[15,11] exact codeword equality + 2-symbol burst recovery
    py_cw = rs15_11_encode([3, 14, 1, 5, 9, 2, 6, 5, 3, 5, 10])
    assert js["cw"] == py_cw, f"RS[15,11] codeword mismatch: JS={js['cw']} vs Py={py_cw}"
    assert rs15_11_syndromes(py_cw) == [0, 0, 0, 0]
    assert js["decMsg"] == [3, 14, 1, 5, 9, 2, 6, 5, 3, 5, 10] and js["decCorrected"] == 2

    # 2. FMO GKSL & secular Pauli-Forster differential comparison
    max_fmo_err = 0.0
    for row in js["fmo"]:
        g = float(row["g"])
        py_g = solve_fmo_gksl(g)
        py_f = solve_fmo_forster(g)
        max_fmo_err = max(
            max_fmo_err,
            abs(row["gksl"]["sinkEff"] - py_g["sink_eff"]),
            abs(row["gksl"]["quantumYieldSum"] - py_g["yield_sum"]),
            abs(row["forster"] - py_f),
        )
    assert max_fmo_err < 1e-12, f"FMO JS-vs-Python error too large: {max_fmo_err}"

    # 3. Cry4 8x8 Liouville-Haberkorn differential comparison
    max_cry4_err = 0.0
    for row in js["cry4"]:
        bx, by, bz = row["b"]
        opts = row["opts"]
        py_c = solve_cry4_haberkorn(
            bx,
            by,
            bz,
            gamma_spin=float(opts.get("gammaSpin", 0.0)),
            rf_amp_ut=float(opts.get("rfAmpUT", 0.0)),
            rf_freq_rad_us=opts.get("rfFreqRadUs"),
        )
        max_cry4_err = max(
            max_cry4_err,
            abs(row["res"]["phiS"] - py_c["phi_s"]),
            abs(row["res"]["phiT"] - py_c["phi_t"]),
            abs(row["res"]["yieldSum"] - py_c["yield_sum"]),
        )
    assert max_cry4_err < 1e-12, f"Cry4 JS-vs-Python error too large: {max_cry4_err}"

    # 4. C3 cospectral twins exact match
    py_c3 = verify_c3_cospectral_exact()
    assert js["twins"]["sectionSize"] == py_c3["section_size"] == 71
    assert js["twins"]["outsideSize"] == py_c3["outside_size"] == 64
    assert js["twins"]["tr2_0"] == py_c3["tr2_sigma0"] == 2240
    assert js["twins"]["tr2_1"] == py_c3["tr2_sigma1"] == 2240
    assert js["twins"]["tr3_0"] == py_c3["tr3_sigma0"] == 14976
    assert js["twins"]["tr3_1"] == py_c3["tr3_sigma1"] == 15360

    # 5. Poincare Mobius addition & distance differential comparison
    mx, my = poincare_mobius_add_exact(
        Fraction(3, 10), Fraction(-4, 10), Fraction(-2, 10), Fraction(5, 10)
    )
    max_poincare_err = max(
        abs(js["mob"][0] - float(mx)),
        abs(js["mob"][1] - float(my)),
        abs(js["pdist"] - poincare_dist(0.3, -0.4, -0.2, 0.5)),
    )
    assert max_poincare_err < 1e-14, f"Poincare JS-vs-Python error too large: {max_poincare_err}"

    return {
        "max_fmo_err": max_fmo_err,
        "max_cry4_err": max_cry4_err,
        "max_poincare_err": max_poincare_err,
    }


def audit_results_v3_csv() -> dict[str, int | float]:
    """Verify Results v3 CSV schema, completeness (210 rows = 7 x 30 seeds 500..529), and invariants."""
    csv_path = ROOT / "results" / "summary.csv"
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 210, f"Expected 210 rows, got {len(rows)}"
    conds = sorted({r["condition"] for r in rows})
    assert conds == ["all", "all_mild", "backwards", "baseline", "leaky", "misfire", "scramble"]
    alive_count = sum(1 for r in rows if r["alive"] == "true")
    assert alive_count == 210
    base_for = [int(r["forages"]) for r in rows if r["condition"] == "baseline"]
    all_for = [int(r["forages"]) for r in rows if r["condition"] == "all"]
    mean_base = sum(base_for) / len(base_for)
    mean_all = sum(all_for) / len(all_for)
    assert math.isclose(mean_base, 209.2666667, rel_tol=1e-4)
    assert math.isclose(mean_all, 255.0333333, rel_tol=1e-4)
    return {
        "rows": len(rows),
        "alive": alive_count,
        "baseline_forages_mean": round(mean_base, 3),
        "all_forages_mean": round(mean_all, 3),
    }


def main() -> None:
    cega = verify_cega18_exact()
    assert cega["ortho_ok"] is True
    assert cega["all_multiplicity_two"] is True
    assert cega["classical_max"] == 8

    hoggar = verify_hoggar_exact()
    assert hoggar["total_lines"] == 315
    assert hoggar["violated_lines"] == 63
    assert hoggar["beta_nchv"] == 189
    assert hoggar["hi_4g"] == Fraction(4, 9)
    assert hoggar["lo_4g"] == Fraction(2, 9)

    diff = differential_js_vs_python()
    lean_stat = audit_lean_static()
    res_v3 = audit_results_v3_csv()

    report = {
        "cega18": cega,
        "hoggar": {k: str(v) for k, v in hoggar.items()},
        "differential_js_vs_python": diff,
        "lean_static_audit": lean_stat,
        "results_v3_audit": res_v3,
        "status": "PASS",
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
