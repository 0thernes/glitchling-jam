"""Live Crossref DOI, title-match & retraction audit for paper/refs.bib -> results/citation-audit.json.

Parses nested-brace BibTeX entries cleanly, queries the public Crossref REST API
(https://api.crossref.org/works/<doi>) for every DOI in paper/refs.bib, verifies
HTTP 200, enforces title-token alignment (catching wrong DOIs such as F41), checks
for retraction notices, and writes a structured JSON audit report.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
BIB_PATH = ROOT / "paper" / "refs.bib"
OUT_PATH = ROOT / "results" / "citation-audit.json"

ENTRY_RE = re.compile(r"@(\w+)\s*\{\s*([^,\s]+)\s*,(.*?)\n\}", re.S)


def parse_bib_fields(body: str) -> dict[str, str]:
    """Balanced-brace BibTeX field parser supporting nested braces such as {FMO} or {Lean~4}."""
    fields: dict[str, str] = {}
    i = 0
    n = len(body)
    while i < n:
        m = re.match(r"\s*([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*", body[i:])
        if not m:
            i += 1
            continue
        key = m.group(1).lower()
        i += m.end()
        if i >= n:
            break
        if body[i] == "{":
            depth = 1
            start = i + 1
            i += 1
            while i < n and depth > 0:
                if body[i] == "{":
                    depth += 1
                elif body[i] == "}":
                    depth -= 1
                i += 1
            val = body[start : i - 1]
        else:
            m2 = re.match(r"([^,\n]+)", body[i:])
            val = m2.group(1) if m2 else ""
            i += len(val)
        fields[key] = " ".join(val.split())
        while i < n and body[i] in " ,\r\n\t":
            i += 1
    return fields


def parse_bib(text: str) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for m in ENTRY_RE.finditer(text):
        etype, key, body = m.group(1), m.group(2), m.group(3)
        fields = parse_bib_fields(body)
        fields["type"] = etype
        fields["key"] = key
        entries.append(fields)
    return entries


def normalize_tokens(title: str) -> set[str]:
    cleaned = title.replace("{", "").replace("}", "").replace("~", " ").replace("--", " ")
    cleaned = re.sub(r"\\['`^\"~=.a-zA-Z]+", "", cleaned)
    return {w for w in re.findall(r"[a-z0-9]+", cleaned.lower()) if len(w) >= 3}


def query_crossref(doi: str) -> dict[str, Any]:
    encoded = urllib.parse.quote(doi, safe="")
    url = f"https://api.crossref.org/works/{encoded}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "GlitchlingCitationAudit/2.3.0 (mailto:0_0@0thernes.art)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=20.0) as resp:  # noqa: S310
        status = int(resp.status)
        payload = json.loads(resp.read().decode("utf-8"))
    msg = payload.get("message", {})
    titles = msg.get("title") or []
    updates = msg.get("update-to") or []
    updated_by = msg.get("updated-by") or []
    retracted = any(
        "retract" in str(u.get("type", "")).lower() or "retract" in str(u.get("label", "")).lower()
        for u in [*updates, *updated_by]
    )
    issued = (msg.get("issued") or {}).get("date-parts") or [[None]]
    year = issued[0][0] if issued and issued[0] else None
    return {
        "http_status": status,
        "crossref_title": titles[0] if titles else None,
        "crossref_year": year,
        "publisher": msg.get("publisher"),
        "retracted": retracted,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verify-offline",
        action="store_true",
        help="Validate existing results/citation-audit.json offline",
    )
    args = parser.parse_args()

    entries = parse_bib(BIB_PATH.read_text(encoding="utf-8"))
    if args.verify_offline:
        if not OUT_PATH.exists():
            raise FileNotFoundError(f"Missing {OUT_PATH}")
        data = json.loads(OUT_PATH.read_text(encoding="utf-8"))
        assert data["total_entries"] == len(entries), "Entry count mismatch with refs.bib"
        assert data["retracted_count"] == 0, "Retracted citations found"
        assert data["failed_doi_count"] == 0, "Failed DOI lookups found"
        assert data["title_mismatch_count"] == 0, "Title-mismatched DOIs found"
        bib_dois = {e["key"]: e.get("doi") for e in entries}
        for cached in data["entries"]:
            assert bib_dois.get(cached["key"]) == cached.get("doi"), f"DOI drift for {cached['key']}"
        print(
            f"PASS (offline): {data['total_entries']} BibTeX entries, "
            f"{data['verified_doi_count']} live Crossref DOIs verified, 0 mismatches, 0 retractions."
        )
        return

    results: list[dict[str, Any]] = []
    verified_dois = 0
    failed_dois = 0
    title_mismatches = 0
    retracted_count = 0

    for ent in entries:
        doi = ent.get("doi")
        rec: dict[str, Any] = {
            "key": ent["key"],
            "bib_year": ent.get("year"),
            "bib_title": ent.get("title"),
            "doi": doi,
        }
        if doi:
            try:
                cr = query_crossref(doi)
                rec.update(cr)
                bib_toks = normalize_tokens(ent.get("title", ""))
                cr_toks = normalize_tokens(str(cr.get("crossref_title") or ""))
                overlap = len(bib_toks & cr_toks) / max(1, min(len(bib_toks), len(cr_toks)))
                rec["title_token_overlap"] = round(overlap, 3)
                if overlap < 0.5:
                    rec["status"] = "TITLE_MISMATCH"
                    title_mismatches += 1
                else:
                    rec["status"] = "VERIFIED_CROSSREF"
                    verified_dois += 1
                if cr["retracted"]:
                    retracted_count += 1
            except urllib.error.URLError as exc:
                rec["status"] = "FAILED"
                rec["error"] = str(exc)
                failed_dois += 1
        else:
            rec["status"] = "NO_DOI_PROCEEDINGS_OR_JOURNAL"
            rec["retracted"] = False
        results.append(rec)

    report = {
        "schema_version": "1.1.0",
        "audited_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source_bib": "paper/refs.bib",
        "total_entries": len(entries),
        "verified_doi_count": verified_dois,
        "non_doi_count": len(entries) - verified_dois - failed_dois - title_mismatches,
        "failed_doi_count": failed_dois,
        "title_mismatch_count": title_mismatches,
        "retracted_count": retracted_count,
        "entries": results,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")

    if failed_dois > 0 or retracted_count > 0 or title_mismatches > 0:
        raise SystemExit(
            f"Citation audit failed: failed={failed_dois}, mismatches={title_mismatches}, retracted={retracted_count}"
        )
    print(
        f"PASS: Audited {len(entries)} BibTeX entries ({verified_dois} live Crossref DOIs HTTP 200 "
        f"with title match, {report['non_doi_count']} non-DOI proceedings/articles, 0 retractions) "
        f"-> {OUT_PATH.relative_to(ROOT)}."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
