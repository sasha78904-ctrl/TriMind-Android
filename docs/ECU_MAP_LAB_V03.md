# TriMind ECU Map Lab v0.3 — verified prototype

This branch introduces a **read-only ECU map recognition research track** alongside the existing TriMind Android AI application. It is **not** an Android APK or a validated map editor.

## Reproducible baseline, 2026-10-20

Using the available Volvo firmware/A2L pairs and the earlier v0.2 scanner:

| ECU | A2L MAP starting offsets | axis-like uint16 candidates (capped) | exact address intersections |
|---|---:|---:|---:|
| Siemens SID803 | 414 | 299 | 0 |
| Bosch ME7 | 161 | 300 | 2 |

These are **not map detection precision/recall**: a map's start address and an axis start address are not the same object. The overlap test is a negative control demonstrating why a naive monotonic uint16 heuristic is inadequate. Do not present 0% or 1.24% as map recognition accuracy.

## Implementation requirements

1. Parse full ASAP2/A2L RECORD_LAYOUT, AXIS_DESCR, COMPU_METHOD, COMPU_TAB, and byte order.
2. Validate file-to-ECU address translation, firmware SW/HW IDs, and map dimensions before calling a map confirmed.
3. Extract signed/unsigned 8/16/32-bit and floating-point Z values and physical axes.
4. Deduplicate overlapping candidates, retain evidence and confidence, report precision/recall only against aligned reference labels.
5. Compare ORI/MOD by SHA-256, exact byte regions, and verified calibration address ranges.
6. Never claim DTC OFF or checksum correctness without ECU-specific validated mappings.

## Local test package

A self-contained **offline HTML test page** and Python reference analyzer are available as a separate test archive supplied in the ChatGPT conversation. No firmware binaries, DAMOS files, cracked executables or keygens are committed here.

## Android integration

Proposed next step: add a local document picker for BIN/A2L, read-only native/JS parsing, and on-device report export. Keep firmware local and separate from cloud AI requests. GitHub Actions must build/sign a debug APK before any Android APK can be claimed tested.
