# SID803 stage 2 — A2L-guided 2D MAP structural decoding

Inputs: `Po0a0031.bin` and `po0a0031.a2l` in user's Google Drive, no proprietary data committed. Standalone Python decoder and 3 regression tests are available in the ChatGPT conversation (`trimind_map_stage2.py`, `test_trimind_map_stage2.py`).

## Measured output
- 414 A2L `MAP` entries processed.
- 414 entries structurally decoded using referenced `AXIS_PTS`, axis count, typed X/Y values, typed Z values, and `COMPU_METHOD` rational coefficients when present.
- 3/3 synthetic tests passed, including valid 2x2 map, invalid axis count, truncated binary.
- Example `ip_kr_pi_pcv__n_32__drv1_fup_sp`: address `0x5044c`, dimensions `4x4`, Z raw starts `[8192,3277,3277,8192,8192]` (UWORD); X axis raw `[26,38,63,125]` (requires independent validation of address alignment).

**Critical limitations:** This is structural extraction under the A2L-described layout assumptions, **not** 414 independently validated ECU maps. Firmware/A2L identity, field alignment conventions, column/row orientation, and physical plausibility have not been independently confirmed. Do not use these values for ECU flashing or tuning. No verified map recognition precision/recall or DTC OFF capability. Next step: verify >=10 map address ranges/axes against an independent reference, then integrate read-only core into Android and add CI tests.
