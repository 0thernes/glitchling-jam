"""Independent textbook exact-arithmetic & linear-algebra reference oracle for Glitchling.

Implements every core mathematical invariant from first principles using Python's
`fractions.Fraction` and `numpy` (via Kronecker-product Liouvillians and exact rational
geometry) with zero shared code from `live/js/`, enabling differential testing (`B11`, `B12`).
"""

from __future__ import annotations

import math
from fractions import Fraction
from typing import Sequence

import numpy as np
from numpy.typing import NDArray

# ---------------------------------------------------------------------------
# 1. GF(2^4) = F_2[x] / (x^4 + x + 1) (primitive 0x13) & RS[15, 11, d=5]
# ---------------------------------------------------------------------------

GF16_PRIM = 0x13


def gf16_mul(a: int, b: int) -> int:
    """Exact polynomial multiplication modulo x^4 + x + 1 over GF(2)."""
    a &= 0xF
    b &= 0xF
    acc = 0
    for _ in range(4):
        if b & 1:
            acc ^= a
        a <<= 1
        if a & 0x10:
            a ^= GF16_PRIM
        b >>= 1
    return acc & 0xF


def gf16_pow(a: int, e: int) -> int:
    res = 1
    base = a & 0xF
    exp = e
    while exp > 0:
        if exp & 1:
            res = gf16_mul(res, base)
        base = gf16_mul(base, base)
        exp >>= 1
    return res


def gf16_inv(a: int) -> int:
    a &= 0xF
    if a == 0:
        raise ZeroDivisionError("0 has no multiplicative inverse in GF(16)")
    return gf16_pow(a, 14)


def rs15_11_generator() -> list[int]:
    """g(x) = prod_{r=1}^4 (x - alpha^r) over GF(16) with alpha = 2."""
    g = [1]
    for r in range(1, 5):
        root = gf16_pow(2, r)
        nxt = [0] * (len(g) + 1)
        for i, c in enumerate(g):
            nxt[i] ^= c
            nxt[i + 1] ^= gf16_mul(c, root)
        g = nxt
    return g


RS_GEN = rs15_11_generator()


def rs15_11_encode(msg11: Sequence[int]) -> list[int]:
    """Systematic RS[15, 11, d=5] encoder over GF(16)."""
    if len(msg11) != 11:
        raise ValueError(f"Expected 11 symbols, got {len(msg11)}")
    cw = [int(x) & 0xF for x in msg11]
    par = [0, 0, 0, 0]
    for sym in cw:
        fb = sym ^ par[0]
        par[0] = par[1] ^ gf16_mul(RS_GEN[1], fb)
        par[1] = par[2] ^ gf16_mul(RS_GEN[2], fb)
        par[2] = par[3] ^ gf16_mul(RS_GEN[3], fb)
        par[3] = gf16_mul(RS_GEN[4], fb)
    return cw + par


def rs15_11_syndromes(rx15: Sequence[int]) -> list[int]:
    """Evaluate S_j = C(alpha^j) for j = 1..4."""
    if len(rx15) != 15:
        raise ValueError(f"Expected 15 symbols, got {len(rx15)}")
    syns: list[int] = []
    for j in range(1, 5):
        alpha_j = gf16_pow(2, j)
        acc = 0
        for sym in rx15:
            acc = gf16_mul(acc, alpha_j) ^ (int(sym) & 0xF)
        syns.append(acc)
    return syns


# ---------------------------------------------------------------------------
# 2. Exact CEGA-18, 3-Qubit Hoggar Spectral Floor, and 4-Qubit C3 Twins
# ---------------------------------------------------------------------------

