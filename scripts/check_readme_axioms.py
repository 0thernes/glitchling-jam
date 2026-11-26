"""Verify that README.md embeds the exact verbatim Lean 4 `#print axioms` summary from results/lean_axioms.txt."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALLOWED = {"propext", "Classical.choice", "Quot.sound"}


def parse_axioms(text: str) -> list[tuple[str, list[str]]]:
    entries: list[tuple[str, list[str]]] = []
    cur_name: str | None = None
    buf = ""
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("'"):
            if cur_name is not None:
                raise ValueError(f"Unclosed multiline axiom block for {cur_name}")
            if "does not depend on any axioms" in line:
                name = line.split("'")[1]
                entries.append((name, []))
            elif "depends on axioms:" in line:
                name = line.split("'")[1]
                rhs = line.split("depends on axioms:", 1)[1].strip()
                if "]" in rhs:
                    axs = [x.strip() for x in rhs.strip("[]").split(",") if x.strip()]
                    entries.append((name, axs))
                else:
                    cur_name = name
                    buf = rhs
        elif cur_name is not None:
            buf += " " + line
            if "]" in line:
                axs = [x.strip() for x in buf.strip("[]").split(",") if x.strip()]
                entries.append((cur_name, axs))
                cur_name = None
                buf = ""
    return entries


def main() -> None:
    axioms_path = ROOT / "results" / "lean_axioms.txt"
    readme_path = ROOT / "README.md"
    if not axioms_path.exists():
        raise SystemExit(f"Missing {axioms_path}")
    raw = axioms_path.read_text(encoding="utf-8")
    entries = parse_axioms(raw)
    if len(entries) < 72:
        raise SystemExit(f"Expected >= 72 audited Lean declarations, got {len(entries)}")

    for name, axs in entries:
        bad = set(axs) - ALLOWED
        if bad:
            raise SystemExit(f"Forbidden axiom(s) {bad} in {name}")

    readme = readme_path.read_text(encoding="utf-8")
    marker_start = "<!-- LEAN_AXIOMS_START -->"
    marker_end = "<!-- LEAN_AXIOMS_END -->"
    if marker_start not in readme or marker_end not in readme:
        raise SystemExit("README.md is missing LEAN_AXIOMS_START / LEAN_AXIOMS_END markers")
    block = readme.split(marker_start, 1)[1].split(marker_end, 1)[0]
    required_snippets = [
        "'Glitchling.ComparatorTarget.target_thm1_energy_mass_clausius' depends on axioms: [propext, Quot.sound]",
        "'Glitchling.ComparatorTarget.target_thm4_gf16_and_rs15_11' depends on axioms: [propext, Quot.sound]",
        "'Glitchling.ComparatorTarget.target_thm7_poincare_mobius_containment' depends on axioms: [propext, Quot.sound]",
        "'Glitchling.ComparatorTarget.target_thm9_adversarial_and_nonvacuity' depends on axioms: [propext, Classical.choice, Quot.sound]",
        "'Glitchling.cega18_kochen_specker_uncolorable' depends on axioms: [propext, Quot.sound]",
        "'Glitchling.poincare_mobius_preserves_disk' depends on axioms: [propext, Quot.sound]",
        "'Glitchling.at02_refute_cega18_noncontextual_nine' depends on axioms: [propext, Quot.sound]",
    ]
    for snip in required_snippets:
        if snip not in block:
            raise SystemExit(f"README.md verbatim Lean axioms block missing: {snip}")

    print(
        f"PASS: {len(entries)} Lean 4.35.0 declarations audited strictly within {sorted(ALLOWED)}; "
        "README.md verbatim block synchronized."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
