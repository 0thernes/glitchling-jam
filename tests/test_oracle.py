"""Pytest + Hypothesis property-based, negative, and metamorphic test suite (`B06`, `B10`, `B14`)."""

from __future__ import annotations

import math
from fractions import Fraction

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from reference.glitchling_oracle import (
    gf16_inv,
    gf16_mul,
    poincare_dist,
    poincare_mobius_add_exact,
    rs15_11_encode,
    rs15_11_syndromes,
    solve_cry4_haberkorn,
    solve_fmo_forster,
    solve_fmo_gksl,
    verify_c3_cospectral_exact,
    verify_cega18_exact,
    verify_hoggar_exact,
)


@given(
    a=st.integers(min_value=0, max_value=15),
    b=st.integers(min_value=0, max_value=15),
    c=st.integers(min_value=0, max_value=15),
)
@settings(max_examples=200)
def test_gf16_field_properties(a: int, b: int, c: int) -> None:
    assert gf16_mul(a, b) == gf16_mul(b, a)
    assert gf16_mul(gf16_mul(a, b), c) == gf16_mul(a, gf16_mul(b, c))
    assert gf16_mul(a, b ^ c) == (gf16_mul(a, b) ^ gf16_mul(a, c))
    if a != 0:
        assert gf16_mul(a, gf16_inv(a)) == 1


def test_gf16_inv_zero_raises() -> None:
    with pytest.raises(ZeroDivisionError):
        gf16_inv(0)


@given(msg=st.lists(st.integers(min_value=0, max_value=15), min_size=11, max_size=11))
@settings(max_examples=150)
def test_rs15_11_zero_syndromes_property(msg: list[int]) -> None:
    cw = rs15_11_encode(msg)
    assert len(cw) == 15
    assert cw[:11] == msg
    assert rs15_11_syndromes(cw) == [0, 0, 0, 0]


def test_rs15_11_negative_wrong_length() -> None:
    with pytest.raises(ValueError):
        rs15_11_encode([1, 2, 3])
    with pytest.raises(ValueError):
        rs15_11_syndromes([0] * 14)


@given(
    ux=st.integers(min_value=-6, max_value=6),
    uy=st.integers(min_value=-6, max_value=6),
    vx=st.integers(min_value=-6, max_value=6),
    vy=st.integers(min_value=-6, max_value=6),
)
@settings(max_examples=200)
def test_poincare_mobius_exact_norm_law(ux: int, uy: int, vx: int, vy: int) -> None:
    u_x, u_y = Fraction(ux, 10), Fraction(uy, 10)
    v_x, v_y = Fraction(vx, 10), Fraction(vy, 10)
    u2 = u_x * u_x + u_y * u_y
    v2 = v_x * v_x + v_y * v_y
    if u2 >= 1 or v2 >= 1:
        return
    rx, ry = poincare_mobius_add_exact(u_x, u_y, v_x, v_y)
    r2 = rx * rx + ry * ry
    assert r2 < 1
    expected_gap = (1 - u2) * (1 - v2) / (1 + 2 * (u_x * v_x + u_y * v_y) + u2 * v2)
    assert 1 - r2 == expected_gap


def test_poincare_dist_boundary_negative() -> None:
    with pytest.raises(ValueError):
        poincare_dist(1.0, 0.0, 0.0, 0.0)


def test_fmo_enaqt_and_high_dephasing_correspondence() -> None:
    cryo = solve_fmo_gksl(0.08)
    room = solve_fmo_gksl(22.0)
    zeno = solve_fmo_gksl(518.0)
    forster_room = solve_fmo_forster(22.0)
    forster_zeno = solve_fmo_forster(518.0)
    assert math.isclose(cryo["yield_sum"], 1.0, abs_tol=1e-12)
    assert math.isclose(room["yield_sum"], 1.0, abs_tol=1e-12)
    assert cryo["sink_eff"] < room["sink_eff"] > zeno["sink_eff"]
    assert room["sink_eff"] > forster_room
    assert abs(zeno["sink_eff"] - forster_zeno) < 5e-5


def test_cry4_inversion_and_rf_metamorphic() -> None:
    pos = solve_cry4_haberkorn(0.4, -0.3, 0.8660254037844386)
    neg = solve_cry4_haberkorn(-0.4, 0.3, -0.8660254037844386)
    assert abs(pos["phi_s"] - neg["phi_s"]) < 1e-14
    assert math.isclose(pos["yield_sum"], 1.0, abs_tol=1e-13)
    # Resonant Larmor RF vs far-off-resonant RF anisotropy
    w_l = 0.176 * 48.5
    par_res = solve_cry4_haberkorn(0.0, 0.0, 1.0, rf_amp_ut=1.5, rf_freq_rad_us=w_l)["phi_s"]
    per_res = solve_cry4_haberkorn(1.0, 0.0, 0.0, rf_amp_ut=1.5, rf_freq_rad_us=w_l)["phi_s"]
    par_off = solve_cry4_haberkorn(0.0, 0.0, 1.0, rf_amp_ut=1.5, rf_freq_rad_us=7.0 * w_l)["phi_s"]
    per_off = solve_cry4_haberkorn(1.0, 0.0, 0.0, rf_amp_ut=1.5, rf_freq_rad_us=7.0 * w_l)["phi_s"]
    assert abs(par_res - per_res) < abs(par_off - per_off)


def test_contextuality_suites_exact() -> None:
    cega = verify_cega18_exact()
    assert cega["ortho_ok"] is True
    assert cega["all_multiplicity_two"] is True
    assert cega["classical_max"] == 8
    hoggar = verify_hoggar_exact()
    assert hoggar["total_lines"] == 315
    assert hoggar["violated_lines"] == 63
    assert hoggar["beta_nchv"] == 189
    c3 = verify_c3_cospectral_exact()
    assert c3["eig_max_diff"] < 1e-12
    assert c3["tr3_sigma0"] == 14976
    assert c3["tr3_sigma1"] == 15360