CEGA_18_RAYS: tuple[tuple[int, int, int, int], ...] = (
    (0, 0, 0, 1),
    (0, 0, 1, 0),
    (1, 1, 0, 0),
    (1, -1, 0, 0),
    (0, 1, 0, 0),
    (1, 0, 1, 0),
    (1, 0, -1, 0),
    (1, -1, 1, -1),
    (1, -1, -1, 1),
    (0, 0, 1, 1),
    (1, 1, 1, 1),
    (0, 1, 0, -1),
    (1, 0, 0, 1),
    (1, 0, 0, -1),
    (0, 1, -1, 0),
    (1, 1, -1, 1),
    (1, 1, 1, -1),
    (-1, 1, 1, 1),
)

CEGA_9_CONTEXTS: tuple[tuple[int, int, int, int], ...] = (
    (0, 1, 2, 3),
    (0, 4, 5, 6),
    (7, 8, 2, 9),
    (7, 10, 6, 11),
    (1, 4, 12, 13),
    (8, 10, 13, 14),
    (15, 16, 3, 9),
    (15, 17, 5, 11),
    (16, 17, 12, 14),
)


def verify_cega18_exact() -> dict[str, int | bool]:
    """Verify exact orthogonality, 2-context multiplicity, and exhaustive classical max = 8."""
    ortho_ok = True
    counts = [0] * 18
    for ctx in CEGA_9_CONTEXTS:
        for i in range(4):
            counts[ctx[i]] += 1
            for j in range(i + 1, 4):
                u, v = CEGA_18_RAYS[ctx[i]], CEGA_18_RAYS[ctx[j]]
                if sum(a * b for a, b in zip(u, v)) != 0:
                    ortho_ok = False
    # Exact check: max satisfied contexts under mutual exclusivity (at most 1 true per context)
    max_sat = 0
    for mask in range(1 << 18):
        valid = True
        sat = 0
        for ctx in CEGA_9_CONTEXTS:
            c = sum((mask >> r) & 1 for r in ctx)
            if c > 1:
                valid = False
                break
            sat += c
        if valid and sat > max_sat:
            max_sat = sat
    return {
        "ortho_ok": ortho_ok,
        "all_multiplicity_two": all(c == 2 for c in counts),
        "classical_max": max_sat,
        "quantum_sum": 9,
    }


