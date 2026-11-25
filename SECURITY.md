# Security policy

This is a static site (HTML/JS, no server, no accounts, no cookies) plus offline Node/Bun simulations.

- **Network use:** the pages make no network requests except the opt-in "Fetch live QRNG" button on `/live/`. It calls four public randomness beacons (lfdr.de, NIST Beacon, drand, ANU) with a timeout, and falls back to a local generator.
- **Storage:** `/live/` keeps the adopted lineage genome in `localStorage` (`glv2.genome`, `glv2.genomeStack`). Nothing is sent anywhere.
- **Secrets:** none are needed and none may be committed. `tools/check.mjs` scans tracked files for common token and private-key patterns on every CI run.
- **Reporting:** please open a GitHub issue on https://github.com/0thernes/glitchling-jam/issues. Don't put exploit details in public: ask for a private contact in the issue.
