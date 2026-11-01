package com.snacktime.pos;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SnackTimePrintPlugin.class);
        SplashScreen.installSplashScreen(this);
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
