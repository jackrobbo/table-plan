package uk.co.tableplan.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Morrisons' website in our own browser view. After each page loads we inject the same script as the browser extension
 * (assets/morrisons.js), which presses Add on each product. The view keeps its cookies, so a Morrisons sign-in sticks.
 * It never touches Morrisons' APIs: it only presses the buttons a person would.
 */
public class MorrisonsActivity extends Activity {
    static final String EXTRA_ITEMS = "items";
    static final String EXTRA_JOB = "job";
    private static final String BASE = "https://groceries.morrisons.com/products/";
    private static final int MAX_JOB_CHARS = 200_000;

    private WebView web;
    private String script = "";
    private SharedPreferences prefs;
    /** The latest state of the run, kept after the script clears it so we can hand the result back to Table Plan. */
    private String lastJob = null;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("tableplan", MODE_PRIVATE);
        script = readAsset("morrisons.js");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        // Match the app's own look: near-black in dark mode, the soft grey of the app in light mode.
        final boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        final int pageBg = night ? Color.BLACK : Color.parseColor("#f2f2f6");
        final int ink = night ? Color.parseColor("#f4f4f6") : Color.parseColor("#141414");
        root.setBackgroundColor(pageBg);
        float d = getResources().getDisplayMetrics().density;
        // The back header: the whole bar is one big tap target.
        TextView bar = new TextView(this);
        bar.setText("\u2039  Back to Table Plan");
        bar.setTextColor(ink);
        bar.setTextSize(17);
        bar.setTypeface(null, android.graphics.Typeface.BOLD);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(night ? Color.parseColor("#1c1c1e") : Color.WHITE);
        final int barPad = (int) (16 * d);
        bar.setPadding(barPad, barPad, barPad, barPad);
        bar.setOnClickListener(v -> finish());
        web = new WebView(this);
        web.setBackgroundColor(pageBg);
        root.addView(bar, new LinearLayout.LayoutParams(-1, -2));
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1f));
        setContentView(root);
        // Android 15 draws apps edge to edge: keep the header clear of the status bar and the page clear of the navigation bar.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets sb = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            bar.setPadding(barPad + sb.left, barPad + sb.top, barPad + sb.right, barPad);
            v.setPadding(0, 0, 0, sb.bottom);
            return insets;
        });
        WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightStatusBars(!night);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadsImagesAutomatically(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "TPNative");
        // Run our script as each Morrisons page starts to load, so the trolley screen is up before the product page can show through.
        // (Where that isn't supported, onPageFinished below still injects it, just later.)
        if (!script.isEmpty() && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, script, new java.util.HashSet<>(java.util.Collections.singletonList("https://groceries.morrisons.com")));
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                boolean ours = "https".equals(u.getScheme()) && (host.equals("morrisons.com") || host.endsWith(".morrisons.com"));
                if (ours) return false;
                // Anything else (including links out of Morrisons) goes to the normal browser, never into this view.
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                Uri u = Uri.parse(url == null ? "" : url);
                if ("groceries.morrisons.com".equals(u.getHost()) && !script.isEmpty()) v.evaluateJavascript(script, null);
            }
        });

        String items = getIntent().getStringExtra(EXTRA_ITEMS);
        if (items != null) startJob(items);
        else if (b == null) web.loadUrl("https://groceries.morrisons.com/");
        else web.restoreState(b);
    }

    private void startJob(String itemsJson) {
        try {
            JSONArray items = new JSONArray(itemsJson);
            JSONObject job = new JSONObject();
            job.put("id", System.currentTimeMillis());
            job.put("items", items);
            job.put("i", 0);
            job.put("results", new JSONArray());
            job.put("state", "ready");
            job.put("tries", 0);
            job.put("at", System.currentTimeMillis());
            lastJob = job.toString();
            prefs.edit().putString("job", lastJob).apply();
            web.getSettings().setLoadsImagesAutomatically(false);
            web.loadUrl(BASE + items.getJSONObject(0).getString("s"));
        } catch (Exception e) {
            finish();
        }
    }

    private String readAsset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    @Override public void finish() {
        Intent out = new Intent();
        String job = lastJob != null ? lastJob : prefs.getString("job", null);
        if (job != null) out.putExtra(EXTRA_JOB, job);
        setResult(RESULT_OK, out);
        super.finish();
    }

    @Override protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        web.removeJavascriptInterface("TPNative");
        web.destroy();
        super.onDestroy();
    }

    /** What the injected script uses to remember where it is up to. Only reachable from Morrisons pages (see the client above). */
    private class Bridge {
        @JavascriptInterface public String getJob() { return prefs.getString("job", ""); }
        @JavascriptInterface public void setJob(String json) {
            if (json != null && json.length() < MAX_JOB_CHARS) {
                lastJob = json;
                prefs.edit().putString("job", json).apply();
                // Pages load much faster without pictures, and a run doesn't need them. Back on once it's over or paused.
                final boolean busy = json.contains("\"state\":\"running\"") || json.contains("\"state\":\"ready\"");
                runOnUiThread(() -> web.getSettings().setLoadsImagesAutomatically(!busy));
            }
        }
        @JavascriptInterface public void clearJob() { prefs.edit().remove("job").apply(); }
        @JavascriptInterface public void close() { runOnUiThread(MorrisonsActivity.this::finish); }
    }
}
