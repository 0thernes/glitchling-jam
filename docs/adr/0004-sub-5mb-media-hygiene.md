# ADR-0004: Sub-5 MB Media Optimization for Git Repository Hygiene

- **Date:** 2026-11-25
- **Status:** Accepted (`F36`, `A24`)

## Context
Five tracked media files (`glitchling-hero-v3-4k.png` 9.15 MB, `glitchling-v4-t720-4k.png` 7.64 MB, `glitchling-v4-t800-4k.png` 7.39 MB, `glitchling-v4-clip-1080p.mp4` 6.87 MB, `11_purkinje_mouse_cerebellum.png` 7.26 MB) exceeded Build Standard `A24`'s 5 MB binary ceiling, bloating clones and failing hygiene checks.

## Decision
Optimize the 3 v3/v4 renders to crisp QHD PNG (`2560×1440`, `3.16–3.82 MB`), `11_purkinje_mouse_cerebellum.png` to `1440×1440` (`4.19 MB`), and re-encode the 1080p clip with H.264 `yuv420p` `+faststart` (`2.71 MB`) while preserving exact paths and updating `site/index.html` dimensions/captions honestly.

## Consequences
Zero tracked files exceed 5 MB (`A24` PASS), page load latency drops by ~55%, and no broken links or history rewrites are introduced.
