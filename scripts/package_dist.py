"""Compile paper/main.tex with Tectonic (zero-warning check), package dist/ PDF & arXiv tarball,
verify standalone tarball compilation, and generate CHECKSUMS.sha256 & data/MANIFEST.sha256.
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAPER_DIR = ROOT / "paper"
DIST_DIR = ROOT / "dist"
PDF_NAME = "Donahue_2026_glitchling_alife_verification.pdf"


def find_tectonic() -> str:
    found = shutil.which("tectonic")
    if found:
        return found
    local_win = Path.home() / ".local" / "bin" / "tectonic.exe"
    if local_win.exists():
        return str(local_win)
    local_unix = Path.home() / ".local" / "bin" / "tectonic"
    if local_unix.exists():
        return str(local_unix)
    raise FileNotFoundError("tectonic executable not found on PATH or ~/.local/bin")


def compile_tectonic(workdir: Path, outdir: Path) -> str:
    tectonic = find_tectonic()
    outdir.mkdir(parents=True, exist_ok=True)
    cmd = [tectonic, "-X", "compile", "main.tex", "--outdir", str(outdir), "--keep-intermediates"]
    proc = subprocess.run(cmd, cwd=str(workdir), capture_output=True, text=True)
    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
    if proc.returncode != 0:
        raise RuntimeError(f"Tectonic failed ({proc.returncode}):\n{combined}")
    bad_markers = (
        "Warning:",
        "LaTeX Warning:",
        "Package hyperref Warning:",
        "Overfull \\hbox",
        "Underfull \\hbox",
        "Citation `",
        "Reference `",
        "There were undefined references",
        "There were multiply-defined labels",
    )
    found_warnings = [ln.strip() for ln in combined.splitlines() if any(m in ln for m in bad_markers)]
    # Check log file for overfull/underfull hboxes & undefined references
    log_path = outdir / "main.log"
    if log_path.exists():
        for ln in log_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if any(
                k in ln
                for k in (
                    "Overfull \\hbox",
                    "LaTeX Warning:",
                    "Package cleveref Warning:",
                    "Undefined control sequence",
                    "There were undefined references",
                )
            ):
                found_warnings.append(ln.strip())
    if found_warnings:
        uniq = list(dict.fromkeys(found_warnings))
        raise RuntimeError("LaTeX warnings/overfulls detected:\n  " + "\n  ".join(uniq[:20]))
    return combined


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def write_manifests() -> None:
    checksum_targets = [
        "dist/Donahue_2026_glitchling_alife_verification.pdf",
        "dist/arxiv_submission.tar.gz",
        "results/lean_axioms.txt",
        "results/citation-audit.json",
        "results/perf-benchmarks.json",
    ]
    lines = [f"{sha256_file(ROOT / rel)}  {rel}" for rel in checksum_targets if (ROOT / rel).exists()]
    (ROOT / "CHECKSUMS.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")

    data_dir = ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    data_targets = [
        "results/summary.csv",
        "results/results.json",
        "results/activations_allflaws_seed1.json",
        "artifacts/artificial-life/glitchling-summary.json",
        "artifacts/artificial-life/glitchling-behavior.csv",
    ]
    dlines = [f"{sha256_file(ROOT / rel)}  {rel}" for rel in data_targets if (ROOT / rel).exists()]
    (data_dir / "MANIFEST.sha256").write_text("\n".join(dlines) + "\n", encoding="utf-8", newline="\n")
    print(f"Wrote CHECKSUMS.sha256 ({len(lines)} entries) and data/MANIFEST.sha256 ({len(dlines)} entries).")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-only", action="store_true", help="Compile & verify without rewriting manifests")
    args = parser.parse_args()

    build_dir = PAPER_DIR / "build"
    compile_tectonic(PAPER_DIR, build_dir)
    built_pdf = build_dir / "main.pdf"
    if not built_pdf.exists():
        raise FileNotFoundError(f"Expected compiled PDF at {built_pdf}")

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    dist_pdf = DIST_DIR / PDF_NAME
    if not args.verify_only:
        shutil.copy2(built_pdf, dist_pdf)

    # Package standalone arXiv submission tarball
    arxiv_tar = DIST_DIR / "arxiv_submission.tar.gz"
    bundle_files = [
        PAPER_DIR / "main.tex",
        PAPER_DIR / "refs.bib",
        PAPER_DIR / "fig_results_v3.pdf",
        PAPER_DIR / "fig_fmo_cry4_oracle.pdf",
        PAPER_DIR / "fig_lesion_forest.pdf",
        PAPER_DIR / "fig_verification_pyramid.pdf",
    ]
    bbl_path = build_dir / "main.bbl"
    if bbl_path.exists():
        bundle_files.append(bbl_path)

    if not args.verify_only:
        with tarfile.open(arxiv_tar, "w:gz") as tar:
            for bf in bundle_files:
                tar.add(bf, arcname=bf.name)

    # Standalone extraction & compilation test in isolated temp directory
    with tempfile.TemporaryDirectory(prefix="glitchling_arxiv_") as tmp:
        tmp_path = Path(tmp)
        with tarfile.open(arxiv_tar, "r:gz") as tar:
            tar.extractall(tmp_path, filter="data")
        compile_tectonic(tmp_path, tmp_path / "out")
        standalone_pdf = tmp_path / "out" / "main.pdf"
        assert standalone_pdf.exists() and standalone_pdf.stat().st_size > 50_000

    if not args.verify_only:
        write_manifests()

    print(
        f"PASS: Zero-warning Tectonic PDF ({dist_pdf.stat().st_size:,} bytes) "
        f"& standalone-verified arXiv tarball ({arxiv_tar.stat().st_size:,} bytes)."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
