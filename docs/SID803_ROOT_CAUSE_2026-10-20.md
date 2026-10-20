# SID803 — root cause investigation (20 Oct 2026)

Read-only analysis of Po0a0031.bin (458752 bytes) and po0a0031.a2l (5086061 bytes), SHA-256 previously recorded in stage1.

## Reproduced
- 414/414 A2L MAP records structurally extracted, **not independently verified**.
- 219 MAP Z tables contain one repeated raw value: 0 (85 maps), 32768 (82), 5120 (9), 16384 (7), 63750 (7), 65535 (6).
- 60 constant-axis instances (not necessarily 60 unique maps). ip_load_clc__n_32__maf: two zero-filled axes and zero-filled Z.
- 828 AXIS_DESCR vs AXIS_PTS conversion method references compared, zero mismatches.
- One descending axis was flagged; this is not intrinsically an error.

## Likely contributing factors and unproven hypotheses
1. Flat Z and axis values may be defaults, disabled/inactive calibrations, or legitimate constants. They do NOT prove DTC/DPF/EGR deletion, firmware mismatch, or wrong decoder output.
2. **Confirmed code limitation:** stage2 decoder reads Z directly from CHARACTERISTIC address as a contiguous array using FNC_VALUES type; it does not interpret complete RECORD_LAYOUT positions, alignment, address translation, or map orientation. Thus a structural decode does not imply correct map cell decoding.
3. Axis data is aligned by point type width but A2L alignment directives and all layout variants are not yet handled.
4. Previous anomaly counts are screening indicators only, not a map accuracy metric.

## Next acceptance gate
Implement a complete RECORD_LAYOUT parser with explicit byte offsets; verify axis addressing, endian, conversion, row/column orientation, physical plausibility, and firmware pairing. Validate at least 10 maps against an independent annotated reference. Only then integrate into Android. Never label all 414 as validated.
