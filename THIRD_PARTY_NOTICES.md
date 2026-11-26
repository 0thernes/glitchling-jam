# Third-Party Notices & Licensing Attribution

`glitchling-jam` itself is licensed under the **Cosmogonic License — Non-Commercial Research & Play** ([`LICENSE`](LICENSE)). The vendored third-party libraries and Wikimedia Commons reference images below retain their own original licenses:

| Component | Path | Upstream / Author | License |
|---|---|---|---|
| **Three.js r170** | `live/vendor/three/` | Mr.doob & Three.js contributors | MIT (`live/vendor/three/LICENSE`) |
| **p5.js v1.11.3** | `live/vendor/p5/` | Processing Foundation & contributors | LGPL-2.1 (`live/vendor/p5/LICENSE`) |
| **Eshkol Taylor AD recurrences** | `live/js/tsotchke/taylor.js`, `qgtl.js` | Tsotchke (`tsotchke/eshkol`, `tsotchke/quantum_geometric_tensor`) | MIT (`live/js/tsotchke/LICENSE-eshkol`) |
| **Wikimedia Commons neuroanatomy / biology reference figures (17 images)** | `research/img/` | Individual artists credited verbatim in [`research/img/SOURCES.md`](research/img/SOURCES.md) | Public Domain / CC0 / CC BY / CC BY-SA (per image in `SOURCES.md`) |

## External Toolchains (Not Vendored)
- **Node.js (>=22)** (MIT), **Bun** (MIT), **Python 3** (PSF), **NumPy / SciPy / Matplotlib / Pillow / Pytest / Hypothesis / Ruff / Mypy** (BSD/MIT/MPL), **Lean 4 (`v4.35.0`)** (Apache-2.0), and **Tectonic** (MIT) are invoked externally for verification and typesetting.
- **Zero network calls by default:** All web pages (`index.html`, `play/`, `live/`, `site/`, `brain-viz/`) run 100% offline. Only the explicit opt-in button *"Fetch public randomness beacons"* in `live/index.html` calls external CORS randomness endpoints (drand, NIST Beacon, ANU/LFDR).
