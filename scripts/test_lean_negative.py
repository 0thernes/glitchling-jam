"""Live negative-tamper Lean 4 verification test.

Copies `lean/` into an isolated temporary directory, injects a fake `sorry` proof
into `Solution.lean`, and verifies that:
  1. `VerifyAxioms.lean` detects `sorryAx` (non-empty forbidden axiom set).
  2. `lake comparator --config comparator.json --paranoid` (when `--with-comparator`
     is passed on Ubuntu CI) rejects the tampered solution with non-zero exit code.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEAN_DIR = ROOT / "lean"


def find_lake() -> str:
    found = shutil.which("lake")
    if found:
        return found
    win = Path.home() / ".elan" / "bin" / "lake.exe"
    if win.exists():
        return str(win)
    unix = Path.home() / ".elan" / "bin" / "lake"
    if unix.exists():
        return str(unix)
    raise FileNotFoundError("lake executable not found on PATH or ~/.elan/bin")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--with-comparator",
        action="store_true",
        help="Also assert that `lake comparator --config comparator.json --paranoid` rejects the tampered proof",
    )
    args = parser.parse_args()
    lake = find_lake()

    with tempfile.TemporaryDirectory(prefix="glitchling_tamper_") as tmp:
        work = Path(tmp) / "lean"
        shutil.copytree(
            LEAN_DIR,
            work,
            ignore=shutil.ignore_patterns(".lake", "build"),
        )
        sol_path = work / "Solution.lean"
        sol_src = sol_path.read_text(encoding="utf-8")
        marker = "public theorem target_thm8_flaws_and_nonvacuity :"
        idx = sol_src.find(marker)
        if idx < 0:
            raise RuntimeError("Could not locate target_thm8_flaws_and_nonvacuity in Solution.lean")
        end_marker = "public theorem target_thm9_adversarial_and_nonvacuity :"
        idx2 = sol_src.find(end_marker)
        if idx2 < 0:
            raise RuntimeError("Could not locate target_thm9_adversarial_and_nonvacuity in Solution.lean")

        tampered_thm8 = (
            "public theorem target_thm8_flaws_and_nonvacuity :\n"
            "    (∀ k : Nat, k < 16 → mirrorSite k < 16 ∧ mirrorSite (mirrorSite k) = k ∧ mirrorSite k ≠ k) ∧\n"
            "    (∀ v p lam S : Int, leakyNextNum v p lam S - S * p = (S - lam) * (v - p)) ∧\n"
            "    (gf16Mul ⟨3, by omega⟩ ⟨5, by omega⟩ = ⟨15, by omega⟩ ∧\n"
            "     clausiusEntropyNum 10 5 2 280 300 350 = 1064000 ∧\n"
            "     mobiusDen 3 4 1 2 10 = 12325 ∧\n"
            "     mirrorSite 0 = 15) := by\n"
            "  sorry\n\n"
        )
        sol_path.write_text(sol_src[:idx] + tampered_thm8 + sol_src[idx2:], encoding="utf-8", newline="\n")

        # 0. Deliberately false theorem MUST be rejected by Lean 4.35.0 kernel (Playbook v1.3 Item 12)
        false_file = work / "DeliberatelyFalseCheck.lean"
        false_file.write_text(
            "module\n"
            "public theorem deliberately_false_rs_distance : (15 : Nat) - 11 + 1 = 6 := by rfl\n",
            encoding="utf-8",
            newline="\n",
        )
        false_run = subprocess.run(
            [lake, "env", "lean", "DeliberatelyFalseCheck.lean"],
            cwd=str(work),
            capture_output=True,
            text=True,
        )
        if false_run.returncode == 0:
            raise AssertionError("Negative test failed: Lean 4.35.0 kernel ACCEPTED a deliberately false theorem!")
        false_file.unlink()

        # Build tampered Solution cleanly (staged sequentially so peak RAM stays bounded on Windows)
        for target_batch in (
            ["GlitchlingProofs.Spec"],
            ["GlitchlingProofs.EnergyMassConservation"],
            ["GlitchlingProofs.QuantumContextuality"],
            ["GlitchlingProofs.CodingAndGovernance"],
            ["GlitchlingProofs.HyperbolicAndFlaws"],
            ["GlitchlingProofs", "Challenge", "Solution"],
        ):
            proc_build = subprocess.run(
                [lake, "build", *target_batch],
                cwd=str(work),
                capture_output=True,
                text=True,
            )
            if proc_build.returncode != 0:
                raise RuntimeError(
                    f"Tampered lake build {target_batch} failed ({proc_build.returncode}):\n"
                    f"{proc_build.stdout}\n{proc_build.stderr}"
                )

        # 1. VerifyAxioms MUST expose sorryAx on target_thm8_flaws_and_nonvacuity
        audit = subprocess.run(
            [lake, "env", "lean", "VerifyAxioms.lean"],
            cwd=str(work),
            capture_output=True,
            text=True,
            check=True,
        )
        combined_audit = (audit.stdout or "") + "\n" + (audit.stderr or "")
        if "sorryAx" not in combined_audit:
            raise AssertionError("Negative test failed: VerifyAxioms.lean did NOT report sorryAx on tampered Solution!")

        # 2. Optional Palomar 6-kernel comparator MUST reject tampered Solution with non-zero exit
        comp_status = "skipped (pass --with-comparator on Linux CI)"
        if args.with_comparator:
            comp = subprocess.run(
                [lake, "comparator", "--config", "comparator.json", "--paranoid"],
                cwd=str(work),
                capture_output=True,
                text=True,
                check=False,
            )
            if comp.returncode == 0:
                raise AssertionError("Negative test failed: lake comparator ACCEPTED a sorry-tampered Solution!")
            comp_status = f"REJECTED tampered Solution cleanly (exit={comp.returncode})"

        print(
            f"PASS: Live negative tamper check detected `sorryAx` via VerifyAxioms.lean; "
            f"comparator={comp_status}."
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
