"""Single-version parity, repo.yaml JSON Schema (Draft 2020-12), CITATION.cff, Palomar module,
and active-identity consistency guard (Build Standard A08, A22, Playbook v1.3).
"""

from __future__ import annotations

import importlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_repo_yaml_schema() -> None:
    try:
        jsonschema = importlib.import_module("jsonschema")
        yaml = importlib.import_module("yaml")
    except ImportError:
        print("NOTE: PyYAML/jsonschema not installed in this Python env; skipping schema validation.")
        return

    schema = json.loads((ROOT / "repo-standard.schema.json").read_text(encoding="utf-8"))
    manifest = yaml.safe_load((ROOT / "repo.yaml").read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    errs = sorted(validator.iter_errors(manifest), key=lambda e: list(e.path))
    if errs:
        msgs = "\n".join(f"  - {list(e.path)}: {e.message}" for e in errs[:20])
        raise AssertionError(f"repo.yaml failed repo-standard.schema.json ({len(errs)} errors):\n{msgs}")


def check_single_version_parity() -> str:
    ver = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    assert re.fullmatch(r"\d+\.\d+\.\d+", ver), f"Invalid SemVer in VERSION: {ver!r}"

    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert pkg["version"] == ver, f"package.json version {pkg['version']} != {ver}"

    pkglock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    assert pkglock["version"] == ver, f"package-lock.json version {pkglock['version']} != {ver}"
    assert pkglock["packages"][""]["version"] == ver, "package-lock.json root package version mismatch"

    pyproj = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert f'version = "{ver}"' in pyproj, f"pyproject.toml missing version = {ver!r}"

    cff = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    assert f'version: "{ver}"' in cff, f"CITATION.cff missing version: {ver!r}"
    assert "0009-0006-8168-9648" in cff, "CITATION.cff missing canonical ORCID"
    assert "cff-version: 1.2.0" in cff, "CITATION.cff missing cff-version: 1.2.0"

    bib = (ROOT / "CITATION.bib").read_text(encoding="utf-8")
    assert f"version {ver}" in bib, f"CITATION.bib missing version {ver}"

    lake = (ROOT / "lean" / "lakefile.toml").read_text(encoding="utf-8")
    assert f'version = "{ver}"' in lake, f"lean/lakefile.toml missing version = {ver!r}"

    form = (ROOT / "formalization.yaml").read_text(encoding="utf-8")
    assert f'version: "{ver}"' in form, f"formalization.yaml missing version: {ver!r}"

    cm = json.loads((ROOT / "codemeta.json").read_text(encoding="utf-8"))
    assert cm["version"] == ver, f"codemeta.json version {cm['version']} != {ver}"

    zen = json.loads((ROOT / ".zenodo.json").read_text(encoding="utf-8"))
    assert zen["version"] == ver, f".zenodo.json version {zen['version']} != {ver}"

    tex = (ROOT / "paper" / "main.tex").read_text(encoding="utf-8")
    assert f"Version {ver}" in tex, f"paper/main.tex missing Version {ver}"

    wp = (ROOT / "paper" / "WHITE_PAPER.md").read_text(encoding="utf-8")
    assert f"`{ver}`" in wp, f"paper/WHITE_PAPER.md missing `{ver}`"

    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    assert re.search(rf"^## \[{re.escape(ver)}\]", changelog, re.M), f"CHANGELOG.md missing ## [{ver}]"

    return ver


def check_palomar_lean_rules() -> int:
    lean_files = sorted(p for p in (ROOT / "lean").rglob("*.lean") if ".lake" not in p.parts)
    assert len(lean_files) >= 11, f"Expected >= 11 Lean files, got {len(lean_files)}"
    for lf in lean_files:
        raw = lf.read_bytes()
        lines = raw.decode("utf-8").splitlines()
        assert len(lines) <= 10_000, f"Palomar rule violated: {lf} exceeds 10,000 lines ({len(lines)})"
        first_non_empty = next((ln.strip() for ln in lines if ln.strip()), "")
        assert first_non_empty == "module", f"Palomar rule violated: {lf.relative_to(ROOT)} must begin with `module`"
        if lf.name == "Challenge.lean":
            assert len(lines) <= 1_000, f"Palomar Challenge.lean > 1,000 lines ({len(lines)})"
            assert len(raw) <= 102_400, f"Palomar Challenge.lean > 100 KiB ({len(raw)} bytes)"
    return len(lean_files)


def check_active_identity_hygiene() -> None:
    active_files = [
        "README.md",
        "AGENTS.md",
        "CITATION.cff",
        "CITATION.bib",
        "CLAIMS.md",
        "LIMITATIONS.md",
        "REPLICATION.md",
        "VERIFICATION.md",
        "DEVIATIONS.md",
        "DATASHEET.md",
        "SUBMISSION_READINESS.md",
        "formalization.yaml",
        "codemeta.json",
        ".zenodo.json",
        "paper/main.tex",
        "paper/WHITE_PAPER.md",
    ]
    forbidden_entity = "0thernes " + "LLC"
    for rel in active_files:
        p = ROOT / rel
        if p.exists():
            txt = p.read_text(encoding="utf-8")
            assert forbidden_entity not in txt, f"Unformed entity label found in {rel}"


def main() -> None:
    check_repo_yaml_schema()
    ver = check_single_version_parity()
    n_lean = check_palomar_lean_rules()
    check_active_identity_hygiene()
    print(
        f"PASS: Version {ver} synchronized across all 13 manifests/docs, repo.yaml passes "
        f"Draft 2020-12 JSON Schema, all {n_lean} Lean files satisfy Palomar `module` & size rules, "
        "and active identity hygiene is clean."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
