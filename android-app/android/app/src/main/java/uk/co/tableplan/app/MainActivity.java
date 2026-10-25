package uk.co.tableplan.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MorrisonsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
