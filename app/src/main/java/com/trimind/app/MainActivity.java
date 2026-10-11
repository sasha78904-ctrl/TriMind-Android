package com.trimind.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.text.method.PasswordTransformationMethod;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Simple Android client that asks 3 independent AI providers then compares their answers. */
public final class MainActivity extends Activity {
    private static final int INK = Color.rgb(22, 30, 48);
    private static final int MUTED = Color.rgb(86, 96, 116);
    private static final int BLUE = Color.rgb(38, 90, 215);

    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private SharedPreferences options;
    private SecretStore secrets;
    private EditText question;
    private EditText openKey, geminiKey, claudeKey;
    private EditText openModel, geminiModel, claudeModel;
    private Button askButton;
    private TextView status, synthesis, answerOpen, answerGemini, answerClaude;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        options = getSharedPreferences("trimind_options", Context.MODE_PRIVATE);
        try {
            secrets = new SecretStore(this);
        } catch (Exception e) {
            Toast.makeText(this, "Сховище ключів недоступне: " + e.getMessage(),
                    Toast.LENGTH_LONG).show();
        }
        createScreen();
    }

    private void createScreen() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(Color.rgb(246, 248, 253));
        LinearLayout root = new LinearLayout(this);
        root.setPadding(dp(18), dp(24), dp(18), dp(30));
        root.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(root);
        setContentView(scroll);

        TextView heading = text("TriMind AI", 28, INK, true);
        root.addView(heading);
        TextView lead = text("Три незалежні ШІ. Одне обґрунтоване рішення.", 14, MUTED, false);
        root.addView(lead);

        root.addView(spacer(18));
        root.addView(text("Твоє питання", 18, INK, true));
        question = new EditText(this);
        question.setHint("Напиши задачу, яку мають вирішити три ШІ…");
        question.setTextSize(16);
        question.setMinLines(3);
        question.setMaxLines(7);
        question.setGravity(android.view.Gravity.TOP);
        question.setBackground(panel());
        question.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(question, new LinearLayout.LayoutParams(-1, -2));

        root.addView(spacer(12));
        askButton = button("Запитати три ШІ");
        root.addView(askButton);
        askButton.setOnClickListener(v -> submit());

        root.addView(spacer(16));
        status = text("Для початку введи API-ключі в налаштуваннях нижче.", 13, MUTED, false);
        root.addView(status);

        root.addView(spacer(16));
        root.addView(text("Спільне рішення", 20, INK, true));
        synthesis = answerBox(root, "Тут з’явиться порівняння відповідей і висновок.");

        root.addView(spacer(16));
        root.addView(text("Окремі відповіді", 20, INK, true));
        root.addView(spacer(8));
        root.addView(text("ChatGPT / OpenAI", 16, INK, true));
        answerOpen = answerBox(root, "Ще немає відповіді");
        root.addView(spacer(10));
        root.addView(text("Google Gemini", 16, INK, true));
        answerGemini = answerBox(root, "Ще немає відповіді");
        root.addView(spacer(10));
        root.addView(text("Anthropic Claude", 16, INK, true));
        answerClaude = answerBox(root, "Ще немає відповіді");

        root.addView(spacer(22));
        root.addView(text("Налаштування API", 20, INK, true));
        root.addView(text("Ключі зберігаються зашифрованими на телефоні. "
                + "Кожен сервіс оплачується окремо.", 13, MUTED, false));

        openKey = addField(root, "Ключ OpenAI", "", true);
        geminiKey = addField(root, "Ключ Gemini", "", true);
        claudeKey = addField(root, "Ключ Claude", "", true);

        openModel = addField(root, "Модель OpenAI",
                options.getString("open_model", "gpt-4.1-mini"), false);
        geminiModel = addField(root, "Модель Gemini",
                options.getString("gemini_model", "gemini-2.5-flash"), false);
        claudeModel = addField(root, "Модель Claude",
                options.getString("claude_model", "claude-sonnet-4-5-20250929"), false);

        if (secrets != null) {
            try {
                openKey.setText(secrets.load("open"));
                geminiKey.setText(secrets.load("gemini"));
                claudeKey.setText(secrets.load("claude"));
            } catch (Exception e) {
                status.setText("Не вдалося прочитати збережені ключі. Введи їх знову.");
            }
        }
        root.addView(spacer(12));
        Button saveButton = button("Зберегти ключі та моделі");
        root.addView(saveButton);
        saveButton.setOnClickListener(v -> save());
        root.addView(spacer(10));
        root.addView(text("Важливо: це API-ключі з кабінетів розробників, "
                + "а не пароль ChatGPT. Для підсумку використовується OpenAI: "
                + "йому передаються також відповіді Gemini та Claude.",
                12, MUTED, false));
    }

    private EditText addField(LinearLayout root, String title, String initial, boolean secret) {
        root.addView(spacer(12));
        root.addView(text(title, 14, INK, true));
        EditText input = new EditText(this);
        input.setTextSize(15);
        input.setSingleLine(true);
        input.setText(initial);
        input.setBackground(panel());
        input.setPadding(dp(12), dp(10), dp(12), dp(10));
        if (secret) {
            input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            input.setTransformationMethod(PasswordTransformationMethod.getInstance());
            input.setHint("Встав API-ключ");
        }
        root.addView(input, new LinearLayout.LayoutParams(-1, -2));
        return input;
    }

    private void save() {
        if (secrets == null) {
            Toast.makeText(this, "Сховище недоступне", Toast.LENGTH_LONG).show();
            return;
        }
        try {
            secrets.save("open", get(openKey));
            secrets.save("gemini", get(geminiKey));
            secrets.save("claude", get(claudeKey));
            options.edit()
                    .putString("open_model", get(openModel))
                    .putString("gemini_model", get(geminiModel))
                    .putString("claude_model", get(claudeModel))
                    .apply();
            Toast.makeText(this, "Ключі та моделі збережено", Toast.LENGTH_SHORT).show();
            status.setText("Налаштування збережено. Можна ставити питання.");
        } catch (Exception e) {
            Toast.makeText(this, "Помилка збереження: " + e.getMessage(),
                    Toast.LENGTH_LONG).show();
        }
    }

    private void submit() {
        String prompt = get(question);
        if (prompt.isEmpty()) {
            question.setError("Введи питання");
            return;
        }
        final String oa = get(openKey), ge = get(geminiKey), cl = get(claudeKey);
        final String om = get(openModel), gm = get(geminiModel), cm = get(claudeModel);
        if (oa.isEmpty() && ge.isEmpty() && cl.isEmpty()) {
            status.setText("Додай хоча б один API-ключ.");
            return;
        }
        if ((!oa.isEmpty() && om.isEmpty()) || (!ge.isEmpty() && gm.isEmpty())
                || (!cl.isEmpty() && cm.isEmpty())) {
            status.setText("Укажи назву моделі для кожного підключеного сервісу.");
            return;
        }

        askButton.setEnabled(false);
        status.setText("Отримую незалежні відповіді паралельно…");
        synthesis.setText("Аналіз очікується…");
        answerOpen.setText("Завантаження…");
        answerGemini.setText("Завантаження…");
        answerClaude.setText("Завантаження…");

        CompletableFuture<Outcome> a = CompletableFuture.supplyAsync(
                () -> request(oa, () -> AiClient.openAi(oa, om, prompt)), executor);
        CompletableFuture<Outcome> b = CompletableFuture.supplyAsync(
                () -> request(ge, () -> AiClient.gemini(ge, gm, prompt)), executor);
        CompletableFuture<Outcome> c = CompletableFuture.supplyAsync(
                () -> request(cl, () -> AiClient.claude(cl, cm, prompt)), executor);

        CompletableFuture.allOf(a, b, c).thenRunAsync(() -> {
            Outcome open = a.join(), gemini = b.join(), claude = c.join();
            runOnUiThread(() -> {
                answerOpen.setText(open.content);
                answerGemini.setText(gemini.content);
                answerClaude.setText(claude.content);
                status.setText("Відповіді отримано. Формую узгоджений висновок…");
            });

            int successful = (open.ok ? 1 : 0) + (gemini.ok ? 1 : 0) + (claude.ok ? 1 : 0);
            String conclusion;
            if (successful == 0) {
                conclusion = "Не вдалося отримати жодної відповіді. Перевір API-ключі, моделі, "
                        + "інтернет і доступний баланс у провайдерів.";
            } else if (oa.isEmpty()) {
                conclusion = "Для автоматичного спільного висновку додай API-ключ OpenAI. "
                        + "Успішні окремі відповіді доступні нижче.";
            } else {
                try {
                    conclusion = AiClient.synthesize(oa, om, prompt,
                            open.ok ? open.content : "",
                            gemini.ok ? gemini.content : "",
                            claude.ok ? claude.content : "");
                    if (successful < 3) {
                        conclusion = "Увага: відповіли лише " + successful
                                + " з 3 ШІ.\n\n" + conclusion;
                    }
                } catch (Exception e) {
                    conclusion = "Не вдалося створити підсумок: " + safe(e)
                            + "\n\nОкремі відповіді доступні нижче.";
                }
            }
            final String finalConclusion = conclusion;
            runOnUiThread(() -> {
                synthesis.setText(finalConclusion);
                status.setText("Готово. Успішних відповідей: " + successful + " із 3.");
                askButton.setEnabled(true);
            });
        }, executor).exceptionally(error -> {
            runOnUiThread(() -> {
                status.setText("Неочікувана помилка обробки: " + safe(error));
                askButton.setEnabled(true);
            });
            return null;
        });
    }

    private interface Request { String run() throws Exception; }
    private Outcome request(String key, Request call) {
        if (key.isEmpty()) return new Outcome(false, "API-ключ не вказаний.");
        try {
            String answer = call.run();
            if (answer.isEmpty()) return new Outcome(false, "Порожня відповідь.");
            return new Outcome(true, answer);
        } catch (Exception e) {
            return new Outcome(false, "Помилка: " + safe(e));
        }
    }

    private static class Outcome {
        final boolean ok;
        final String content;
        Outcome(boolean ok, String content) { this.ok = ok; this.content = content; }
    }

    private String get(EditText field) { return field.getText().toString().trim(); }

    private static String safe(Throwable e) {
        String message = e.getMessage();
        return message == null ? e.getClass().getSimpleName() : message;
    }

    private TextView answerBox(LinearLayout root, String initial) {
        TextView box = text(initial, 15, INK, false);
        box.setTextIsSelectable(true);
        box.setBackground(panel());
        box.setPadding(dp(14), dp(14), dp(14), dp(14));
        root.addView(box, new LinearLayout.LayoutParams(-1, -2));
        return box;
    }

    private TextView text(String text, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextColor(color);
        view.setTextSize(sp);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private Button button(String label) {
        Button view = new Button(this);
        view.setText(label);
        view.setTextColor(Color.WHITE);
        view.setAllCaps(false);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(BLUE);
        bg.setCornerRadius(dp(12));
        view.setBackground(bg);
        view.setPadding(dp(12), dp(8), dp(12), dp(8));
        return view;
    }

    private GradientDrawable panel() {
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.WHITE);
        bg.setCornerRadius(dp(12));
        bg.setStroke(dp(1), Color.rgb(224, 230, 242));
        return bg;
    }

    private View spacer(int dp) {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, dp(dp)));
        return v;
    }

    private int dp(float value) { return (int) (value * getResources().getDisplayMetrics().density + .5f); }

    @Override public void onDestroy() {
        executor.shutdownNow();
        super.onDestroy();
    }
}
