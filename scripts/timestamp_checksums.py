"""Mint and verify dual cryptographic timestamps on CHECKSUMS.sha256:
  1. DigiCert RFC 3161 TSA token (`data/timestamps/CHECKSUMS.sha256.tsr`)
  2. Bitcoin OpenTimestamps proof (`data/timestamps/CHECKSUMS.sha256.ots`)

Uses pure Python DER encoding for RFC 3161 TimeStampReq (SHA-256 OID 2.16.840.1.101.3.4.2.1)
and pure Python OpenTimestamps v1 wire framing against independent public OTS calendar servers
(zero third-party binaries or CAPTCHA/PoW bypasses).
"""

from __future__ import annotations

import argparse
import hashlib
import secrets
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHECKSUMS_PATH = ROOT / "CHECKSUMS.sha256"
TSR_PATH = ROOT / "data" / "timestamps" / "CHECKSUMS.sha256.tsr"
OTS_PATH = ROOT / "data" / "timestamps" / "CHECKSUMS.sha256.ots"

DIGICERT_TSA_URL = "http://timestamp.digicert.com"
OTS_CALENDARS = (
    "https://a.pool.opentimestamps.org/digest",
    "https://b.pool.opentimestamps.org/digest",
    "https://a.pool.eternitywall.com/digest",
)
OTS_HEADER_MAGIC = (
    b"\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
    b"\x01"  # v1
    b"\x08"  # OpSHA256
)
OTS_PENDING_ATTESTATION_TAG = bytes.fromhex("83dfe30d2ef90c8e")
OTS_BITCOIN_ATTESTATION_TAG = bytes.fromhex("0588960d73d71901")


def der_len(n: int) -> bytes:
    if n < 0x80:
        return bytes([n])
    raw = n.to_bytes((n.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(raw)]) + raw


def der_tlv(tag: int, val: bytes) -> bytes:
    return bytes([tag]) + der_len(len(val)) + val


def build_tsq(digest: bytes) -> bytes:
    """Build RFC 3161 TimeStampReq (DER) for a 32-byte SHA-256 digest."""
    if len(digest) != 32:
        raise ValueError("Expected 32-byte SHA-256 digest")
    sha256_oid = der_tlv(0x06, bytes([0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]))
    alg_id = der_tlv(0x30, sha256_oid + b"\x05\x00")
    msg_imprint = der_tlv(0x30, alg_id + der_tlv(0x04, digest))
    version = der_tlv(0x02, b"\x01")
    nonce_bytes = secrets.token_bytes(8)
    if nonce_bytes[0] & 0x80:
        nonce_bytes = b"\x00" + nonce_bytes
    nonce = der_tlv(0x02, nonce_bytes)
    cert_req = der_tlv(0x01, b"\xff")
    return der_tlv(0x30, version + msg_imprint + nonce + cert_req)


def verify_tsr(tsr_bytes: bytes, expected_digest: bytes) -> None:
    """Verify DER TimeStampResp structure, PKIStatus=0 (granted), and exact SHA-256 imprint."""
    if len(tsr_bytes) < 200 or tsr_bytes[0] != 0x30:
        raise ValueError("Invalid DER TimeStampResp header or length")
    if b"\x30\x03\x02\x01\x00" not in tsr_bytes[:32]:
        raise ValueError("RFC 3161 TSA did not return PKIStatus=0 (granted)")
    sha256_oid_der = bytes([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])
    if sha256_oid_der not in tsr_bytes:
        raise ValueError("RFC 3161 response missing SHA-256 OID")
    if expected_digest not in tsr_bytes:
        raise ValueError("RFC 3161 response does not contain the exact SHA-256 imprint of CHECKSUMS.sha256!")


