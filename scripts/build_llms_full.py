"""Generate offline llms-full.txt digest bundle for LLM/agent consumption (`Build Standard A32`)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SECTIONS = [
    "README.md",
    "AGENTS.md",
    "CLAIMS.md",
    "LIMITATIONS.md",
    "REPLICATION.md",
    "VERIFICATION.md",
    "docs/MEGA_ATLAS_CROSSCHECK.md",
    "docs/statement-fidelity.md",
    "docs/benchmarks.md",
    "docs/reviews/2026-11-25-3cycle-hardening-audit.md",
    "results/lean_axioms.txt",
]


def main() -> None:
    parts = [
        "# Glitchling (0thernes/glitchling-jam, v2.2.0) — Full Offline Context Bundle\n",
        "Generated automatically by `scripts/build_llms_full.py`.\n",
    ]
    for rel in SECTIONS:
        p = ROOT / rel
        if p.exists():
            parts.append(f"\n{'=' * 78}\nFILE: {rel}\n{'=' * 78}\n")
            parts.append(p.read_text(encoding="utf-8", errors="replace").strip() + "\n")
    out = ROOT / "llms-full.txt"
    out.write_text("\n".join(parts), encoding="utf-8", newline="\n")
    print(f"Wrote {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
