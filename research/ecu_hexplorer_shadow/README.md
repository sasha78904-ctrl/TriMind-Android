# TriMind ECU — HEXplorer experimental shadow branch (2026-10-29)

This is an **isolated research branch**, `research/hexplorer-shadow-20261029`.
The existing Android app on `main`, TriMind v0.5 decoding code on Drive,
ECU archives, and verified map registries remain untouched.

## Scope

- **External source**: https://github.com/adhoc2/HEXplorer at `c67a73f2fd1b43a999012c95a04181c6d52e51aa`
  (Qt5 reference: `adhoc2/HEXplorer_qt5`, `69aa3382e3f679f27c7a8ba69414748c5c74dbbb`).
- **No third-party source files were copied** into TriMind. The upstream repository
  lacks an obvious explicit LICENSE file; author permission/licensing must be
  established before redistributing or adapting its C++ source.
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
