package uk.co.tableplan.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
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
    private static final String BASE = "https://groceries.morrisons.com/products/";
    private static final int MAX_JOB_CHARS = 200_000;

    private WebView web;
    private String script = "";
    private SharedPreferences prefs;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        prefs = getSharedPreferences("tableplan", MODE_PRIVATE);
        script = readAsset("morrisons.js");

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(Color.parseColor("#1c6b4a"));
        int pad = (int) (12 * getResources().getDisplayMetrics().density);
        bar.setPadding(pad, pad, pad, pad);
        Button back = new Button(this);
        back.setText("← Table Plan");
        back.setAllCaps(false);
        back.setOnClickListener(v -> finish());
        TextView title = new TextView(this);
        title.setText("  Morrisons trolley");
        title.setTextColor(Color.WHITE);
        title.setTextSize(16);
        bar.addView(back);
        bar.addView(title);
        web = new WebView(this);
        root.addView(bar, new LinearLayout.LayoutParams(-1, -2));
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadsImagesAutomatically(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.addJavascriptInterface(new Bridge(), "TPNative");
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
            prefs.edit().putString("job", job.toString()).apply();
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
            if (json != null && json.length() < MAX_JOB_CHARS) prefs.edit().putString("job", json).apply();
        }
        @JavascriptInterface public void clearJob() { prefs.edit().remove("job").apply(); }
        @JavascriptInterface public void close() { runOnUiThread(MorrisonsActivity.this::finish); }
    }
}