def verify_hoggar_exact() -> dict[str, Fraction | int]:
    """Exact rational verification of the 3-qubit Hoggar Pauli-flat fiducial |psi_H>.

    Using scaled Gaussian-integer state |v> = (-1 + 2i, 1, 1, 1, 1, 1, 1, 1) with <v|v> = 12,
    every expectation <P_u> and Fubini-Study metric entry 4|g_{uv}| is an exact `Fraction`!
    """
    # Exact 2x2 Pauli matrices as (re, im) integer pairs
    pauli1: list[list[list[tuple[int, int]]]] = [
        [[(1, 0), (0, 0)], [(0, 0), (1, 0)]],  # I
        [[(0, 0), (1, 0)], [(1, 0), (0, 0)]],  # X
        [[(0, 0), (0, -1)], [(0, 1), (0, 0)]],  # Y
        [[(1, 0), (0, 0)], [(0, 0), (-1, 0)]],  # Z
    ]

    def cmul(a: tuple[int, int], b: tuple[int, int]) -> tuple[int, int]:
        return (a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0])

    psi: list[tuple[int, int]] = [(-1, 2)] + [(1, 0)] * 7
    norm_sq = 12

    def apply_p3(code: int) -> list[tuple[int, int]]:
        p0, p1, p2 = (code >> 4) & 3, (code >> 2) & 3, code & 3
        out = [(0, 0)] * 8
        for r in range(8):
            r0, r1, r2 = (r >> 2) & 1, (r >> 1) & 1, r & 1
            ar, ai = 0, 0
            for c in range(8):
                c0, c1, c2 = (c >> 2) & 1, (c >> 1) & 1, c & 1
                m = cmul(cmul(pauli1[p0][r0][c0], pauli1[p1][r1][c1]), pauli1[p2][r2][c2])
                if m != (0, 0):
                    prod = cmul(m, psi[c])
                    ar += prod[0]
                    ai += prod[1]
            out[r] = (ar, ai)
        return out

    p_states = [apply_p3(code) for code in range(1, 64)]
    mu_vals: list[Fraction] = []
    for st in p_states:
        re_sum = sum(psi[i][0] * st[i][0] + psi[i][1] * st[i][1] for i in range(8))
        mu_vals.append(Fraction(re_sum, norm_sq))

    assert all(abs(m) == Fraction(1, 3) for m in mu_vals), "Hoggar fiducial must be Pauli-flat |mu|=1/3"

    def symp_bits(code: int) -> tuple[int, int]:
        p0, p1, p2 = (code >> 4) & 3, (code >> 2) & 3, code & 3
        xb = ((p0 in (1, 2)) << 2) | ((p1 in (1, 2)) << 1) | (p2 in (1, 2))
        zb = ((p0 in (2, 3)) << 2) | ((p1 in (2, 3)) << 1) | (p2 in (2, 3))
        return xb, zb

    total_lines = 0
    violated_lines = 0
    hi_vals: set[Fraction] = set()
    lo_vals: set[Fraction] = set()
    for u in range(63):
        xu, zu = symp_bits(u + 1)
        for v in range(u + 1, 63):
            xv, zv = symp_bits(v + 1)
            if (bin(xu & zv).count("1") + bin(zu & xv).count("1")) % 2 != 0:
                continue
            w = ((u + 1) ^ (v + 1)) - 1
            if w <= v:
                continue
            total_lines += 1
            # For commuting Hermitians P_u, P_v with G_u = -(i/2) P_u:
            # 4 g_{uv} = Re(<P_u P_v>) - <P_u><P_v>
            su, sv = p_states[u], p_states[v]
            dot_re = sum(su[i][0] * sv[i][0] + su[i][1] * sv[i][1] for i in range(8))
            four_g = abs(Fraction(dot_re, norm_sq) - mu_vals[u] * mu_vals[v])
            if four_g > Fraction(1, 3):
                violated_lines += 1
                hi_vals.add(four_g)
            else:
                lo_vals.add(four_g)

    return {
        "flat_mu": Fraction(1, 3),
        "total_lines": total_lines,
        "violated_lines": violated_lines,
        "beta_nchv": total_lines - 2 * violated_lines,
        "hi_4g": max(hi_vals),
        "lo_4g": min(lo_vals),
    }


