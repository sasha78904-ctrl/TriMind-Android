#!/usr/bin/env python3
"""Real read-only TriMind EDC16 regression; does not run HEXplorer native code."""
from __future__ import annotations
import argparse, sys, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--a2l", type=Path, required=True)
p.add_argument("--hex", type=Path, required=True)
p.add_argument("--decoder-dir", type=Path, required=True)
args = p.parse_args()
sys.path.insert(0, str(args.decoder_dir.resolve()))
from trimind_decoder_v05 import run, load_v05, decode_v05
from trimind_decoder_v03 import read_hex

result = run(args.a2l, args.hex)
assert result["summary"]["described"] == 145, result["summary"]
assert result["summary"]["trusted"] == 0, result["summary"]
assert result["identity"]["status"] == "IDENTITY_UNKNOWN", result["identity"]

parsed = load_v05(args.a2l)
mem = read_hex(args.hex)["memory"]
first = parsed["maps"][0]
original = decode_v05(first, parsed, mem, result["identity"]["status"])
assert original["status"] == "STRUCTURE_UNVERIFIED_IDENTITY", original
mutated = mem.copy()  # never alter original source data
mutated.pop(first["address"], None)
negative = decode_v05(first, parsed, mutated, result["identity"]["status"])
assert negative["status"] == "UNSUPPORTED" and negative["reason"] == "address_not_in_HEX", negative
print(json.dumps({
    "suite": "TRIMIND_ECU_REAL_EDC16_NO_HEXPLORER_EXECUTION",
    "maps": result["summary"]["described"],
    "trusted": result["summary"]["trusted"],
    "identity": result["identity"]["status"],
    "first_map": first["name"],
    "first_map_original": original["status"],
    "first_map_missing_byte": {"status": negative["status"], "reason": negative["reason"]},
    "source_data_modified": False, "tests_passed": 5
}, ensure_ascii=False, indent=2))
