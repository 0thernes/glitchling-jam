# ADR-0001: Retain Cosmogonic Non-Commercial License

- **Date:** 2026-11-24 (documented 2026-11-25)
- **Status:** Accepted (`F04/D4`, `F40`)

## Context
Public repositories without a `LICENSE` default to "all rights reserved", blocking academic reproduction. Conversely, OSI permissive licenses (MIT/Apache-2.0) allow commercial exploitation without consent.

## Decision
Keep `LICENSE` byte-identical to `0thernes/CQM2` (`COSMOGONIC LICENSE — NON-COMMERCIAL RESEARCH & PLAY`), preserving vendored third-party licenses (`three.js` MIT, `p5.js` LGPL-2.1, `eshkol` MIT) in `THIRD_PARTY_NOTICES.md`.

## Consequences
Academic research, replication, and personal play are explicitly permitted, while commercial reuse requires written permission. Because the license is non-OSI, this trade-off is stated openly in `LIMITATIONS.md` and `docs/faq.md`.
