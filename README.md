# TriMind AI 4.1.1 — Android

Three independent AI responses, one properly qualified synthesis.

## Recommended: no API keys
The default launch screen uses [Puter.js](https://docs.puter.com/) to access models from OpenAI, Google, and Anthropic. No provider API keys are required. **You need one Puter account and authentication** (the in-app popup should guide you). Puter includes a limited starting allowance; larger usage may require topping up the Puter account. The app developer does not pay for these AI requests.

1. Install `TriMind-AI-v2.0.apk`.
2. Open TriMind and select **Підключити Puter**. Sign in/create an account and authorize access in the popup.
3. Enter a question and press **Отримати відповіді трьох ШІ**.
4. Wait for 3 separate answers and synthesis. One successful answer is labeled as one, *never* a consensus.

Version 2.1 adds empty-response retries, automatic Gemini model switching, safe inline Markdown display, and a **Retry only Gemini** action that reuses other completed replies without resending their original requests.\n\nFeatures: concurrent requests to three vendors, 503/transient-error retries with exponential backoff, fallback models, lower-cost and premium modes, 12-entry on-device history, one-tap copy, data-safe text rendering, and automatic selection of an available provider to synthesize 2+ replies.

## Alternative: direct provider API
Open **Налаштування та інші способи підключення → Відкрити пряме API-підключення**. Enter OpenAI, Gemini, and/or Anthropic keys. They are encrypted at rest using Android Keystore. Provider billing/quotas are separate; ChatGPT Plus is not API credit.

## Limitations / privacy
- Keyless does **not** mean unlimited free use. Each Puter account has an allowance and might incur costs after it runs out.
- Puter auth happens in a popup: if your Google login rejects embedded WebView authentication, try Puter's other supported sign-in options, or switch to direct provider keys. The auth experience depends on Puter's service and device WebView configuration.
- Questions and successful answers are sent through Puter and AI vendors; the synthesis prompt includes answers from the models that succeeded. Do not paste confidential personal information without considering these third parties.
- The JavaScript SDK is loaded from https://js.puter.com/v2/ at runtime and requires Internet access.
- Local history remains on the device in WebView localStorage and is erased when Android app data is cleared/uninstalled. Direct API keys are stored separately using Android Keystore.
- This is an unsigned-by-publisher **debug** APK signed by GitHub's temporary test key. When updating from another build, Android might reject a mismatched signature; reinstall and re-enter credentials if necessary. For a stable upgrade chain, provision a permanent production signing key.
- Android build, JavaScript parsing and mocked empty-response regression are tested by GitHub Actions; full login/provider end-to-end functionality still needs testing on a physical Android device.

Source code is open for audit. Not officially affiliated with OpenAI, Google, Anthropic, or Puter.

## Attachments (TriMind 2.2)
Use **📷 Фото з галереї** or **📎 Додати документ** in the primary Puter-powered screen. Android's system file picker gives access to selected photos and document files without granting broad storage permissions.

Supported types: JPG/JPEG, PNG, WebP, PDF, DOC/DOCX, XLS/XLSX, TXT, CSV, JSON, Markdown. Up to four files, 15 MiB/file, 25 MiB total. A single image is sent directly as the second parameter of Puter AI Chat. Documents and mixed/multi-file requests are uploaded once to the user's Puter filesystem and attached to each of the three model messages by Puter path. The app attempts to delete the temporary Puter copies after the three requests; deletion is best-effort (for example, if the app crashes, copies could remain in Puter storage). Provider capabilities vary by model, and some Office documents or scanned PDFs might require converting to images or text before the model can analyze them correctly.

The attachment picker and file data are used for the current run; history stores the names and AI answers but not the original file bytes. Retrying a prior attachment analysis after reopening the app requires selecting the files again. Do not upload confidential files without considering Puter and each AI provider's data handling.

## TriMind 2.3 — multi-round AI deliberation
The default **Debate** mode conducts a transparent structured exchange (not three isolated answers and an assumed consensus):
1. Query OpenAI, Google and Anthropic independently (3 calls; each can inspect selected photos/files).
2. Send other providers' answers to each available model for evidence-based rebuttal and revision (up to 3 calls; these exchanges use text summaries, not the original attachments).
3. One available model writes an explicitly unapproved candidate decision (1 call).
4. Each available original model checks that candidate and votes `VERDICT: AGREE`, `RESERVATIONS` or `DISAGREE` independently (up to 3 calls).

The UI exposes review transcripts, candidate decision, and votes. It displays **agreed by all three** only when all 3 answered, all 3 completed a critique, and all 3 explicitly voted AGREE. Missing, malformed, or dissenting votes never count as agreement. No AI consensus implies external truth.

Normal use requires 10 calls, and there is a hard cap of **14 attempted Puter AI requests per debate** including retries. Puter charges or depletes account allowance according to the selected models; when the cap is reached, the app returns the incomplete/disputed result rather than sending additional queries. Use **Quick analysis** to reduce costs. History stores clipped transcripts and vote decisions locally (up to 12 sessions). Documents/photos themselves are not stored in history and are sent only on the first round.

## TriMind 3.0 — Research Workspace (5 modules)
**Actual capabilities and limits:**
1. **External source collection:** Fetches live public search results from Wikimedia Action API (Ukrainian and English Wikipedia) and Crossref publication metadata. Shows direct HTTPS URLs, titles and excerpts in a separate evidence ledger, never generates links. These are NOT exhaustive web search, legal databases, a primary source guarantee, or fact verification. User may provide custom search keywords.
2. **Multimodal documents and media:** Keeps existing photo/PDF/Word/Excel/text upload. Adds optional Puter `ai.img2txt` OCR for selected scans, Puter `ai.speech2txt` for MP3/WAV/M4A/OGG, partial local text extraction for TXT/CSV/JSON/MD, and sampling three still frames from short MP4/WebM files. Video audio and unselected frames are not analyzed. If no selected material can be processed, the app reports a failure rather than pretending the model analyzed it. Up to 4 originals, each up to 20 MiB (40 MiB total). Format support varies by provider.
3. **Structured independent roles:** OpenAI starts as systems analyst, Gemini as evidence checker, Claude as skeptical reviewer. Existing independent responses, cross-review, candidate decision and separate votes remain. Consensus is not proof.
4. **Per-project local knowledge:** Create up to 20 projects, each with up to 80 notes/results. Optional save of the final output, manually written notes, limited keyword-based retrieval relevant to future questions. JSON backup via clipboard and JSON file import; not encrypted at rest beyond Android app sandbox. No automatic cloud sync. Check data handling before including sensitive documents.
5. **Scheduled source comparison (foreground):** Daily/weekly checks compare URL sets from Wikipedia/Crossref. A change in search results does NOT prove a new event. When the app is opened it checks due topics using real requests; a native Android AlarmManager notification can remind you to open it. **AI/Web research is NOT executed while the app is fully closed.** Continuous background monitoring would require a separately deployed trusted backend and scheduler.

No secret service credentials in public GitHub code. Puter user login is required; Puter AI/OCR/transcription may consume account credit. Speech/vision requests are not included in the in-app 14-call debate-only budget. Google/Claude/OpenAI model availability can change over time.

### Build verification
GitHub Actions compiles the Android APK and runs source syntax tests, existing debate/attachment mocks, and v3 deterministic tests with mock Wikimedia/Crossref and speech/OCR responses. Real device camera/file selection, service quotas, provider model behavior, Android permission delivery and Puter login require live testing on the user's Android phone.

## TriMind 3.1 — Read-only ECU Firmware Lab
This is a local, **read-only static firmware analyzer**, not an ECU flashing or tuning program.

- Select original or edited ECU memory dumps, up to **32 MiB** each. Supports raw BIN/ORI/MOD/EEP/FLASH/ROM/DUMP, Intel HEX, and Motorola S-record (S19/S28/S37/MOT). The tool handles raw filenames like "mers nov". Vendor-specific compressed FRF/ODX and calibration definitions such as A2L/DAMOS/XDF require their respective tools; this implementation does not parse them.
- Compute SHA-256 using Android WebView Web Crypto (reports "unavailable" if unsupported), global and 8-KiB-segment byte entropy, FF/00 counts, memory-format record checksum validation, printable metadata strings with byte offsets, raw bytes preview.
- Load a second file and compute byte-accurate differences in the aligned shared region (changed-byte count, changed-region ranges, length delta). **Offset correspondence must be validated** if the dumps use different address ranges.
- Show targeted real search links for ECUConnections, MHH Auto, ECUedit, NefMoto, CarTechnology, Digital Kaos, GitHub, Bosch, TunerPro and others. Optional Puter OpenAI web-search execution requests live sources, subject to account/provider feature availability, usage quota and authentication. A search summary is AI-generated: its sources must be independently verified. We **do not bypass forum logins or scrape protected content**; "search across all forums" cannot be guaranteed.
- The button to consult all three AIs inserts the **locally calculated byte report**, not the raw binary, into the existing TriMind chat panel. The user then explicitly starts the multi-AI deliberation. Store a report in the active TriMind project or copy as text.
- **No editing/patching/flashing, immobilizer bypass, emission-control bypass recipes, or counterfeit OEM checksum verification**. ECU-specific maps, calibration axis interpretation, anti-tuning signatures, proprietary Bosch/Continental checksum validity and safe drivability conclusions require original firmware reference, suitable ECU-specific calibration metadata, instrumentation, and expert bench validation.
- Uploaded proprietary firmware samples are not committed to this public repository. Automated tests are synthetic only. Real-device verification of Android file picking, Puter web search and UI behavior is still required.


## TriMind 4.0 ECU Pro — provenance-aware professional groundwork

Read-only features added:
- **Evidence-based family identification** of common Bosch EDC15/16/17, MD1/MG1/MED/ME, Siemens/Continental SID and Delphi DCM signatures. Results explain the *actual matching marker* and its uncertainty; it does not magically deduce precise ECU part numbers or CPU. Hex viewer, general CRC32, SHA-256 and address-aligned diff; **CRC32 is not OEM-specific checksum correction**.
- **On-device IndexedDB binary reference library**, up to 8 original uploads of <=32 MiB each, with SHA-256, name, claimed provenance, HW/SW and notes. Data is not uploaded to GitHub or a cloud. All records are explicitly **USER_SUPPLIED_UNVERIFIED**. User can re-open and compare references. IndexedDB relies on WebView persistent app storage, not a shared verified-OEM service. Do not uninstall before backing up needed originals.
- **Calibration metadata readers:** partial TunerPro XDF support for contiguous constant/map byte arrays with only 8/16/32-bit unsigned, big-endian assumptions and limited linear MATH expressions. It refuses complex BASEOFFSET, nonzero strides, unknown equations and out-of-range locations. Small value/line graph available. For A2L (ASAM MCD-2 MC) only a CHARACTERISTIC/address index is generated; real COMPU_METHOD/RECORD_LAYOUT, byte order, memory segmentation and proper map-axis interpretation remain future work. These limits are shown next to the values.
- **Diagnostic import** of simple DTC/CSV/LOG files, with DTC code extraction and basic numeric statistics (up to 2,000 lines). Not live OBD/UDS connection; not a scanner replacement.
- **Live search results** from GitHub repositories/issues and Mechanics Stack Exchange public APIs, linked to original URLs, with an optional Puter OpenAI web-search call for other accessible documentation and forums. No all-forum/private-index access is claimed; CORS, rate limits, website availability, account credentials and model support matter.
- **Portable incident/evidence exports** through Android's system document provider: human-readable TXT technical report and compact structured JSON (without binary firmware). The export contains hashes, candidate IDs, calibration limits, diagnostic summary, and links. Local processing of bytes is the default. Model analysis receives a text report only after explicit user interaction.
- **ECU-focused AI role prompts** select reverse engineering, research and skeptical validation roles for ChatGPT/Gemini/Claude. Consensus can still be wrong; these roles do not prove model independence or support correctness.

Not delivered yet: a licensed verified OEM firmware corpus, universal proprietary checksum algorithms, complete XDF/A2L conversion support, running disassemblers such as Ghidra on Android, physical OBD/UDS hardware integration, or permanently running server-based crawlers of every forum. These require datasets, vendor rights, hardware, maintained infrastructure and substantially more work. The APK build alone is not evidence of successful live Puter/GitHub integration on every device. Proprietary user firmware should not be committed to a public repo.

Reference standards: ASAM MCD-2 MC at https://www.asam.net/standards/detail/mcd-2-mc/ and TunerPro XDF format discussions at https://forum.tunerpro.net/. No proprietary datasets or tuning maps are redistributed.


## TriMind AI 4.1 — Simplified ECU Start Screen

**Default Android startup** is now \`simple.html\`, a minimal user interface:
- **File 1**: ECU firmware (required).
- **File 2**: ECU firmware reference/comparison (optional).
- **Analyze with 3 AI**: local read-only extraction from 1/2 firmware files, independent Puter requests to OpenAI, Google and Anthropic, a second cross-critique round from all three, one provisional written answer, three independent verdicts, and **only one final answer** shown to the user.
- Provider responses and debates are never shown as separate cluttered answer cards. Requested model identifiers and verdicts appear as a small technical status footer.
- The app does not call the synthesis "3/3 approved" unless all three independently answered, all three critiques succeeded, and all three votes explicitly parsed as \`VERDICT: AGREE\`. If providers have reservations, the **same single answer** includes the concerns; if an essential response/vote is absent, the screen explicitly reports **incomplete** rather than faking a completed 3-AI answer.
- The BIN bytes are never sent to LLMs. AI receives a *text-only local forensic report* (SHA-256, size, printable IDs, entropy, delta addresses/count). Original files are not modified and not uploaded. If the user is not signed into Puter, the app displays the local facts and asks them to sign in.
- Up to 32 MiB per input, with supported BIN, ORI, MOD, EEP, FLASH, ROM, DUMP, Intel HEX and Motorola S-record extensions.
- Forensic interpretation is qualified: raw BIN addresses assume base zero, and the app does not determine firmware originality, emissions-related changes, maps, proprietary OEM checksums or safe flashing by itself.
- Research, reference database, XDF/A2L and diagnostic features remain in the source for further development, but the user requested **no extra UI** so they are hidden from the default simple screen.

The feature is tested with a mocked Puter SDK in GitHub Actions; actual remote provider responses, model availability, billing, and file picker experience need testing on a real Android device.


### 4.1.1 — Files with workshop-specific extensions
Custom-named ECU binary dumps such as `mers.avtomat.marina` can now be selected directly. The Android picker does not filter extensions. Unknown extensions are sampled for binary data and passed to the original local decoder as raw BIN without mutating any input bytes. ZIP/PDF/PNG/ELF/EXE/GZIP and plain-text lookalikes are not silently relabeled. The original filename is preserved in the technical report. Format detection is a heuristic, not proof of OEM authenticity. Regression tests include custom extensions for both file inputs.
