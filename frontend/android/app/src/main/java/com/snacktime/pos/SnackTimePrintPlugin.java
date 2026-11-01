package com.snacktime.pos;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SnackTimePrint")
public class SnackTimePrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (manager == null) {call.reject("Android printing is unavailable on this device.");return;}
                manager.print("Snack Time POS", getBridge().getWebView().createPrintDocumentAdapter("Snack Time POS"), new PrintAttributes.Builder().build());
                call.resolve();
            } catch (Exception ignored) {
                call.reject("The print dialog could not open. Your receipt remains in transaction history.");
            }
        });
    }
}
