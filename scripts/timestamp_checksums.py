"""Mint and verify a standard RFC 3161 cryptographic timestamp (DigiCert TSA) on CHECKSUMS.sha256.

Uses pure Python DER encoding for RFC 3161 TimeStampReq (SHA-256 OID 2.16.840.1.101.3.4.2.1)
against the public DigiCert RFC 3161 service (`http://timestamp.digicert.com`), saves the raw
DER TimeStampResp to `data/timestamps/CHECKSUMS.sha256.tsr`, and verifies that the returned
TimeStampResp has PKIStatus=0 (granted) and embeds the exact SHA-256 imprint of CHECKSUMS.sha256.
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
DIGICERT_TSA_URL = "http://timestamp.digicert.com"


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
    # OID 2.16.840.1.101.3.4.2.1 (id-sha256)
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
    # PKIStatusInfo SEQUENCE { status INTEGER 0 } starts near the front
    if b"\x30\x03\x02\x01\x00" not in tsr_bytes[:32]:
        raise ValueError("RFC 3161 TSA did not return PKIStatus=0 (granted)")
    sha256_oid_der = bytes([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])
    if sha256_oid_der not in tsr_bytes:
        raise ValueError("RFC 3161 response missing SHA-256 OID")
    if expected_digest not in tsr_bytes:
        raise ValueError("RFC 3161 response does not contain the exact SHA-256 imprint of CHECKSUMS.sha256!")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-only", action="store_true", help="Verify existing .tsr against CHECKSUMS.sha256")
    args = parser.parse_args()

    digest = hashlib.sha256(CHECKSUMS_PATH.read_bytes()).digest()
    if args.verify_only:
        if not TSR_PATH.exists():
            raise FileNotFoundError(f"Missing {TSR_PATH}")
        tsr = TSR_PATH.read_bytes()
        verify_tsr(tsr, digest)
        print(
            f"PASS: Verified DigiCert RFC 3161 TSA token ({len(tsr):,} bytes) matches "
            f"CHECKSUMS.sha256 digest {digest.hex()}."
        )
        return

    tsq = build_tsq(digest)
    req = urllib.request.Request(
        DIGICERT_TSA_URL,
        data=tsq,
        headers={
            "Content-Type": "application/timestamp-query",
            "User-Agent": "GlitchlingRFC3161/2.3.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20.0) as resp:  # noqa: S310
        tsr = resp.read()
    verify_tsr(tsr, digest)
    TSR_PATH.parent.mkdir(parents=True, exist_ok=True)
    TSR_PATH.write_bytes(tsr)
    print(
        f"PASS: Minted & verified DigiCert RFC 3161 TSA token -> {TSR_PATH.relative_to(ROOT)} "
        f"({len(tsr):,} bytes, imprint={digest.hex()})."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)
