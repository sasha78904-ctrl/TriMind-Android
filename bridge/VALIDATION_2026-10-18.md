# TriMind Bridge — validation record (2026-10-18, Europe/Berlin)

## Observed, not inferred

- Repository `sasha78904-ctrl/TriMind-Android` accessible; Bridge module exists at `bridge/`.
- Local execution environment: OpenJDK 21.0.12.1 present; `gradle` command and Android SDK not installed; no local APK build performed.
- GitHub Actions run `39114676690` (2026-10-18 09:16 UTC) completed successfully for main commit `13d761ec8e07919f3a304dc68cc8ce62e6177a29` using JDK 17, Gradle 8.10.2, Android SDK 35.
- Downloaded workflow artifact `12131788092`, ZIP digest reported by GitHub: `a6dc1544794934a36be390e9a06b96a648bffbfa05850416d7e761572c52548b`. ZIP contains `bridge-debug.apk` (20,577 bytes). Locally verified APK ZIP entry integrity (`unzip -t`: no errors); APK SHA-256 `c949cb49a56987437f9ac80719dd9c68c7a549fa91e48717fb778aef4580bc62`.
- CI reports APK applicationId `com.trimind.bridge`, minSdk 26, targetSdk 35. No Samsung device installation or end-to-end file copy test has occurred.
- Current Bridge code uses Android Storage Access Framework (SAF) `ACTION_OPEN_DOCUMENT_TREE`, read-only recursive enumeration, copy with no explicit delete, and ZIP sharing via Android chooser.
- This development branch adds SHA-256 verification after each completed copy, destination-document collision checks before opening the output stream, and in-memory tracking of newly created items to avoid duplicate source-name overwrites. **The modified branch has not yet passed a Gradle build.**

## Known limitations and next tests

1. On Android 11+, the root of shared storage, Download root, Android/data and Android/obb cannot be selected using SAF tree picker. Select an allowed subfolder.
2. Google Drive generally does not expose its folders to `ACTION_OPEN_DOCUMENT_TREE`; the app currently requires a separate local destination folder and manual `ACTION_SEND` into a user-selected Google Drive folder. This is not automatic verified Drive upload.
3. Confirm Samsung DocumentsProvider tree selection, URI grants, scan count, large-file copy, checksum readback, interrupted copy handling, duplicate names and 0-byte files on an actual device.
4. Test Google Drive upload success and destination folder selection; never assume chooser selection confirms cloud sync.
5. ZIP creation currently does not read back and verify central-directory completion; improve this before recommending large backup archives.
6. Build the updated branch via Android SDK/Gradle CI, then inspect its signed/debug APK and run device tests.

## Preservation policy

Never delete or overwrite source files, never silently overwrite destination files, and do not delete any incomplete output automatically. Retain original data and report partial outputs explicitly.
