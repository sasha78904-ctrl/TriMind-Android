# SID803 A2L decoder — stage 1 (real file test)

Input Google Drive pair: `Po0a0031.bin` (458752 bytes, SHA-256 `1f9f3ad6bf7785872e9d7ef28dbe9080500f74e425e4d86d4844f12c99da080b`), `po0a0031.a2l` (5086061 bytes, SHA-256 `1e6bd410c2ea4af5fca50bb88edeaa8eb5501761c440131c45816a33bc31ca1a`). No proprietary input committed.

Read-only Python prototype, available in the corresponding ChatGPT conversation, parsed 4768 CHARACTERISTIC blocks, 20 RECORD_LAYOUT entries with FNC_VALUES, 445 COEFFS conversion methods. MSB_FIRST detected. First 30 scalar VALUE entries decoded, with raw and rational conversion values. Examples: `c_accin_conf` @ `0x49d07` UBYTE raw 3 physical 3; `c_acp_cfa_max_1` @ `0x49d08` UBYTE raw 74, conversion gives 6.087096774 kPa; `c_acp_cfa_max_2` @ `0x49d09` UBYTE raw 58, conversion gives 4.770967742 kPa. 3 synthetic tests pass.

**Not verified maps:** no 1D/2D/3D map axes decoded yet, firmware/A2L identity not independently confirmed, no ECU DTC recognition. Never count this as 30 recognized maps. Next: nested A2L parsing and verified AXIS_PTS_REF with RECORD_LAYOUT and address validation.
