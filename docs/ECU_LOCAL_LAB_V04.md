# TriMind ECU LocalLab v0.4 test release

Test artifact: `TriMind_ECU_LocalLab_v0.4_TEST.zip` distributed in the ChatGPT conversation, not uploaded to this repository.

Local Python 3.10+ HTTP server binds `127.0.0.1:8765`, serves a read-only HTML interface, accepts BIN/ORI, optional MOD and A2L (40 MiB aggregate limit), returns SHA-256, byte-diff spans, A2L characteristic summaries, raw scalar decoding when byte order is known, and **A2L start-address overlaps only**. No validated 2D map decoding, DTC OFF, checksum repair, or firmware editing. No third-party binaries bundled.

Local verification: `python test_local.py`: 3/3 pass; GET `/` on port 18765 returned the expected UI. ZIP SHA-256: `cac760cbc3eb39c797c7fed8f30674b090de8a399a18a693c14bbf1e97b99d66`.

**Not an APK.** Android packaging and real-device tests are pending. The ZIP and its source code must be independently reviewed before merging any part into the Android application.
