# TriMind AI — Android

Personal Android application: ask one question, receive independent responses from **OpenAI ChatGPT**, **Google Gemini**, and **Anthropic Claude**, and get a joint conclusion with explicit disagreements.

## Features
- All available providers are queried concurrently.
- Individual answers are visible (a failed provider does not hide the others).
- When 2 or 3 providers reply, synthesis uses an available provider (OpenAI preferred, then Gemini or Claude). With 1 reply, the app explicitly labels it as a single-provider answer.
- API keys are entered *on the phone*, not in source code or GitHub.
- API keys are encrypted at rest using Android Keystore + AES-GCM.
- Provider model IDs can be changed from the app.

## Install
1. Open **Actions** in this GitHub repository.
2. Open the latest successful **Build Android APK** run.
3. Download the `TriMind-Android-debug-apk` artifact.
4. Extract the ZIP and install `app-debug.apk` on Android. Allow installation from your file manager when prompted.
5. Open TriMind AI, enter keys for OpenAI, Gemini, and Anthropic, then choose **Зберегти ключі**.
6. Enter your question and tap **Запитати три ШІ**.

## API credentials and billing
Requires separate developer API credentials: OpenAI Platform (platform.openai.com), Google AI Studio (aistudio.google.com), Anthropic Console (console.anthropic.com). ChatGPT Plus does not include OpenAI API credits. Each company bills API usage separately, according to its terms. Never place API keys in issues, commits, screenshots or chat messages.

**Privacy:** Questions and the respective prompts are sent to each selected AI provider. For synthesis, successful provider replies are sent to the provider selected to summarize (OpenAI, Gemini, or Claude). This app has no developer-owned server. Avoid submitting confidential information without reviewing each provider's policies.

## Build locally
Install Android SDK API 35, Java 17, and Gradle 8.10.2. Run `gradle :app:assembleDebug`.