def mint_ots(digest: bytes) -> tuple[bytes, list[str]]:
    """Submit raw 32-byte SHA-256 digest to independent public OTS calendars and assemble v1 .ots proof."""
    subtrees: list[bytes] = []
    used_calendars: list[str] = []
    for url in OTS_CALENDARS:
        req = urllib.request.Request(
            url,
            data=digest,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/vnd.opentimestamps.v1",
                "User-Agent": "GlitchlingOTS/2.4.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20.0) as resp:  # noqa: S310
                body = resp.read()
            if OTS_PENDING_ATTESTATION_TAG in body or OTS_BITCOIN_ATTESTATION_TAG in body:
                subtrees.append(body)
                used_calendars.append(url)
        except Exception as exc:  # noqa: BLE001
            print(f"NOTE: OTS calendar {url} unavailable ({exc}); continuing with remaining calendars.")
    if not subtrees:
        raise RuntimeError("Failed to obtain OpenTimestamps attestation from any public calendar server.")
    # OTS v1 fork encoding: prefix every branch except the final one with 0xff
    payload = bytearray(OTS_HEADER_MAGIC)
    payload.extend(digest)
    for idx, subtree in enumerate(subtrees):
        if idx < len(subtrees) - 1:
            payload.append(0xFF)
        payload.extend(subtree)
    return bytes(payload), used_calendars


def verify_ots(ots_bytes: bytes, expected_digest: bytes) -> int:
    """Verify OTS v1 magic header, exact SHA-256 file digest, and attestation tag presence."""
    if not ots_bytes.startswith(OTS_HEADER_MAGIC):
        raise ValueError("Invalid OpenTimestamps v1 magic header or OpSHA256 tag")
    offset = len(OTS_HEADER_MAGIC)
    embedded_digest = ots_bytes[offset : offset + 32]
    if embedded_digest != expected_digest:
        raise ValueError("OpenTimestamps proof does not match the exact SHA-256 digest of CHECKSUMS.sha256!")
    pending_count = ots_bytes.count(OTS_PENDING_ATTESTATION_TAG)
    btc_count = ots_bytes.count(OTS_BITCOIN_ATTESTATION_TAG)
    if pending_count + btc_count < 1:
        raise ValueError("OpenTimestamps proof contains zero valid pending or Bitcoin attestations")
    return pending_count + btc_count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Verify existing .tsr (RFC 3161) and .ots (OpenTimestamps) proofs against CHECKSUMS.sha256",
    )
    args = parser.parse_args()

    digest = hashlib.sha256(CHECKSUMS_PATH.read_bytes()).digest()
    if args.verify_only:
        if not TSR_PATH.exists():
            raise FileNotFoundError(f"Missing {TSR_PATH}")
        if not OTS_PATH.exists():
            raise FileNotFoundError(f"Missing {OTS_PATH}")
        tsr = TSR_PATH.read_bytes()
        verify_tsr(tsr, digest)
        ots = OTS_PATH.read_bytes()
        n_att = verify_ots(ots, digest)
        print(
            f"PASS: Verified DigiCert RFC 3161 TSA ({len(tsr):,} bytes) AND Bitcoin OpenTimestamps "
            f"({len(ots):,} bytes, {n_att} calendar attestations) against CHECKSUMS.sha256 ({digest.hex()})."
        )
        return

    # 1. Mint DigiCert RFC 3161 TSA token
    tsq = build_tsq(digest)
    req = urllib.request.Request(
        DIGICERT_TSA_URL,
        data=tsq,
        headers={
            "Content-Type": "application/timestamp-query",
            "User-Agent": "GlitchlingRFC3161/2.4.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20.0) as resp:  # noqa: S310
        tsr = resp.read()
    verify_tsr(tsr, digest)
    TSR_PATH.parent.mkdir(parents=True, exist_ok=True)
    TSR_PATH.write_bytes(tsr)

    # 2. Mint Bitcoin OpenTimestamps proof
    ots, calendars = mint_ots(digest)
    n_att = verify_ots(ots, digest)
    OTS_PATH.write_bytes(ots)
    print(
        f"PASS: Minted & verified dual timestamps -> {TSR_PATH.relative_to(ROOT)} ({len(tsr):,} bytes) "
        f"& {OTS_PATH.relative_to(ROOT)} ({len(ots):,} bytes, {n_att} attestations via {len(calendars)} calendars; "
        f"imprint={digest.hex()})."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
