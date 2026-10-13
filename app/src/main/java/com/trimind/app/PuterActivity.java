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
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
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
    private ValueCallback<Uri[]> uploadCallback;
    private static final int FILE_PICKER_REQUEST = 3092;
    private static final int REPORT_EXPORT_REQUEST = 3093;
    private byte[] pendingExportData;

    private static final String ORIGIN = "https://trimind.local/";
    private static final String[] SAFE_LINK_SCHEMES = {"https", "http"};

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        view = new WebView(this);
        view.setBackgroundColor(Color.rgb(247, 249, 252));
        configure(view);
        setContentView(view, new ViewGroup.LayoutParams(-1, -1));
        try {
            byte[] bytes = readAsset("simple.html");
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
        // Required so Chromium can read user-selected content:// URIs from Android's document picker.
        // The app never grants blanket storage access.
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setDefaultTextEncodingName("UTF-8");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        web.addJavascriptInterface(new Bridge(), "TriMindAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView webView, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if ("https".equals(uri.getScheme()) && "trimind.local".equals(uri.getHost())
                        && ("/v3.js".equals(uri.getPath()) || "/ecu.js".equals(uri.getPath())
                            || "/ecu_core.js".equals(uri.getPath())
                            || "/ecu_pro.js".equals(uri.getPath())
                            || "/simple.js".equals(uri.getPath()))) {
                    try {
                        return new WebResourceResponse("application/javascript", "UTF-8",
                                getAssets().open(uri.getPath().substring(1)));
                    } catch (Exception ignored) {
                        return new WebResourceResponse("text/plain", "UTF-8",
                            new java.io.ByteArrayInputStream(new byte[0]));
                    }
                }
                return super.shouldInterceptRequest(webView,request);
            }
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
            @Override public boolean onShowFileChooser(WebView webView,
                    ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = filePathCallback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("*/*");
                picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,
                        params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                picker.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        "image/jpeg", "image/png", "image/webp",
                        "audio/mpeg", "audio/wav", "audio/mp4", "audio/ogg",
                        "video/mp4", "video/webm",
                        "application/pdf", "text/plain", "text/csv",
                        "application/json",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/msword", "application/vnd.ms-excel",
                        "application/octet-stream"
                });
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(Intent.createChooser(picker,
                            "Оберіть фото або документ"), FILE_PICKER_REQUEST);
                } catch (Exception error) {
                    uploadCallback = null;
                    filePathCallback.onReceiveValue(null);
                    Toast.makeText(PuterActivity.this, "Не знайдено програму для вибору файлів",
                            Toast.LENGTH_LONG).show();
                }
                return true;
            }
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

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REPORT_EXPORT_REQUEST) {
            byte[] bytes=pendingExportData;
            pendingExportData=null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (java.io.OutputStream output=getContentResolver().openOutputStream(data.getData(),"w")) {
                    if (output == null) throw new java.io.IOException("Відсутній доступ до файла");
                    output.write(bytes);
                    output.flush();
                    Toast.makeText(this,"Звіт ECU збережено",Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(this,"Не вдалося записати звіт: "+e.getMessage(),Toast.LENGTH_LONG).show();
                }
            }
            return;
        }
        if (requestCode != FILE_PICKER_REQUEST) return;
        ValueCallback<Uri[]> callback = uploadCallback;
        uploadCallback = null;
        if (callback == null) return;
        if (resultCode != RESULT_OK || data == null) {
            callback.onReceiveValue(null);
            return;
        }
        java.util.ArrayList<Uri> selected = new java.util.ArrayList<>();
        ClipData clips = data.getClipData();
        if (clips != null) {
            for (int i=0;i<clips.getItemCount() && i<5;i++) {
                Uri candidate = clips.getItemAt(i).getUri();
                if (candidate != null && "content".equals(candidate.getScheme()))
                    selected.add(candidate);
            }
        } else if (data.getData() != null) {
            Uri candidate = data.getData();
            if ("content".equals(candidate.getScheme())) selected.add(candidate);
        }
        callback.onReceiveValue(selected.isEmpty() ? null : selected.toArray(new Uri[0]));
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
        @JavascriptInterface public void scheduleMonitorReminder(long dueEpochMs) {
            runOnUiThread(() -> {
                try {
                    if (android.os.Build.VERSION.SDK_INT >= 33 &&
                        checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                            != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 6821);
                    }
                    MonitorReceiver.schedule(PuterActivity.this, dueEpochMs);
                } catch (Exception e) {
                    Toast.makeText(PuterActivity.this,
                       "Не вдалося запланувати нагадування", Toast.LENGTH_SHORT).show();
                }
            });
        }
        @JavascriptInterface public void cancelMonitorReminder() {
            runOnUiThread(() -> MonitorReceiver.cancel(PuterActivity.this));
        }
        @JavascriptInterface public void saveReport(String filename, String mime, String encoded) {
            runOnUiThread(() -> {
                try {
                    if (pendingExportData != null) {
                        Toast.makeText(PuterActivity.this,"Завершіть попередній експорт",Toast.LENGTH_SHORT).show();
                        return;
                    }
                    if (!"text/plain".equals(mime)&&!"application/json".equals(mime)&&
                        !"text/html".equals(mime)) throw new IllegalArgumentException("Недозволений тип файла");
                    if (encoded == null || encoded.length() > 2100000)
                        throw new IllegalArgumentException("Звіт завеликий");
                    byte[] bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
                    if(bytes.length>1500000)throw new IllegalArgumentException("Звіт завеликий");
                    String safeName=(filename==null?"TriMind-ECU.txt":filename)
                        .replaceAll("[^A-Za-z0-9._-]","_");
                    if(safeName.length()>90)safeName=safeName.substring(0,90);
                    pendingExportData=bytes;
                    Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime);
                    intent.putExtra(Intent.EXTRA_TITLE,safeName);
                    intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    startActivityForResult(intent,REPORT_EXPORT_REQUEST);
                } catch (Exception e) {
                    pendingExportData=null;
                    Toast.makeText(PuterActivity.this,"Експорт: "+e.getMessage(),Toast.LENGTH_LONG).show();
                }
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
        pendingExportData=null;
        if (uploadCallback != null) {
            uploadCallback.onReceiveValue(null);
            uploadCallback = null;
        }
        if (popup != null) popup.dismiss();
        if (view != null) {
            view.stopLoading();
            view.destroy();
        }
        super.onDestroy();
    }
}
