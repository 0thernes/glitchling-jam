import json, matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt, numpy as np
R = json.load(open("results/results.json"))["conditions"]
fig, ax = plt.subplots(1, 2, figsize=(11, 4))
for name, runs in R.items():
    hrs = [b["hour"] for b in runs[0]["blocks"]]
    s = [np.mean([(r["blocks"][i]["success"] or 0) for r in runs]) for i in range(len(hrs))]
    g = [np.mean([r["blocks"][i]["glc"] for r in runs]) for i in range(len(hrs))]
    ax[0].plot(hrs, s, marker="o", label=name, lw=2.5 if name in ("baseline","all") else 1); ax[1].plot(hrs, g, marker="o", label=name, lw=2.5 if name in ("baseline","all") else 1)
ax[0].set(title="Forage success per 6 h block (mean of seeds)", xlabel="sim hour", ylabel="rewards / forages"); ax[1].set(title="Blood glucose (end of block)", xlabel="sim hour", ylabel="glc")
ax[0].legend(fontsize=8); plt.suptitle("Glitchling: broken baby clone of Creature #1"); plt.tight_layout(); plt.savefig("results/glitchling.png", dpi=110)
# cursed portrait: neuron activations of the all-flaws episode folded into a face-ish heatmap, with channel-shift glitch
A = json.load(open("results/activations_allflaws_seed1.json")); M = np.array([f["rate"] for f in A["frames"]]).T  # neurons x time
n = M.shape[0]; side = int(np.ceil(np.sqrt(n))); img = np.zeros(side*side); img[:n] = M.mean(1); img = img.reshape(side, side)
img = np.kron(img, np.ones((16,16))); img = (img-img.min())/(np.ptp(img)+1e-9); h, w = img.shape
yy, xx = np.mgrid[0:h,0:w]; cx, cy = w/2, h/2; face = ((xx-cx)/(w*0.42))**2 + ((yy-cy)/(h*0.48))**2 < 1
rgb = np.stack([np.roll(img,7,1), img, np.roll(img,-9,0)], -1) * face[...,None]
for ex in (0.35, 0.65): rgb[((xx-w*ex)**2+(yy-h*0.4)**2) < (w*0.07)**2] = [1,0,0.2]
rgb[(abs(yy-h*0.7)<h*0.025)&(abs(xx-cx)<w*0.2)] = [0.1,1,0.3]
rng = np.random.default_rng(13)
for r in rng.integers(0,h,25): rgb[r:r+4] = np.roll(rgb[r:r+4], rng.integers(-40,40), 1)
plt.figure(figsize=(5,5)); plt.imshow(np.clip(rgb,0,1)); plt.axis("off"); plt.title("GLITCHLING (all flaws, day 1)", color="red"); plt.savefig("results/cursed_portrait.png", dpi=110, facecolor="black")
