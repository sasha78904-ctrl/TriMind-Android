# TriMind AI 2.3 — Android

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
