# Threat Model (`docs/threat-model.md`)

`glitchling-jam` is a static client-side web application and local Node/Bun/Python/Lean verification repository with zero backend server, zero user accounts, and zero personal data storage (`Build Standard B36`).

## STRIDE Risk Matrix & Verified Mitigations

| Threat Category | Attack Surface | Residual Risk | Mitigation & Verification Gate |
|---|---|---|---|
| **Spoofing / Supply Chain** | Compromised npm/pip runtime packages or altered release artifacts | Low | Zero runtime npm dependencies (`package.json`); vendored `three.js`/`p5.js` pinned locally; `CHECKSUMS.sha256`, `data/MANIFEST.sha256`, and SLSA `attest-build-provenance` on releases (`B37`, `B38`). |
| **Tampering (Proof / Claim Integrity)** | Hidden `sorry`, `native_decide`, custom axioms, or drifted README `#print axioms` | Low | Nested-comment Lean static audit (`scripts/verify_exact.py`), `leanchecker --fresh`, isolated `Challenge`/`Solution` `lake comparator --paranoid`, and `scripts/check_readme_axioms.py`. |
| **Tampering (DOM / XSS / Injection)** | Untrusted URL query parameters (`?seed=`, `?leak=`, `?flaws=`) or dynamic code execution | Low | Strict parameter clamping (`F15`, `F16` verified in `verification_ladder.mjs`); automated scan banning `eval`, `new Function`, and `document.write` in all first-party JS/HTML (`tools/check.mjs`); all `innerHTML` sinks verified in `P07` to emit internal constants/numbers only. |
| **Information Disclosure** | Leaked API keys, credentials, or personal machine paths | Low | Zero API keys/secrets used; automated regex secret check in `tools/check.mjs` + report-only `gitleaks` CI scan (`B35`, `.gitleaks.toml`). Local dev paths in historical jam logs documented transparently (`F20`). |
| **Denial of Service (Client Browser)** | Extreme brain scale (`GIGA`) or unbounded URL leak causing NaN / browser freeze | Low | `play/app.js` clamps `leak <= 0.30`; `live/js/app.js` clamps `seed` to `[1, 2^31 - 1]` and auto-downgrades brain scale if step duration exceeds frame budget; `quantizeNestorRung` maps non-finite inputs safely to `0`. |
| **External Network Leakage** | Unexpected third-party calls from offline static pages | Low | Zero external network calls on page load; the sole opt-in network call is behind the explicit user button *"Fetch public randomness beacons"* (`live/index.html:106`, `F24`). |
