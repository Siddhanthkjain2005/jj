package com.velocityverse.game;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Offline Android host for the browser simulation reference. Not a Unity/native renderer port. */
public final class MainActivity extends ComponentActivity {
    private static final String APP_URL = "https://appassets.androidplatform.net/assets/velocityverse.html";
    private static final int CREATE_EXPORT = 103;
    private static final int MAX_EXPORT_BYTES = 20 * 1024 * 1024;
    private WebView web;
    private final ExecutorService writer = Executors.newSingleThreadExecutor();
    private final AtomicBoolean saving = new AtomicBoolean(false);
    private byte[] pendingExport;
    private boolean active;
    private boolean keepScreenOn;
    private boolean exitShowing;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setBackgroundDrawableResource(android.R.color.black);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams attributes = getWindow().getAttributes();
            attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(attributes);
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(7, 21, 40));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setBlockNetworkLoads(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setTextZoom(100); // The in-game text-size setting is independent of WebView defaults.
        settings.setUserAgentString(settings.getUserAgentString() + " VelocityVerseAndroid/0.4");
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                // Only one trusted bundled document is exposed to the JavaScript bridge.
                if (APP_URL.equals(request.getUrl().toString())) {
                    WebResourceResponse response = loader.shouldInterceptRequest(request.getUrl());
                    if (response != null) {
                        response.setResponseHeaders(Collections.singletonMap("Content-Security-Policy",
                            "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"));
                        return response;
                    }
                }
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Offline", null,
                    new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !APP_URL.equals(request.getUrl().toString());
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (APP_URL.equals(url)) {
                    view.evaluateJavascript("document.documentElement.classList.add('android-app');", null);
                    immerse();
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new NativeBridge(), "NativeBridge");
        setContentView(web);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { routeBack(); }
        });
        web.loadUrl(APP_URL);
        immerse();
    }

    private void immerse() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) immerse();
    }
    @Override public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        immerse(); // Keep the WebView, its save origin and live simulation across rotation.
    }
    @Override protected void onResume() {
        super.onResume(); active = true;
        if (web != null) { web.onResume(); web.resumeTimers(); }
        applyScreenFlag(); immerse();
    }
    @Override protected void onPause() {
        active = false; applyScreenFlag();
        if (web != null) {
            web.evaluateJavascript("(()=>{const g=window.__vv;if(g?.mode==='race'&&!g.paused)g.pause();})()", null);
            web.onPause(); web.pauseTimers();
        }
        super.onPause();
    }
    @Override protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("NativeBridge"); web.destroy(); web = null; }
        writer.shutdown();
        super.onDestroy();
    }
    private void routeBack() {
        if (web == null) return;
        web.evaluateJavascript("(()=>{try{return window.__vv?.androidBack?.()===true;}catch(e){return false;}})()", value -> {
            if (!"true".equals(value) && !isFinishing() && !exitShowing) {
                exitShowing = true;
                new AlertDialog.Builder(this).setTitle("Leave VelocityVerse?")
                    .setMessage("Your saved progress stays on this device.")
                    .setPositiveButton("Leave", (dialog, which) -> finish())
                    .setNegativeButton("Stay", (dialog, which) -> immerse())
                    .setOnDismissListener(dialog -> { exitShowing = false; immerse(); }).show();
            }
        });
    }
    private void applyScreenFlag() {
        if (active && keepScreenOn) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
    private void notifySave(boolean success, String message) {
        saving.set(false);
        runOnUiThread(() -> {
            if (isFinishing() || web == null) return;
            Toast.makeText(this, message, Toast.LENGTH_LONG).show();
            web.evaluateJavascript("window.__vv?.nativeSaveResult?.(" + success + "," + JSONObject.quote(message) + ")", null);
        });
    }

    public final class NativeBridge {
        @JavascriptInterface public void copyText(String text) {
            if (text == null || text.length() > 1024 * 1024) return;
            runOnUiThread(() -> {
                ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (clipboard != null) {
                    clipboard.setPrimaryClip(ClipData.newPlainText("VelocityVerse telemetry", text));
                    Toast.makeText(MainActivity.this, "Telemetry copied.", Toast.LENGTH_SHORT).show();
                }
            });
        }
        @JavascriptInterface public void haptic() {
            runOnUiThread(() -> { if (web != null) web.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); });
        }
        @JavascriptInterface public void setKeepScreenOn(boolean enabled) {
            runOnUiThread(() -> { keepScreenOn = enabled; applyScreenFlag(); });
        }
        @JavascriptInterface public void saveFile(String filename, String mime, String encoded) {
            if (!saving.compareAndSet(false, true)) return;
            writer.execute(() -> {
                try {
                    if (!("image/png".equals(mime) || "image/svg+xml".equals(mime))) throw new IllegalArgumentException("Unsupported export type.");
                    if (encoded == null || encoded.length() > MAX_EXPORT_BYTES * 4 / 3 + 8) throw new IllegalArgumentException("Export exceeds the size limit.");
                    byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                    if (bytes.length == 0 || bytes.length > MAX_EXPORT_BYTES) throw new IllegalArgumentException("Invalid export size.");
                    String safe = filename == null ? "VelocityVerse" : filename.replaceAll("[^A-Za-z0-9._-]", "_");
                    if (safe.length() > 100) safe = safe.substring(0, 100);
                    String suffix = "image/png".equals(mime) ? ".png" : ".svg";
                    if (!safe.endsWith(suffix)) safe += suffix;
                    if (Build.VERSION.SDK_INT >= 29) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.Downloads.DISPLAY_NAME, safe);
                        values.put(MediaStore.Downloads.MIME_TYPE, mime);
                        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/VelocityVerse");
                        values.put(MediaStore.Downloads.IS_PENDING, 1);
                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri == null) throw new IllegalStateException("Could not create the download.");
                        try {
                            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                                if (out == null) throw new IllegalStateException("Could not open the download.");
                                out.write(bytes);
                            }
                            ContentValues ready = new ContentValues(); ready.put(MediaStore.Downloads.IS_PENDING, 0);
                            getContentResolver().update(uri, ready, null, null);
                        } catch (Exception e) { getContentResolver().delete(uri, null, null); throw e; }
                        notifySave(true, "Saved to Downloads / VelocityVerse.");
                    } else {
                        pendingExport = bytes;
                        String finalName = safe;
                        runOnUiThread(() -> {
                            Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                                .setType(mime).putExtra(Intent.EXTRA_TITLE, finalName);
                            try { startActivityForResult(create, CREATE_EXPORT); }
                            catch (Exception e) { pendingExport = null; notifySave(false, "No file picker is available."); }
                        });
                    }
                } catch (Exception e) { notifySave(false, "Could not save export: " + e.getMessage()); }
            });
        }
    }
    @SuppressWarnings("deprecation")
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != CREATE_EXPORT) return;
        byte[] bytes = pendingExport; pendingExport = null;
        Uri uri = data == null ? null : data.getData();
        if (resultCode != RESULT_OK || uri == null || bytes == null) { notifySave(false, "Export cancelled."); return; }
        writer.execute(() -> {
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IllegalStateException("Could not open the selected file.");
                out.write(bytes); notifySave(true, "Export saved.");
            } catch (Exception e) { notifySave(false, "Could not save the selected file."); }
        });
    }
}
