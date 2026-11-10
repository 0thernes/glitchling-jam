/* Glitchling play UI. Model lives in sim.js (window.GL). No dependencies, no network. */
(function () {
  "use strict";
  const { Glitchling, SITES, DAY, REGIONS, R0, RN, SITE_POS, DEFAULT_FLAWS } = window.GL;
  const $ = (id) => document.getElementById(id);
  const RM = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const COLORS = ["#ff3b5c", "#ffe14d", "#22e4ff", "#b26bff"]; // colour feature c = k & 3
  const SHAPES = ["circle", "square", "triangle", "diamond"]; // shape feature s = k >> 2
  const REG_COL = { SENS: "#22e4ff", THAL: "#4fc3ff", CTX: "#00ffa3", HIP: "#7dff6b", STR: "#c8ff3d", HYP: "#ffe14d", VTA: "#ffb02e", RAPHE: "#ff8a1f", LC: "#ff5a3c", BF: "#ff3b8a", INS: "#ff2bd6", SCN: "#c56bff", MOT: "#8b8bff", ENS: "#6be3c8" };

  // ---------- state ----------
  const q = new URLSearchParams(location.search);
  let seed = Math.max(1, parseInt(q.get("seed") || "1", 10) || 1);
  const flaws = JSON.parse(JSON.stringify(DEFAULT_FLAWS));
  const fq = q.get("flaws"); if (fq) for (const f of fq.split(",")) if (flaws[f]) flaws[f].on = true;
  if (q.get("scramble")) flaws.scramble.period = +q.get("scramble") || 90;
  if (q.get("leak")) flaws.leaky.rate = (+q.get("leak") || 6) / 100;
  if (q.get("misfire")) flaws.misfire.period = +q.get("misfire") || 60;
  let sim, running = true, tps = 20, acc = 0, lastTs = 0, frame = 0, evSeen = 0, pops = [], trail = [], shake = 0;
  const H = { n: 720, glc: [], rew: [], suc: [], fat: [] }; let rewWin = [];

  function newSim() {
    sim = new Glitchling(seed, flaws); acc = 0; evSeen = 0; pops = []; trail = []; rewWin = []; H.glc = []; H.rew = []; H.suc = []; H.fat = [];
    $("log").innerHTML = ""; logLine({ t: 0, type: "info", msg: `born · seed ${seed} · best site is ${sim.best} (p=${sim.pBase[sim.best].toFixed(2)})` });
    window.__gl = sim; syncURL(); drawAll(0);
  }
  function syncURL() {
    const p = new URLSearchParams(); p.set("seed", seed); const on = Object.keys(flaws).filter((k) => flaws[k].on); if (on.length) p.set("flaws", on.join(","));
    if (flaws.scramble.period !== 90) p.set("scramble", flaws.scramble.period); if (Math.abs(flaws.leaky.rate - 0.06) > 1e-9) p.set("leak", +(flaws.leaky.rate * 100).toFixed(1)); if (flaws.misfire.period !== 60) p.set("misfire", flaws.misfire.period);
    try { history.replaceState(null, "", "?" + p.toString() + location.hash); } catch (e) {}
  }

  // ---------- controls ----------
  const speedFromSlider = (v) => Math.max(1, Math.round(Math.pow(10, (v / 100) * Math.log10(1200)))); // 1..1200 ticks/s, log scale
  const sliderFromSpeed = (s) => Math.round((Math.log10(s) / Math.log10(1200)) * 100);
  function setRunning(r) { running = r; const b = $("play"); b.textContent = r ? "❚❚ Pause" : "▶ Play"; b.setAttribute("aria-pressed", r ? "true" : "false"); }
  $("play").addEventListener("click", () => setRunning(!running));
  $("step").addEventListener("click", () => { setRunning(false); tick(); drawAll(1); });
  $("reset").addEventListener("click", () => { seed = Math.max(1, parseInt($("seed").value, 10) || 1); newSim(); });
  $("rand").addEventListener("click", () => { seed = 1 + Math.floor(Math.random() * 99999); $("seed").value = seed; newSim(); });
  $("seed").addEventListener("change", () => { seed = Math.max(1, parseInt($("seed").value, 10) || 1); $("seed").value = seed; newSim(); });
  $("speed").addEventListener("input", (e) => { tps = speedFromSlider(+e.target.value); $("speedOut").textContent = tps; });
  function applyFlaws(changed) {
    sim.setFlaws(flaws); syncURL();
    for (const k of Object.keys(flaws)) { const fs = document.querySelector(`.flaw[data-flaw="${k}"]`); fs.classList.toggle("on", flaws[k].on); }
    if (changed) { const fs = document.querySelector(`.flaw[data-flaw="${changed}"]`); if (!RM.matches) { fs.classList.remove("pulse"); void fs.offsetWidth; fs.classList.add("pulse"); }
      logLine({ t: sim.t, type: changed, msg: `${changed} ${flaws[changed].on ? "ON" : "OFF"}${changed === "leaky" ? ` (${(flaws.leaky.rate * 100).toFixed(1)}%/tick)` : changed === "backwards" ? "" : ` (every ${flaws[changed].period} ticks)`}` }); }
  }
  for (const k of Object.keys(flaws)) {
    const cb = $("f-" + k); cb.checked = flaws[k].on; cb.addEventListener("change", () => { flaws[k].on = cb.checked; applyFlaws(k); });
    const sl = $("p-" + k); if (!sl) continue; const out = $("o-" + k);
    if (k === "leaky") { sl.value = flaws.leaky.rate * 100; out.textContent = (+sl.value).toFixed(1); } else { sl.value = flaws[k].period; out.textContent = sl.value; }
    sl.addEventListener("input", () => { if (k === "leaky") { flaws.leaky.rate = +sl.value / 100; out.textContent = (+sl.value).toFixed(1); } else { flaws[k].period = +sl.value; out.textContent = sl.value; } sim.setFlaws(flaws); syncURL(); });
    sl.addEventListener("change", () => { if (!flaws[k].on) { flaws[k].on = true; cb.checked = true; } applyFlaws(k); });
  }
  document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => { const on = b.dataset.preset === "all"; for (const k of Object.keys(flaws)) { flaws[k].on = on; $("f-" + k).checked = on; } applyFlaws(); logLine({ t: sim.t, type: "info", msg: on ? "all four flaws ON" : "all flaws OFF (healthy clone)" }); }));
  document.addEventListener("keydown", (e) => { if (e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.type !== "range") return; if (e.code === "Space" && e.target.tagName !== "BUTTON") { e.preventDefault(); setRunning(!running); } else if (e.key === "f" || e.key === "F") { const k = Math.floor(Math.random() * SITES); dropAt(SITE_POS[k].x, SITE_POS[k].y); } else if (e.key === ".") { tick(); drawAll(1); } });

  // ---------- canvases ----------
  const cw = $("world"), cb = $("brain"), cc = $("chart"); const xw = cw.getContext("2d"), xb = cb.getContext("2d"), xc = cc.getContext("2d");
  const dims = new Map();
  function fit(c) { const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } dims.set(c, { w: r.width, h: r.height, d }); }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { [cw, cb, cc].forEach(fit); brainLayout = null; drawAll(1); }) : null;
  [cw, cb, cc].forEach((c) => { fit(c); ro && ro.observe(c); }); window.addEventListener("resize", () => { [cw, cb, cc].forEach(fit); brainLayout = null; });

  function toWorld(ev) { const r = cw.getBoundingClientRect(); const m = worldMap(); return { x: (ev.clientX - r.left - m.ox) / m.s, y: (ev.clientY - r.top - m.oy) / m.s }; }
  function worldMap() { const { w, h } = dims.get(cw); const s = Math.min(w, h); return { s, ox: (w - s) / 2, oy: (h - s) / 2 }; }
  function dropAt(x, y) { const k = sim.dropFood(x, y); const sensedAt = sim.flaws.scramble.on ? sim.perm.indexOf(k) : k; toast(`food at site ${k}` + (sim.flaws.scramble.on && sensedAt !== k ? ` · it smells it at site ${sensedAt}` : "") + (sim.flaws.backwards.on ? " · legs will mirror" : "")); pops.push({ k, txt: "🍬", c: "#ffe14d", age: 0 }); }
  cw.addEventListener("pointerdown", (ev) => { ev.preventDefault(); const p = toWorld(ev); if (p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) return; dropAt(Math.min(1, Math.max(0, p.x)), Math.min(1, Math.max(0, p.y))); });
  cw.addEventListener("keydown", (e) => { if (e.key === "Enter") { const k = Math.floor(Math.random() * SITES); dropAt(SITE_POS[k].x, SITE_POS[k].y); } });
  let toastT = 0; function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2200); }

  // ---------- sim tick + history ----------
  function tick() {
    const f0 = sim.foraged; sim.step(); if (sim.foraged > f0 && sim.lastOutcome) { const o = sim.lastOutcome; pops.push({ k: o.k, txt: o.got ? (o.snack ? "+snack" : "+1") : "×", c: o.got ? "#00ffa3" : "#ff3b5c", age: 0 }); if (pops.length > 30) pops.shift(); }
    rewWin.push(sim.rewards); if (rewWin.length > 61) rewWin.shift();
    push(H.glc, sim.glc); push(H.rew, rewWin.length > 1 ? rewWin[rewWin.length - 1] - rewWin[0] : 0); push(H.suc, sim.successRecent(30)); push(H.fat, sim.fat);
    if (sim.misfireFlash > 0.99 && !RM.matches) shake = 1;
  }
  const push = (a, v) => { a.push(v); if (a.length > H.n) a.shift(); };

  // ---------- drawing: world ----------
  function shapePath(ctx, s, x, y, r) { ctx.beginPath(); if (s === 0) ctx.arc(x, y, r, 0, 6.2832); else if (s === 1) ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7); else if (s === 2) { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.75); ctx.lineTo(x - r * 0.95, y + r * 0.75); ctx.closePath(); } else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); } }
  function drawWorld(alpha) {
    const ctx = xw, { w, h, d } = dims.get(cw), m = worldMap(), S = m.s; ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    const L = sim.light, night = !sim.awake;
    const g = ctx.createRadialGradient(w / 2, h * 0.35, 10, w / 2, h / 2, Math.max(w, h) * 0.75); g.addColorStop(0, `rgba(${20 + 30 * L},${14 + 20 * L},${40 + 30 * L},1)`); g.addColorStop(1, "#05040a"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); if (shake > 0.02) ctx.translate((Math.random() - 0.5) * 8 * shake, 0);
    ctx.translate(m.ox, m.oy);
    // grid lines
    ctx.strokeStyle = "rgba(120,100,200,.08)"; ctx.lineWidth = 1; for (let i = 0; i <= 10; i++) { ctx.beginPath(); ctx.moveTo((i / 10) * S, 0); ctx.lineTo((i / 10) * S, S); ctx.moveTo(0, (i / 10) * S); ctx.lineTo(S, (i / 10) * S); ctx.stroke(); }
    const R = S * 0.045; const t = performance.now() / 1000;
    // trip lines (intended vs executed)
    const tr = sim.trip;
    if (tr && tr.phase === "out") { const Pi = SITE_POS[tr.ki], Pe = SITE_POS[tr.k];
      ctx.setLineDash([4, 6]); ctx.strokeStyle = "rgba(34,228,255,.65)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tr.from.x * S, tr.from.y * S); ctx.lineTo(Pi.x * S, Pi.y * S); ctx.stroke(); ctx.setLineDash([]);
      if (tr.ki !== tr.k) { ctx.strokeStyle = "rgba(255,225,77,.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tr.from.x * S, tr.from.y * S); ctx.lineTo(Pe.x * S, Pe.y * S); ctx.stroke();
        ctx.strokeStyle = "rgba(34,228,255,.9)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(Pi.x * S, Pi.y * S, R * 1.6, 0, 6.2832); ctx.stroke(); } }
    // sites
    ctx.font = `${Math.max(9, S * 0.024)}px ui-monospace,monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let k = 0; k < SITES; k++) { const P = SITE_POS[k], x = P.x * S, y = P.y * S, c = k & 3, s = k >> 2; const acc = sim.access[k], dep = sim.depl[k];
      // true reward probability halo (what the world really pays)
      ctx.globalAlpha = acc ? 0.18 + 0.5 * sim.pTrue[k] : 0.06; ctx.fillStyle = COLORS[c]; ctx.beginPath(); ctx.arc(x, y, R * (1.3 + 2.2 * sim.pTrue[k]), 0, 6.2832); ctx.fill();
      ctx.globalAlpha = acc ? 1 - 0.6 * dep : 0.22; shapePath(ctx, s, x, y, R); ctx.fillStyle = COLORS[c]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.stroke();
      ctx.globalAlpha = 1; if (!acc) { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - R * 0.6, y - R * 0.6); ctx.lineTo(x + R * 0.6, y + R * 0.6); ctx.moveTo(x + R * 0.6, y - R * 0.6); ctx.lineTo(x - R * 0.6, y + R * 0.6); ctx.stroke(); }
      // belief bar (learned value wSite) and, with scramble, what it currently senses here
      const bw = R * 2.4, by = y + R * 1.55; ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(x - bw / 2, by, bw, 4); ctx.fillStyle = "#00ffa3"; ctx.fillRect(x - bw / 2, by, bw * Math.min(1, Math.max(0, sim.wSite[k])), 4);
      if (sim.flaws.scramble.on) { const sv = Math.min(1, Math.max(0, sim.sensed[k] / 1.5)); ctx.fillStyle = "#ff2bd6"; ctx.fillRect(x - bw / 2 + bw * sv - 1.5, by - 3, 3, 10); }
      ctx.fillStyle = "rgba(233,230,245,.55)"; ctx.fillText(String(k), x, y - R * 1.75);
      if (sim.snack[k] > 0) { const pr = 1 + (RM.matches ? 0 : 0.15 * Math.sin(t * 6)); ctx.fillStyle = "#ffe14d"; ctx.shadowColor = "#ffe14d"; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(x + R * 0.9, y - R * 0.9, R * 0.45 * pr, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0; } }
    // nest
    const hx = sim.home.x * S, hy = sim.home.y * S; ctx.strokeStyle = "rgba(139,139,255,.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hx, hy, R * 1.8, R * 0.7, 0, 0, 6.2832); ctx.stroke(); ctx.fillStyle = "rgba(139,139,255,.5)"; ctx.fillText("nest", hx, hy + R * 1.3);
    // creature (interpolated between last two ticks)
    const px = (sim.prev.x + (sim.pos.x - sim.prev.x) * alpha) * S, py = (sim.prev.y + (sim.pos.y - sim.prev.y) * alpha) * S;
    trail.push([px, py]); if (trail.length > 40) trail.shift();
    ctx.lineCap = "round"; for (let i = 1; i < trail.length; i++) { ctx.strokeStyle = `rgba(0,255,163,${(i / trail.length) * 0.35})`; ctx.lineWidth = (i / trail.length) * R * 0.5; ctx.beginPath(); ctx.moveTo(trail[i - 1][0], trail[i - 1][1]); ctx.lineTo(trail[i][0], trail[i][1]); ctx.stroke(); }
    drawCreature(ctx, px, py, R * 1.15, t);
    // outcome pops
    for (const p of pops) { p.age += 1; const P = SITE_POS[p.k]; const a = Math.max(0, 1 - p.age / 70); if (a <= 0) continue; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.font = `bold ${Math.max(12, S * 0.035)}px ui-monospace,monospace`; ctx.fillText(p.txt, P.x * S, P.y * S - R * 2.2 - (RM.matches ? 0 : p.age * 0.5)); }
    pops = pops.filter((p) => p.age < 70); ctx.globalAlpha = 1;
    ctx.restore();
    // glitch overlays
    if (!RM.matches && (sim.misfireFlash > 0.3 || sim.rewireFlash > 0.5)) { const n = 3 + Math.floor(Math.random() * 4); const dd = dims.get(cw).d; for (let i = 0; i < n; i++) { const yy = Math.random() * h, hh = 2 + Math.random() * 14; try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(cw, 0, yy * dd, cw.width, hh * dd, (Math.random() - 0.5) * 30 * dd, yy * dd, cw.width, hh * dd); } catch (e) {} } ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.fillStyle = sim.misfireFlash > 0.3 ? `rgba(255,138,31,${0.12 * sim.misfireFlash})` : `rgba(255,43,214,${0.12 * sim.rewireFlash})`; ctx.fillRect(0, 0, w, h); }
    if (night) { ctx.fillStyle = "rgba(10,10,40,.35)"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#8b8bff"; ctx.font = "12px ui-monospace,monospace"; ctx.textAlign = "right"; ctx.fillText("night · asleep (drop food to wake it)", w - 8, h - 10); }
    if (sim.dead) { ctx.fillStyle = "rgba(0,0,0,.6)"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#ff3b5c"; ctx.font = "bold 22px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.fillText("starved · press Reset", w / 2, h / 2); }
    shake *= 0.85;
  }
  function drawCreature(ctx, x, y, r, t) {
    const wob = RM.matches ? 0 : 1, hd = sim.heading, F = sim.flaws, nOn = Object.values(F).filter((f) => f.on).length;
    ctx.save(); ctx.translate(x, y);
    const glow = sim.trip ? "#00ffa3" : sim.awake ? "#22e4ff" : "#8b8bff"; ctx.shadowColor = glow; ctx.shadowBlur = 18;
    // body: wobbly blob, more jagged with more flaws on
    ctx.beginPath(); const N = 22; for (let i = 0; i <= N; i++) { const a = (i / N) * 6.2832; const jag = 1 + wob * (0.06 * Math.sin(a * 5 + t * 4) + nOn * 0.025 * Math.sin(a * 13 - t * 9)); const rx = r * jag * 1.15, ry = r * jag * 0.9; const px = Math.cos(a) * rx, py = Math.sin(a) * ry; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 1, 0, 0, r * 1.3); bg.addColorStop(0, "#f6e9ff"); bg.addColorStop(0.5, "#c58bff"); bg.addColorStop(1, "#5a2a9a"); ctx.fillStyle = bg; ctx.fill(); ctx.shadowBlur = 0;
    // RGB-split rim when flawed
    if (nOn && wob) { ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,43,214,.5)"; ctx.lineWidth = 2; ctx.stroke(); ctx.translate(2, 0); ctx.strokeStyle = "rgba(34,228,255,.5)"; ctx.stroke(); ctx.translate(-2, 0); ctx.globalCompositeOperation = "source-over"; }
    // antennae (magenta when senses just rewired)
    const ac = sim.rewireFlash > 0.2 ? "#ff2bd6" : "#e9e6f5"; ctx.strokeStyle = ac; ctx.lineWidth = 2; for (const sgn of [-1, 1]) { const ax = Math.cos(hd + sgn * 0.6) * r, ay = Math.sin(hd + sgn * 0.6) * r; const tx = Math.cos(hd + sgn * 0.8) * r * 1.9, ty = Math.sin(hd + sgn * 0.8) * r * 1.9 + wob * Math.sin(t * 7 + sgn) * 2; ctx.beginPath(); ctx.moveTo(ax * 0.7, ay * 0.7); ctx.quadraticCurveTo(ax * 1.4, ay * 1.4 - 4, tx, ty); ctx.stroke(); ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(tx, ty, 2.5, 0, 6.2832); ctx.fill(); }
    // eyes look toward the INTENDED target (legs may disagree)
    let look = hd; if (sim.trip && sim.trip.phase === "out") { const P = SITE_POS[sim.trip.ki]; look = Math.atan2(P.y - sim.pos.y, P.x - sim.pos.x); }
    for (const sgn of [-1, 1]) { const ex = Math.cos(hd + sgn * 0.45) * r * 0.55, ey = Math.sin(hd + sgn * 0.45) * r * 0.45; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex, ey, r * 0.24, 0, 6.2832); ctx.fill(); ctx.fillStyle = sim.awake ? "#100818" : "#8b8bff"; if (sim.awake) { ctx.beginPath(); ctx.arc(ex + Math.cos(look) * r * 0.1, ey + Math.sin(look) * r * 0.1, r * 0.12, 0, 6.2832); ctx.fill(); } else { ctx.fillRect(ex - r * 0.2, ey - 1, r * 0.4, 2); } }
    // legs glow orange when motors are reversed
    ctx.strokeStyle = F.backwards.on ? "#ff8a1f" : "rgba(233,230,245,.7)"; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = hd + Math.PI / 2 + (i < 3 ? 0 : Math.PI) + ((i % 3) - 1) * 0.5; const st = sim.trip && wob ? Math.sin(t * 14 + i * 2) * 0.35 : 0; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.7); ctx.lineTo(Math.cos(a + st) * r * 1.45, Math.sin(a + st) * r * 1.3); ctx.stroke(); }
    // misfire sparks
    if (sim.misfireFlash > 0.15) { ctx.strokeStyle = "#ff8a1f"; ctx.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = Math.random() * 6.2832, l = r * (1.3 + Math.random() * 1.2 * sim.misfireFlash); ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l); ctx.stroke(); } }
    // leaky drips
    if (F.leaky.on && wob) { ctx.fillStyle = "rgba(34,228,255,.7)"; const n = Math.ceil(F.leaky.rate * 40); for (let i = 0; i < n; i++) { const ph = ((t * 0.8 + i / n) % 1); ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc((i - n / 2) * r * 0.25, r * 0.9 + ph * r * 1.4, 1.8, 0, 6.2832); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.restore();
  }

  // ---------- drawing: brain ----------
  let brainLayout = null;
  function layoutBrain() { const { w, h } = dims.get(cb); const rows = w < 560 ? 2 : 1, per = Math.ceil(REGIONS.length / rows); const cellW = w / per, cellH = h / rows; const L = [];
    REGIONS.forEach(([n, c], ri) => { const row = Math.floor(ri / per), col = ri % per; const x0 = col * cellW + 3, y0 = row * cellH + 16, ww = cellW - 6, hh = cellH - 22; const cols = Math.max(1, Math.round(Math.sqrt((c * ww) / hh))); const rr = Math.ceil(c / cols); const sp = Math.min(ww / cols, hh / rr); const rad = Math.max(1.2, sp * 0.36);
      const pts = []; for (let i = 0; i < c; i++) { const cx = x0 + (ww - cols * sp) / 2 + ((i % cols) + 0.5) * sp, cy = y0 + (hh - rr * sp) / 2 + (Math.floor(i / cols) + 0.5) * sp; pts.push([cx, cy]); } L.push({ n, c, x0, y0, ww, hh, pts, rad, i0: R0[n] }); });
    return L; }
  function drawBrain() { const ctx = xb, { w, h, d } = dims.get(cb); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h); if (!brainLayout) brainLayout = layoutBrain();
    const fl = sim.rewireFlash > 0.3 ? "rgba(255,43,214," + 0.25 * sim.rewireFlash + ")" : sim.misfireFlash > 0.3 ? "rgba(255,138,31," + 0.25 * sim.misfireFlash + ")" : null; if (fl) { ctx.fillStyle = fl; ctx.fillRect(0, 0, w, h); }
    ctx.font = "10px ui-monospace,monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    for (const r of brainLayout) { const col = REG_COL[r.n]; const rr = sim.regionRate[r.n] || 0; ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillText(r.n, r.x0 + r.ww / 2, r.y0 - 4); ctx.globalAlpha = 0.25; ctx.fillRect(r.x0 + 2, r.y0 - 2, (r.ww - 4) * Math.min(1, rr), 2);
      for (let i = 0; i < r.c; i++) { const v = sim.rate[r.i0 + i]; const [x, y] = r.pts[i]; ctx.globalAlpha = 0.12 + 0.88 * Math.min(1, v); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r.rad * (0.65 + 0.5 * Math.min(1, v)), 0, 6.2832); ctx.fill(); }
      if (r.n === "MOT" && sim.flaws.backwards.on) { ctx.globalAlpha = 0.9; ctx.fillStyle = "#ff8a1f"; ctx.fillText("⇄ reversed", r.x0 + r.ww / 2, r.y0 + r.hh + 4); } }
    ctx.globalAlpha = 1; }

  // ---------- drawing: charts ----------
  function lane(ctx, data, x, y, w, h, lo, hi, color, label, val) { ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = "rgba(233,230,245,.55)"; ctx.font = "10px ui-monospace,monospace"; ctx.textAlign = "left"; ctx.fillText(label, x + 4, y + 11); ctx.textAlign = "right"; ctx.fillStyle = color; ctx.fillText(val, x + w - 4, y + 11);
    if (data.length < 2) return; ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); const n = data.length; for (let i = 0; i < n; i++) { const px = x + (i / (H.n - 1)) * w, v = (data[i] - lo) / (hi - lo || 1); const py = y + h - 2 - Math.min(1, Math.max(0, v)) * (h - 14); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
  function drawChart() { const ctx = xc, { w, h, d } = dims.get(cc); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h); const lh = (h - 8) / 3;
    lane(ctx, H.glc, 2, 2, w - 4, lh, 0, 6, "#22e4ff", "blood glucose (toy units)", sim.glc.toFixed(2));
    const rmax = Math.max(4, ...H.rew); lane(ctx, H.rew, 2, 4 + lh, w - 4, lh, 0, rmax, "#00ffa3", "rewards in last hour", String(H.rew[H.rew.length - 1] || 0));
    lane(ctx, H.suc, 2, 6 + 2 * lh, w - 4, lh, 0, 1, "#ff2bd6", "success, last 30 forages", sim.successRecent(30).toFixed(2));
    ctx.fillStyle = "rgba(233,230,245,.35)"; ctx.textAlign = "right"; ctx.fillText("last 12 sim-hours →", w - 6, h - 4); }

  // ---------- stats + log ----------
  const statEls = {}; const STATS = [["tick", "tick"], ["glc", "glucose"], ["fat", "fat"], ["for", "forages"], ["rew", "rewards"], ["suc", "success"], ["best", "best-site %"], ["ie", "wanted→went"], ["fl", "jolts / rewires"]];
  for (const [k, lab] of STATS) { const div = document.createElement("div"); div.innerHTML = `<dt>${lab}</dt><dd id="s-${k}">–</dd>`; $("stats").appendChild(div); statEls[k] = div.querySelector("dd"); }
  function hhmm(t) { const m = t % DAY; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function updateStats() { const s = sim; statEls.tick.textContent = s.t; statEls.glc.textContent = s.glc.toFixed(2); statEls.fat.textContent = s.fat.toFixed(1); statEls.for.textContent = s.foraged; statEls.rew.textContent = s.rewards; statEls.suc.textContent = s.foraged ? (s.rewards / s.foraged).toFixed(3) : "–";
    statEls.best.textContent = Math.round(100 * s.bestSiteFrac(30)) + "%"; statEls.ie.textContent = s.intended < 0 ? "–" : s.intended === s.executed ? `${s.intended}→${s.executed}` : `${s.intended}→${s.executed} ⇄`; statEls.fl.textContent = `${s.jolts} / ${s.rewires}`;
    $("clock").textContent = `day ${s.day} · ${hhmm(s.t)}`; const st = $("state"); const label = s.dead ? "dead" : !s.awake && !s.trip ? "asleep" : s.trip ? (s.trip.phase === "out" ? "foraging" : "heading home") : "resting"; st.textContent = label; st.className = "pill " + (s.dead ? "dead" : label === "asleep" ? "sleep" : s.trip ? "eat" : "");
    for (const e of s.events) if (e.id > evSeen) { logLine(e); evSeen = e.id; } }
  function logLine(e) { const li = document.createElement("li"); li.className = e.type; li.innerHTML = `<b>d${Math.floor(e.t / DAY) + 1} ${hhmm(e.t)}</b>`; li.appendChild(document.createTextNode(e.msg)); const ol = $("log"); ol.prepend(li); while (ol.children.length > 80) ol.lastChild.remove(); }

  // ---------- loop ----------
  function drawAll(alpha) { if (!sim) return; drawWorld(alpha); drawBrain(); drawChart(); updateStats(); }
  function loop(ts) { const dt = Math.min(0.1, lastTs ? (ts - lastTs) / 1000 : 0); lastTs = ts; frame++;
    if (running && !sim.dead) { acc += dt * tps; let n = Math.floor(acc); acc -= n; if (n > 40) n = 40; for (let i = 0; i < n; i++) tick(); }
    const alpha = running && tps <= 60 ? Math.min(1, acc) : 1; drawWorld(alpha); drawBrain(); drawChart(); if (frame % 6 === 0 || !running) updateStats();
    requestAnimationFrame(loop); }
  window.addEventListener("error", (e) => { const ol = $("log"); if (ol) logLine({ t: sim ? sim.t : 0, type: "dead", msg: "page error: " + e.message }); });

  $("seed").value = seed; tps = speedFromSlider(+$("speed").value); $("speedOut").textContent = tps;
  newSim(); applyFlaws(); setRunning(true); requestAnimationFrame(loop);
})();
