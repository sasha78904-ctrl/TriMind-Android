"""TriMind–HEXplorer experimental shadow compatibility policy.
Independent implementation; no HEXplorer C++ copied.
No ECU write, no automatic promotion of unverified maps.
"""
from __future__ import annotations

COMPARE = ("address_hex", "dimensions", "byte_length",
           "axis_x_raw", "axis_y_raw", "values_raw_flat")

def compare_records(trimind: dict, peer: dict | None, identity_status: str) -> dict:
    """Compare *observed* independently normalized records; fail closed.

    peer must be an actual independent parser export. Synthetic test peer
    records are NEVER evidence that HEXplorer itself was executed.
    """
    if identity_status == "EPK_MISMATCH":
        return {"status": "BLOCKED_IDENTITY_MISMATCH", "trusted": False,
                "flags": ["EPK_MISMATCH"]}
    if peer is None:
        return {"status": "NO_PEER_RESULT", "trusted": False,
                "flags": ["NO_HEXPLORER_RUNTIME_RESULT"]}

    flags = []
    if identity_status != "EPK_MATCH":
        flags.append("IDENTITY_UNVERIFIED")
    if trimind.get("status") != "STRUCTURE_VALID":
        flags.append("TRIMIND_NOT_STRUCTURE_VALID")
    if peer.get("status") != "STRUCTURE_VALID":
        flags.append("PEER_NOT_STRUCTURE_VALID")
    if peer.get("missing_bytes", False):
        flags.append("PEER_ZERO_FILLED_OR_MISSING_BYTES")
    if peer.get("axis_count_from_maximum", False):
        flags.append("PEER_ASSUMED_MAX_AXIS_LENGTH")
    if not peer.get("has_explicit_source_provenance", False):
        flags.append("PEER_PROVENANCE_UNVERIFIED")
    if not peer.get("memory_coverage_verified", False):
        flags.append("PEER_MEMORY_COVERAGE_UNVERIFIED")
    for key in COMPARE:
        if trimind.get(key) is None or peer.get(key) is None:
            flags.append("MISSING_" + key.upper())
        elif trimind[key] != peer[key]:
            flags.append("MISMATCH_" + key.upper())

    if not flags:
        return {"status": "AGREE_RAW_ONLY", "trusted": False, "flags": [],
                "note": "Raw values agree; physical semantics and ECU safety remain unverified."}
    status = ("UNVERIFIED_IDENTITY" if "IDENTITY_UNVERIFIED" in flags
              else "STRUCTURE_DISAGREEMENT"
              if "TRIMIND_NOT_STRUCTURE_VALID" in flags or "PEER_NOT_STRUCTURE_VALID" in flags
              else "EVIDENCE_CONFLICT")
    return {"status": status, "trusted": False, "flags": flags}

def use_peer_to_upgrade_trimind(*args, **kwargs):
    raise PermissionError("No automatic VERIFIED promotion from HEXplorer shadow results")
