# Configuration & Environment Variables (`docs/configuration.md`)

`glitchling-jam` requires zero API keys, zero database connections, and zero `.env` files (`Build Standard A33`). All runtime knobs are explicit CLI arguments, environment variables, or clamped URL query parameters:

## 1. CLI & Environment Variables

| Variable / Arg | Scope | Default | Effect & Safety Bounds |
|---|---|---|---|
| `BUN_JSC_useConcurrentJIT=0` | `glitchling.ts`, `tools/check.mjs` | unset (nondeterministic) | **Required** for same-machine byte-identical Bun runs (`F31`). |
| `FULL=1` | `tools/check.mjs` | `0` | Also executes the 90-second `live/test/dome_heptarch_probe.mjs` suite. |
| `SEEDS` | `live/test/lesion_experiments.mjs` | `1,2,...,12` | Comma-separated positive integer seed list (e.g., `13..24`, `25..36`). |
| `FROM_T`, `TO_T` | `live/test/lesion_experiments.mjs` | `1`, `15` | Inclusive experiment index range (`1..15`). |
| `JSON_OUT` | `live/test/lesion_experiments.mjs` | unset | Optional path to write structured summary & FWER contrast JSON. |
| `CHROME`, `PLAYWRIGHT` | `live/test/{dome_ui_check,browser_check}.mjs` | auto-detect | Local Chromium & Playwright paths for headless WebGL2 smoke tests. |

## 2. Browser URL Query Parameters (Clamped — `F15`, `F16`)

### `play/index.html`
- `seed`: positive integer clamped to `[1, 2147483647]`
- `flaws`: comma-separated subset of `scramble,leaky,backwards,misfire`
- `leak`: clamped to `[0.00, 0.30]`
- `scramble`: rewire period clamped to `[10, 360]`
- `misfire`: jolt period clamped to `[10, 360]`

### `live/index.html`
- `seed`: clamped to integer `[1, 2147483647]` (`F16`)
- `brain`: `S`, `M` (default), `L`, `XL`, `XXL`, `MEGA`, `GIGA` (auto-downgrades if frame time exceeds budget)
- `backend`: `auto` (default), `cpu`, `worker`, `webgpu`
- `wm`: `std` (default) .. `omega` (`29.06M` world model)
