# TriMind AI 2.1 — Android

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
