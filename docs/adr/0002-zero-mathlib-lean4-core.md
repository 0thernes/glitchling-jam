# ADR-0002: Pure Zero-Mathlib Lean 4.35.0 Formal Core & Isolated Comparator

- **Date:** 2026-11-25
- **Status:** Accepted (`F37`, `R7`, `B22`)

## Context
Mathematical claims in simulation suites (conservation laws, Kochen–Specker uncolorability, finite-field ECC, simplex governance caps, hyperbolic containment) are often tested only numerically, leaving edge-case blindspots. Importing Mathlib adds gigabytes of oleans and slow CI times.

## Decision
Build a self-contained, zero-Mathlib Lean `v4.35.0` formal core (`lean/GlitchlingProofs/`) with `autoImplicit = false`, `relaxedAutoImplicit = false`, zero `sorry`, zero `native_decide`, strict `[propext, Classical.choice, Quot.sound]` allowlist, `leanchecker --fresh`, and an isolated statement-only `Challenge.lean` matched against sorry-free `Solution.lean` via `comparator.json`.

## Consequences
Clean-clone formal verification builds in ~30 seconds with zero external proof dependencies and catches specification errors (such as `F38`) immediately at kernel check time. IEEE-754 floating-point roundoff remains verified numerically via independent Python differential oracles (`reference/glitchling_oracle.py`).
