package uk.co.tableplan.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MorrisonsPlugin.class);
        super.onCreate(savedInstanceState);
        // Android 15 draws apps edge to edge: keep the site clear of the status bar and the navigation bar.
        View content = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(content, (v, insets) -> {
            Insets sb = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(sb.left, sb.top, sb.right, sb.bottom);
            return insets;
        });
        WindowCompat.getInsetsController(getWindow(), content).setAppearanceLightStatusBars(true);
    }
}