def verify_c3_cospectral_exact() -> dict[str, int | float]:
    """Exact integer construction of the 4-qubit C3 hyperplane-section cospectral twins."""
    p_map = {"I": 0, "X": 1, "Y": 2, "Z": 3}

    def enc4(s: str) -> int:
        return (p_map[s[0]] << 6) | (p_map[s[1]] << 4) | (p_map[s[2]] << 2) | p_map[s[3]]

    def build_real_pauli16(code: int) -> NDArray[np.int64] | None:
        ops = [(code >> (2 * (3 - q))) & 3 for q in range(4)]
        ny = sum(1 for op in ops if op == 2)
        if ny % 2 == 1:
            return None
        y_phase = -1 if ny == 2 else 1
        mat = np.zeros((16, 16), dtype=np.int64)
        for col in range(16):
            row = col
            sgn = y_phase
            for q, op in enumerate(ops):
                bit = 3 - q
                b = (col >> bit) & 1
                if op == 1:
                    row ^= 1 << bit
                elif op == 2:
                    row ^= 1 << bit
                    if b == 1:
                        sgn = -sgn
                elif op == 3 and b == 1:
                    sgn = -sgn
            mat[row, col] = sgn
        return mat

    def comm4(a: int, b: int) -> bool:
        sym = 0
        for q in range(4):
            oa = (a >> (2 * (3 - q))) & 3
            ob = (b >> (2 * (3 - q))) & 3
            if oa != 0 and ob != 0 and oa != ob:
                sym ^= 1
        return sym == 0

    d_code = enc4("ZIII")
    sec_h: list[tuple[int, NDArray[np.int64]]] = []
    out_o: list[NDArray[np.int64]] = []
    for c in range(1, 256):
        m = build_real_pauli16(c)
        if m is None:
            continue
        if comm4(c, d_code):
            sec_h.append((c, m))
        else:
            out_o.append(m)

    neg0 = {enc4(s) for s in ("IIZZ", "IYYI", "ZIZZ", "ZYYI")}
    neg1 = {enc4(s) for s in ("IYXY", "ZIIZ", "ZIZZ", "ZYXY")}

    a0 = sum((-m if c in neg0 else m) for c, m in sec_h)
    a1 = sum((-m if c in neg1 else m) for c, m in sec_h)
    assert isinstance(a0, np.ndarray) and isinstance(a1, np.ndarray)

    e0 = np.sort(np.linalg.eigvalsh(a0.astype(np.float64)))
    e1 = np.sort(np.linalg.eigvalsh(a1.astype(np.float64)))
    eig_diff = float(np.max(np.abs(e0 - e1)))

    def jordan_traces(a_mat: NDArray[np.int64]) -> tuple[int, int]:
        n_o = len(out_o)
        # 32 * L_{qp} = Tr(M_q (A M_p + M_p A)) is an exact integer (L_{qp} = (1/32)*...)
        l_mat = np.zeros((n_o, n_o), dtype=np.int64)
        for p, mp in enumerate(out_o):
            anticomm = a_mat @ mp + mp @ a_mat
            for q, mq in enumerate(out_o):
                val = int(np.sum(mq * anticomm))
                assert val % 32 == 0
                l_mat[q, p] = val // 32
        l2 = l_mat @ l_mat
        tr2 = int(np.trace(l2))
        tr3 = int(np.trace(l2 @ l_mat))
        return tr2, tr3

    tr2_0, tr3_0 = jordan_traces(a0)
    tr2_1, tr3_1 = jordan_traces(a1)
    return {
        "section_size": len(sec_h),
        "outside_size": len(out_o),
        "eig_max_diff": eig_diff,
        "tr2_sigma0": tr2_0,
        "tr2_sigma1": tr2_1,
        "tr3_sigma0": tr3_0,
        "tr3_sigma1": tr3_1,
    }


# ---------------------------------------------------------------------------
# 3. Independent Complex-Kronecker 7-Site FMO GKSL & Secular Pauli-Forster
# ---------------------------------------------------------------------------

FMO_HAMILTONIAN_CM: NDArray[np.float64] = np.array(
    [
        [200.0, -87.7, 5.5, -5.9, 6.7, -13.7, -9.9],
        [-87.7, 320.0, 30.8, 8.2, 0.7, 11.8, 4.3],
        [5.5, 30.8, 0.0, -53.5, -2.2, -9.6, 6.0],
        [-5.9, 8.2, -53.5, 110.0, -70.7, -17.0, -63.3],
        [6.7, 0.7, -2.2, -70.7, 270.0, 81.1, -1.3],
        [-13.7, 11.8, -9.6, -17.0, 81.1, 420.0, 39.7],
        [-9.9, 4.3, 6.0, -63.3, -1.3, 39.7, 230.0],
    ],
    dtype=np.float64,
)
CM_TO_PS_INV = 0.1883651567


