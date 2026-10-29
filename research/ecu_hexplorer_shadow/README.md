# TriMind ECU — HEXplorer experimental shadow branch (2026-10-29)

This is an **isolated research branch**, `research/hexplorer-shadow-20261029`.
The existing Android app on `main`, TriMind v0.5 decoding code on Drive,
ECU archives, and verified map registries remain untouched.

## Scope

- **External source**: https://github.com/adhoc2/HEXplorer at `c67a73f2fd1b43a999012c95a04181c6d52e51aa`
  (Qt5 reference: `adhoc2/HEXplorer_qt5`, `69aa3382e3f679f27c7a8ba69414748c5c74dbbb`).
- **Eight upstream GPL-3.0-or-later source files have now been copied unchanged** to
  `vendor/HEXplorer/src/` (hexfile, data, a2l, lexer; CPP and headers). The
  author labels these GPLv3-or-later in source headers. Treat this research
  subtree as GPL-covered; review obligations before product integration.
- Current files implement **shadow comparison policy**, **not** native HEXplorer execution.
  The future HEXplorer adapter must provide an independent, provenance-rich JSON
  result. Synthetic peer results are only software tests.
- No ECU images are modified; no firmware flash functionality; no binary files executed.

## Confirmed incompatibilities in inspected source

1. HEXplorer `HexFile::getDecValues` may return **zero-filled arrays for unmapped addresses**;
   TriMind v0.5 rejects missing memory.
2. HEXplorer `Data::readHexValues` may use `MaxAxisPoints` where actual axis count is absent;
   TriMind treats missing count as unsupported.
3. TriMind v0.4/v0.5 uses an explicit **EPK compatibility gate**. No
   equivalent mandatory gate was established along the audited HEXplorer paths.
4. HEXplorer has more A2L conversion pathways, but some `FORM` and `LINEAR`
   branches in `Data::hex2phys` are empty. Neither decoder is a complete ASAP2 reference.
5. Byte-order defaults/overrides require strict differential checks.
6. HEXplorer diagnostic-model properties are A2L-guided and are **not** evidence
   of independent DTC-off discovery.

## Run synthetic policy tests (Python standard library)

```sh
cd research/ecu_hexplorer_shadow
python -m unittest -v test_policy.py
```

## Real EDC16 control already executed locally

Files read from verified user Drive:
- A2L: `edc16_13.a2l` (4,479,165 bytes);
- Intel HEX: `edc16__CAN_Motor.hex` (3,528,883 bytes).

Observed with the user-owned TriMind v0.5 Python modules: **145 MAP described,
145 STRUCTURE_UNVERIFIED_IDENTITY, 0 trusted**; EPK identity UNKNOWN.
Removing one byte *in a temporary in-memory copy* changes the first map from
`STRUCTURE_UNVERIFIED_IDENTITY` to `UNSUPPORTED: address_not_in_HEX`.

**Not tested**: native HEXplorer output on that A2L/HEX pair. An equality result
from the current ten synthetic policy tests must not be presented as a real
HEXplorer-vs-TriMind benchmark.

## Criteria to promote the branch beyond research

1. Clarify upstream code license or use an independently written interface.
2. Build and execute the upstream Qt C++ software in a reproducible, sandboxed environment.
3. Export independent A2L/HEX parse results with source provenance and no zero-filling.
4. Run differential validation on MED9.1, EDC16, MS42, Porsche, mismatched EPK,
   missing bytes, invalid checksums, and absent axis count.
5. Keep `main` unchanged until independent holdout tests and a reviewed change proposal.

## Simple practical test on user ECU file (2026-10-29)

The **copied original files** are in `vendor/HEXplorer/src`. The tested
`hexplorer_raw_probe.cpp` is a **small STL-only C++ adaptation** of the raw-value
algorithm documented in upstream `HexFile::getDecValues`, not a Qt binary
or a standalone HEXplorer A2L parser.

Tested locally on Mercedes `mers nov` (SHA-256
`7a5f38048e4454e9ada5798f7584bf2167e5d823b54722ae8934a4632648879c`),
using `edc16_13.a2l` as **unmatched** A2L and `0x800000` **hypothetical** base.
The A2L record schemas were exported with TriMind's existing parser, **so
independent A2L parsing has not yet been verified**.

- TriMind v0.5: 2 structurally possible candidates / 145; 0 verified maps.
- Standalone C++ raw reader: 3 raw readings / 145; 0 verified maps.
- Shared 2 candidate axes and Z matched exactly.
- Additional `PCR_pDvtMin_MAP` (9x8) has nonmonotonic X/Y; TriMind
  rejects with `non_monotonic_axes`.
- Test package and full result: user-private Google Drive
  `TriMind_ECU/REPORTS/TriMind_HEXplorer_Copied_Code_mers_nov_Test_20261029.zip`.

Run the small C++ reader (with user-owned inputs extracted locally):

```sh
g++ -std=c++17 -O2 -Wall -Wextra -pedantic hexplorer_raw_probe.cpp -o hexplorer_raw_probe
./hexplorer_raw_probe mers_nov.bin mapspec.tsv raw_results.tsv
```

Do not upload user BIN or private A2L files to the public repository.

## Licensing notice

The copied HEXplorer sources remain under copyright Christophe Hoel, licensed
GPL version 3 or any later version per their source headers. See
https://www.gnu.org/licenses/gpl-3.0.html ; no proprietary code migration
or merge into Android `main` is authorized by this experiment.
