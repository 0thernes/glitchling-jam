"""Verify that every Lean declaration referenced in blueprint/blueprint.json exists verbatim
in lean/ source files AND in results/lean_axioms.txt (Blueprint checkdecls fidelity gate).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BP_JSON = ROOT / "blueprint" / "blueprint.json"
AXIOMS_TXT = ROOT / "results" / "lean_axioms.txt"
LEAN_DIR = ROOT / "lean"


def main() -> None:
    if not BP_JSON.exists():
        raise FileNotFoundError(f"Missing {BP_JSON}")
    bp = json.loads(BP_JSON.read_text(encoding="utf-8"))
    nodes = bp.get("nodes", [])
    assert len(nodes) >= 15, f"Expected >= 15 blueprint nodes, got {len(nodes)}"

    axioms_raw = AXIOMS_TXT.read_text(encoding="utf-8")
    audited_names = set(re.findall(r"'([^']+)'\s+(?:depends on axioms:|does not depend on any axioms)", axioms_raw))

    lean_corpus = "\n".join(
        p.read_text(encoding="utf-8")
        for p in sorted(LEAN_DIR.rglob("*.lean"))
        if ".lake" not in p.parts
    )

    node_ids = {n["id"] for n in nodes}
    checked_decls = 0
    for node in nodes:
        for dep in node.get("uses", []):
            assert dep in node_ids, f"Blueprint node {node['id']} references unknown dependency {dep}"
        for decl in node.get("lean_decls", []):
            short = decl.rsplit(".", 1)[-1]
            assert re.search(rf"\b(?:theorem|def|structure|inductive)\s+{re.escape(short)}\b", lean_corpus), (
                f"Blueprint decl {decl!r} not found in lean/ sources!"
            )
            if node.get("kind") != "definition":
                assert decl in audited_names, f"Blueprint theorem {decl!r} missing from results/lean_axioms.txt!"
            checked_decls += 1

    print(
        f"PASS: Blueprint checkdecls verified {len(nodes)} nodes and {checked_decls} Lean 4.35.0 "
        "declarations against lean/ sources and results/lean_axioms.txt."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
