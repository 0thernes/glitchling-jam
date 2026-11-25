# Contributing to glitchling-jam

This repo is a public jam log and a live GitHub Pages site (https://0thernes.github.io/glitchling-jam/). Several people and AI agents commit to it. The rules below stop them from overwriting each other or breaking the site.

## Before every push

1. `git fetch origin` and make sure your commits sit **on top of the latest `origin/main`** (`git log --oneline origin/main..HEAD` shows only your commits, and `git merge-base --is-ancestor origin/main HEAD` succeeds). If not, rebase or rebuild your change on top.
2. `git diff --stat origin/main..HEAD`: check you are not deleting or reverting files you did not mean to touch. A stale push once overwrote `live/` passes 15–19 (`8704d27`, reverted in `63baa43`).
3. `npm test`, which runs `tools/check.mjs` and needs Node 22 or newer plus Bun. It must print `9/9 checks passed`.
4. Push ordinary commits straight to `main`. **Never force-push.**
5. After pushing, check that https://0thernes.github.io/glitchling-jam/, `/live/`, `/play/`, `/site/` and `/brain-viz/` return HTTP 200.

## Honesty rules (non-negotiable)

- No claims of consciousness, sentience, feelings or AGI for Glitchling or Creature #1. Functional names like "mood" or "dream" are numeric variables.
- Label simulated against real. Anything driven by synthetic data says SYNTHETIC on the page, and `live/js/honesty.js` lists what is real and what is simplified. Keep it accurate when the code changes.
- Every number in a doc must come from a command someone can re-run. Put the command next to the number, and say when a figure is nominal (set by formula) rather than measured.
- Creature #1 held-out test seeds may be used only after a code freeze that Alex approves. Glitchling experiments use seeds 500–999 and are labelled "Glitchling", not Creature #1 evidence.
- `core/` is a vendored copy of Creature #1's organism. Don't edit it here.

## Layout and checks

See [`AUDIT/INDEX.md`](AUDIT/INDEX.md) for a table of contents of every file. Long-running probes live in `live/test/` (see `live/README.md`). The full statistical suite runs with `npm run lesion` and is too slow for CI.
