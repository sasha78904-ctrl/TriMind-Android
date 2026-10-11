package com.trimind.app;

import android.app.Activity;
import android.app.Dialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.Toast;


import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Keyless-first TriMind. Puter.js handles authentication and bills each user's own
 * Puter allowance. Never inject API secrets into the WebView.
 * The legacy direct-API client remains available through the settings shortcut.
 */
public class PuterActivity extends Activity {
    private WebView view;
    private Dialog popup;
    private WebView popupView;
    private static final String ORIGIN = "https://trimind.local/";
    private static final String[] SAFE_LINK_SCHEMES = {"https", "http"};

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        view = new WebView(this);
        view.setBackgroundColor(Color.rgb(247, 249, 252));
        configure(view);
        setContentView(view, new ViewGroup.LayoutParams(-1, -1));
        try {
            byte[] bytes = readAsset("index.html");
            view.loadDataWithBaseURL(ORIGIN,
                    new String(bytes, StandardCharsets.UTF_8), "text/html", "UTF-8", null);
        } catch (Exception e) {
            android.widget.TextView error = new android.widget.TextView(this);
            error.setText("Не вдалося відкрити TriMind: " + e.getMessage());
            setContentView(error);
        }
    }

    private byte[] readAsset(String path) throws Exception {
        try (InputStream input = getAssets().open(path);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] b = new byte[8192];
            int n;
            while ((n = input.read(b)) != -1) output.write(b, 0, n);
            return output.toByteArray();
        }
    }

    private void configure(WebView web) {
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setDefaultTextEncodingName("UTF-8");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "TriMindAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri url = req.getUrl();
                String scheme = url.getScheme();
                if ("https".equals(scheme) || "http".equals(scheme)) {
                    // Keep Puter auth flow inside its popup to preserve postMessage/session.
                    if (v == popupView) return false;
                    if (ORIGIN.equals(url.toString()) || "trimind.local".equals(url.getHost())) return false;
                    external(url);
                    return true;
                }
                if (scheme != null && ("intent".equals(scheme) || "mailto".equals(scheme))) {
                    external(url);
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView parent, boolean isDialog,
                                                    boolean isUserGesture,
                                                    android.os.Message resultMsg) {
                if (popup != null && popup.isShowing()) return false;
                WebView child = new WebView(PuterActivity.this);
                popupView = child;
                configurePopup(child);
                popup = new Dialog(PuterActivity.this);
                popup.setContentView(child);
                popup.setOnDismissListener(d -> {
                    WebView closing = popupView;
                    popupView = null;
                    popup = null;
                    if (closing != null) closing.destroy();
                });
                popup.show();
                if (popup.getWindow() != null) {
                    popup.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT);
                }
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(child);
                resultMsg.sendToTarget();
                return true;
            }
            @Override public void onCloseWindow(WebView window) {
                if (popup != null) popup.dismiss();
            }
        });
    }

    private void configurePopup(WebView child) {
        WebSettings settings = child.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(child, true);
        child.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                String scheme = req.getUrl().getScheme();
                if ("http".equals(scheme) || "https".equals(scheme)) return false;
                external(req.getUrl());
                return true;
            }
        });
        child.setWebChromeClient(new WebChromeClient() {
            @Override public void onCloseWindow(WebView window) {
                if (popup != null) popup.dismiss();
            }
        });
    }

    private void external(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (Exception e) {
            Toast.makeText(this, "Не вдається відкрити посилання", Toast.LENGTH_SHORT).show();
        }
    }

    private final class Bridge {
        @JavascriptInterface public void openAdvanced() {
            runOnUiThread(() -> startActivity(new Intent(PuterActivity.this, MainActivity.class)));
        }
        @JavascriptInterface public void copy(String value) {
            runOnUiThread(() -> {
                ClipboardManager clipboard =
                        (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                clipboard.setPrimaryClip(ClipData.newPlainText("TriMind", value));
                Toast.makeText(PuterActivity.this, "Скопійовано", Toast.LENGTH_SHORT).show();
            });
        }
        @JavascriptInterface public void openBrowser() {
            runOnUiThread(() -> external(Uri.parse("https://puter.com/")));
        }
    }

    @Override public void onBackPressed() {
        if (popup != null && popup.isShowing()) { popup.dismiss(); return; }
        if (view != null && view.canGoBack()) { view.goBack(); return; }
        super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (popup != null) popup.dismiss();
        if (view != null) {
            view.stopLoading();
            view.destroy();
        }
        super.onDestroy();
    }
}