def solve_fmo_gksl(gamma_deph_ps: float, k_loss: float = 0.025, k_trap: float = 1.0) -> dict[str, float]:
    """Exact complex Kronecker-product superoperator solution L vec(R) = -vec(rho(0))."""
    n = 7
    h_mat = FMO_HAMILTONIAN_CM * CM_TO_PS_INV
    eye = np.eye(n, dtype=np.complex128)
    # Using row-stacking vec(A X B) = (A kron B^T) vec(X):
    liouv = -1j * (np.kron(h_mat, eye) - np.kron(eye, h_mat.T))
    # Pure dephasing sum_m (P_m kron P_m - 0.5*(P_m kron I + I kron P_m))
    g = max(0.0, float(gamma_deph_ps))
    for m in range(n):
        pm = np.zeros((n, n), dtype=np.complex128)
        pm[m, m] = 1.0
        liouv += g * (np.kron(pm, pm) - 0.5 * (np.kron(pm, eye) + np.kron(eye, pm)))
    # Uniform loss and BChl-3 (index 2) trap anticommutator
    liouv -= k_loss * np.eye(n * n, dtype=np.complex128)
    p3 = np.zeros((n, n), dtype=np.complex128)
    p3[2, 2] = 1.0
    liouv -= 0.5 * k_trap * (np.kron(p3, eye) + np.kron(eye, p3))

    rho0 = np.zeros((n, n), dtype=np.complex128)
    rho0[0, 0] = 1.0
    r_vec = np.linalg.solve(liouv, -rho0.reshape(-1))
    r_mat = r_vec.reshape((n, n))
    sink_eff = float(np.real(k_trap * r_mat[2, 2]))
    loss_eff = float(np.real(k_loss * np.trace(r_mat)))
    return {"sink_eff": sink_eff, "loss_eff": loss_eff, "yield_sum": sink_eff + loss_eff}


def solve_fmo_forster(gamma_deph_ps: float, k_loss: float = 0.025, k_trap: float = 1.0) -> float:
    """Zero-free-parameter adiabatic secular Pauli-Forster hopping limit."""
    n = 7
    h_mat = FMO_HAMILTONIAN_CM * CM_TO_PS_INV
    g = max(0.05, float(gamma_deph_ps))
    m_mat = np.zeros((n, n), dtype=np.float64)
    for i in range(n):
        out_sum = k_loss + (k_trap if i == 2 else 0.0)
        for j in range(n):
            if i == j:
                continue
            j_ij = h_mat[i, j]
            de = h_mat[i, i] - h_mat[j, j]
            g_ij = g + k_loss + (0.5 * k_trap if i == 2 else 0.0) + (0.5 * k_trap if j == 2 else 0.0)
            w = (2.0 * j_ij * j_ij * g_ij) / (g_ij * g_ij + de * de)
            m_mat[j, i] += w
            out_sum += w
        m_mat[i, i] = -out_sum
    rhs = np.zeros(n, dtype=np.float64)
    rhs[0] = -1.0
    sol = np.linalg.solve(m_mat, rhs)
    return float(k_trap * sol[2])


# ---------------------------------------------------------------------------
# 4. Independent Complex-Kronecker 8x8 Cryptochrome-4 Liouville-Haberkorn
# ---------------------------------------------------------------------------


