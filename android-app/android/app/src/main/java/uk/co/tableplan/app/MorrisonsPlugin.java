package uk.co.tableplan.app;

import android.content.Intent;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.activity.result.ActivityResult;
import org.json.JSONArray;
import org.json.JSONObject;

/** Lets the Table Plan web app (loaded in this app) hand its shopping list to the Morrisons screen. */
@CapacitorPlugin(name = "Morrisons")
public class MorrisonsPlugin extends Plugin {
    private static final int MAX_ITEMS = 120;
    private static final int MAX_QTY = 36;

    /** open({ items: [{ s: "slug/sku", q: 1-36, n: "name" }] }) */
    @PluginMethod
    public void open(PluginCall call) {
        JSArray raw = call.getArray("items");
        if (raw == null) { call.reject("No items"); return; }
        JSONArray clean = new JSONArray();
        try {
            for (int i = 0; i < raw.length() && clean.length() < MAX_ITEMS; i++) {
                JSONObject o = raw.getJSONObject(i);
                String s = o.optString("s", "");
                if (!s.matches("(?i)^[a-z0-9][a-z0-9-]*/\\d+$")) continue;
                int q = Math.max(1, Math.min(MAX_QTY, o.optInt("q", 1)));
                String n = o.optString("n", "");
                if (n.length() > 120) n = n.substring(0, 120);
                JSONObject it = new JSONObject();
                it.put("s", s); it.put("q", q); it.put("n", n);
                clean.put(it);
            }
        } catch (Exception e) { call.reject("Bad items"); return; }
        if (clean.length() == 0) { call.reject("No valid items"); return; }
        Intent intent = new Intent(getActivity(), MorrisonsActivity.class);
        intent.putExtra(MorrisonsActivity.EXTRA_ITEMS, clean.toString());
        // Resolves when the person leaves the Morrisons screen, with how the run went.
        startActivityForResult(call, intent, "finished");
    }

    @ActivityCallback
    private void finished(PluginCall call, ActivityResult result) {
        JSObject out = new JSObject();
        try {
            Intent data = result.getData();
            String job = data == null ? null : data.getStringExtra(MorrisonsActivity.EXTRA_JOB);
            if (job != null) {
                JSONObject j = new JSONObject(job);
                out.put("state", j.optString("state", ""));
                out.put("total", j.optJSONArray("items") == null ? 0 : j.getJSONArray("items").length());
                out.put("results", new JSArray(j.optJSONArray("results") == null ? "[]" : j.getJSONArray("results").toString()));
            }
        } catch (Exception ignored) { }
        call.resolve(out);
    }
}
