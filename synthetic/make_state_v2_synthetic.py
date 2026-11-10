"""SYNTHETIC prototype of results/state_v2.jsonl (BLUEPRINT.md Phase 1 export schema).
Until Alien Life ships the real file, this fills the schema so the v4 studio can be built against it.
REAL-derived fields (from results/activations_allflaws_seed1.json, Glitchling all-flaws seed 1):
  brain.rate, brain.regions, metab.glc, flaws.leak (= mean |dwSite| per tick between frames), flaws.perm,
  flaws.misfireAt, brain.motIntended/motExecuted, events misfire/motor_reversal/sensor_shuffle.
SYNTHETIC fields (invented here, deterministic): body/morph, limbs (per-leg CPG phase, contact, rev, ganglionRate,
  fatigue), eyes, metab.atp/fat/heat, affect, field (also SIMULATED by design), offspring g2 + birth event."""
import json, math, random
SRC = '/workspace/glitchling-jam/results/activations_allflaws_seed1.json'
OUT = '/workspace/glitchling-jam/synthetic/state_v2.synthetic.jsonl'
d = json.load(open(SRC)); frames = {f['t']: f for f in d['frames']}; ev = d['events']
rng = random.Random(42); T0, T1, BIRTH = 600, 840, 720
NLEG = 7  # odd allowed by spec
def leak_at(t):
    a, b = frames.get(t - 10), frames.get(t)
    if not a or not b: return 0.0
    return sum(abs(x - y) for x, y in zip(a['wSite'], b['wSite'])) / len(b['wSite']) / 10
def last_ev(t, typ):
    es = [e for e in ev if e['type'] == typ and e['tick'] <= t]; return es[-1] if es else None
lines = []
for t in range(T0, T1 + 1, 10):
    f = frames[t]; mr = last_ev(t, 'motor_reversal'); sh = last_ev(t, 'sensor_shuffle'); mf = last_ev(t, 'misfire')
    win = [ {k: v for k, v in e.items() if k not in ('synapses',)} for e in ev if t - 10 < e['tick'] <= t and e['type'] != 'motor_wiring']
    ph = (t - T0) / 10
    fear = 0.15 + 0.5 * max(0, math.sin(ph * 0.45)) ; delight = 0.6 if any(e['type'] == 'misfire' for e in win) else 0.2 + 0.1 * math.cos(ph)
    calm = max(0, 0.7 - fear); heat = 0.35 + 0.25 * (sum(f['regions'].values()) / 14 * 10)
    for cid in (['g1'] + (['g2'] if t >= BIRTH else [])):
        child = cid == 'g2'; age = (t - BIRTH) / 10 if child else 99
        nSeg = 5 if child else 7; s = 0.45 if child else 1.0
        seg = [{'r': round(s * (0.32 + 0.3 * math.sin(math.pi * (i + 0.6) / (nSeg + 0.2)) ** 0.8) * (1 + 0.08 * math.sin(ph * 1.3 + i * 0.9)), 3),
                'pressure': round(0.55 + 0.3 * math.sin(ph * 0.7 + i), 3)} for i in range(nSeg)]
        nl = 5 if child else NLEG
        limbs = []
        for j in range(nl):
            rev = (mr is not None and t - mr['tick'] < 10 and j % 2 == 0)  # backwards flaw reverses even legs right after a reversal
            freq = 0.9 + 0.12 * j % 0.4; phase = (ph * freq * (-1 if rev else 1) + j * 2.1) % (2 * math.pi)
            limbs.append({'j': j, 'len': round(s * (0.95 + 0.1 * math.sin(j)), 3), 'phase': round(phase, 3), 'contact': 1 if math.sin(phase) < 0.2 else 0,
                          'rev': rev, 'ganglionRate': round(0.1 + 0.3 * abs(math.sin(phase + j)), 3), 'fatigue': round(min(1, 0.05 * ph / 3 + 0.05 * j), 3)})
        eyes = [{'pos': [0.95, 0.35 * e - 0.35, 0.25 if e % 2 else -0.25], 'aperture': round(max(0.1, 0.4 + 0.5 * fear - 0.2 * calm + 0.1 * e), 3), 'stalk': round(0.15 + 0.12 * e, 3)} for e in range(3 if child else 5)]
        rgb = [round(0.75 - 0.3 * fear, 3), round(0.35 + 0.2 * delight, 3), round(0.55 + 0.25 * calm, 3)]
        rec = {'t': t, 'id': cid, 'parent': 'g1' if child else None, 'gen': 1 if child else 0, 'alive': True,
               'body': {'nSeg': nSeg, 'seg': seg, 'vol': round(s * (1.0 + 0.1 * math.sin(ph * 0.7)), 3), 'skin': {'rgb': rgb, 'wounds': []}},
               'limbs': limbs, 'eyes': eyes,
               'brain': {'regions': f['regions'], 'rate': f['rate'], 'motIntended': mr['intended'] if mr else None, 'motExecuted': mr['executed'] if mr else None},
               'metab': {'glc': f['glc'], 'atp': round(1.2 + 0.8 * calm, 3), 'fat': round(360 - 0.02 * (t - T0), 2), 'heat': round(heat, 3)},
               'affect': {'fear': round(fear, 3), 'delight': round(delight, 3), 'frustration': 0.05, 'calm': round(calm, 3), 'moodVal': round(delight - fear, 3), 'stress': round(0.2 + 0.4 * fear, 3)},
               'field': {'amp': round(0.25 + 0.5 * abs(math.sin(ph * 0.5)) * (0.5 if child else 1), 3), 'payload': [round(delight - fear, 3), round(fear + delight, 3), fear, delight], 'rvActive': ph % 8 < 1.5 and not child, 'label': 'SIMULATED'},
               'flaws': {'perm': sh['perm'] if sh else [], 'leak': round(leak_at(t), 5), 'misfireAt': mf['tick'] if mf else None},
               'events': ([] if child else win) + ([{'type': 'birth', 'child': 'g2'}] if t == BIRTH and not child else []),
               '_synthetic': True}
        lines.append(json.dumps(rec))
open(OUT, 'w').write('\n'.join(lines) + '\n'); print(len(lines), 'lines ->', OUT)