def solve_cry4_haberkorn(
    bx: float,
    by: float,
    bz: float,
    *,
    field_ut: float = 48.5,
    k_s: float = 1.0,
    k_t: float = 1.25,
    a_z: float = 14.0,
    a_perp: float = 1.8,
    gamma_spin: float = 0.0,
    rf_amp_ut: float = 0.0,
    rf_freq_rad_us: float | None = None,
) -> dict[str, float]:
    """Exact 8x8 complex Kronecker-product Cryptochrome-4 radical-pair solver."""
    sx = 0.5 * np.array([[0, 1], [1, 0]], dtype=np.complex128)
    sy = 0.5 * np.array([[0, -1j], [1j, 0]], dtype=np.complex128)
    sz = 0.5 * np.array([[1, 0], [0, -1]], dtype=np.complex128)
    i2 = np.eye(2, dtype=np.complex128)

    s1x = np.kron(np.kron(sx, i2), i2)
    s1y = np.kron(np.kron(sy, i2), i2)
    s1z = np.kron(np.kron(sz, i2), i2)
    s2x = np.kron(np.kron(i2, sx), i2)
    s2y = np.kron(np.kron(i2, sy), i2)
    s2z = np.kron(np.kron(i2, sz), i2)
    ix = np.kron(np.kron(i2, i2), sx)
    iy = np.kron(np.kron(i2, i2), sy)
    iz = np.kron(np.kron(i2, i2), sz)
    i8 = np.eye(8, dtype=np.complex128)

    p_s = 0.25 * i8 - (s1x @ s2x + s1y @ s2y + s1z @ s2z)
    p_t = i8 - p_s

    omega_l = 0.176 * field_ut
    rf_freq = omega_l if rf_freq_rad_us is None else rf_freq_rad_us
    omega_rabi = 0.176 * rf_amp_ut * 28.0
    k_line = 0.5 * (k_s + k_t) + 0.35
    gamma_rf = (
        (omega_rabi * omega_rabi * k_line) / (k_line * k_line + (rf_freq - omega_l) ** 2)
        if rf_amp_ut > 0.0
        else 0.0
    )
    gamma_perp = gamma_spin + gamma_rf
    gamma_z = gamma_spin

    nb = math.sqrt(bx * bx + by * by + bz * bz) or 1.0
    ox, oy, oz = omega_l * bx / nb, omega_l * by / nb, omega_l * bz / nb
    h_mat = (
        ox * (s1x + s2x)
        + oy * (s1y + s2y)
        + oz * (s1z + s2z)
        + a_perp * (s1x @ ix + s1y @ iy)
        + a_z * (s1z @ iz)
    )

    liouv = -1j * (np.kron(h_mat, i8) - np.kron(i8, h_mat.T))
    liouv -= 0.5 * k_s * (np.kron(p_s, i8) + np.kron(i8, p_s.T))
    liouv -= 0.5 * k_t * (np.kron(p_t, i8) + np.kron(i8, p_t.T))

    def add_lindblad(op: NDArray[np.complex128], rate: float) -> None:
        nonlocal liouv
        if rate <= 0.0:
            return
        od_o = op.conj().T @ op
        liouv += rate * (
            np.kron(op, op.conj()) - 0.5 * (np.kron(od_o, i8) + np.kron(i8, od_o.T))
        )

    for op in (s1x, s1y, s2x, s2y):
        add_lindblad(op, gamma_perp)
    for op in (s1z, s2z):
        add_lindblad(op, gamma_z)

    rho0 = p_s / 2.0
    r_vec = np.linalg.solve(liouv, -rho0.reshape(-1))
    r_mat = r_vec.reshape((8, 8))
    phi_s = float(np.real(k_s * np.trace(p_s @ r_mat)))
    phi_t = float(np.real(k_t * np.trace(p_t @ r_mat)))
    return {"phi_s": phi_s, "phi_t": phi_t, "yield_sum": phi_s + phi_t}


# ---------------------------------------------------------------------------
# 5. Exact Rational Poincare-Disk Mobius Addition & Hyperbolic Distance
# ---------------------------------------------------------------------------


def poincare_mobius_add_exact(
    ux: Fraction, uy: Fraction, vx: Fraction, vy: Fraction
) -> tuple[Fraction, Fraction]:
    """Exact rational Ungar Mobius addition u (+) v on the unit Poincare disk."""
    u2 = ux * ux + uy * uy
    v2 = vx * vx + vy * vy
    uv2 = 2 * (ux * vx + uy * vy)
    denom = 1 + uv2 + u2 * v2
    if denom <= 0:
        raise ValueError("Mobius denominator must be strictly positive inside the unit disk")
    c_u = 1 + uv2 + v2
    c_v = 1 - u2
    return (c_u * ux + c_v * vx) / denom, (c_u * uy + c_v * vy) / denom


def poincare_dist(ux: float, uy: float, vx: float, vy: float) -> float:
    """Exact Riemannian hyperbolic distance on (D^2, K = -1)."""
    du, dv = ux - vx, uy - vy
    num = 2.0 * (du * du + dv * dv)
    den = (1.0 - (ux * ux + uy * uy)) * (1.0 - (vx * vx + vy * vy))
    if den <= 0.0:
        raise ValueError("Points must lie strictly inside the open unit disk")
    return math.acosh(max(1.0, 1.0 + num / den))
