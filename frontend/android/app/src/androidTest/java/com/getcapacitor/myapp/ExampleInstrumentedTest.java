package com.snacktime.pos;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.PermissionInfo;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.Arrays;
import java.util.HashSet;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void packagePermissionsAndLocalDataPolicy() throws Exception {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.snacktime.pos", appContext.getPackageName());
        ApplicationInfo info = appContext.getApplicationInfo();
        assertEquals(0, info.flags & ApplicationInfo.FLAG_ALLOW_BACKUP);
        assertEquals(0, info.flags & ApplicationInfo.FLAG_USES_CLEARTEXT_TRAFFIC);
        String[] permissions = appContext.getPackageManager().getPackageInfo(appContext.getPackageName(), PackageManager.GET_PERMISSIONS).requestedPermissions;
        String internalPermission = appContext.getPackageName() + ".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION";
        HashSet<String> allowed = new HashSet<>(Arrays.asList("android.permission.INTERNET", "android.permission.ACCESS_NETWORK_STATE", internalPermission));
        for (String permission : permissions) assertTrue("Unexpected application permission", allowed.contains(permission));
        PermissionInfo internal = appContext.getPackageManager().getPermissionInfo(internalPermission, 0);
        assertEquals(PermissionInfo.PROTECTION_SIGNATURE, internal.protectionLevel & PermissionInfo.PROTECTION_MASK_BASE);
    }

    // Read-only checks: never reset SQLite, clear app data, or create business sales.
    @Test
    public void nativeStartupOpensEncryptedPersistentStorage() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            long deadline = System.currentTimeMillis() + 60000;
            while (!"true".equals(evaluate(scenario, "!!document.querySelector('#username') && !document.querySelector('.native-storage-error')"))) {
                assertTrue("Native startup did not reach secure sign-in", System.currentTimeMillis() < deadline);
                Thread.sleep(250);
            }
            assertEquals("true", evaluate(scenario, "window.Capacitor.isPluginAvailable('CapacitorSQLite') && window.Capacitor.isPluginAvailable('Network') && window.Capacitor.isPluginAvailable('App')"));
            evaluate(scenario, "window.__phase7EncryptionProbe=null; Promise.all([window.Capacitor.Plugins.CapacitorSQLite.isDatabaseEncrypted({database:'snack_time_offline'}),window.Capacitor.Plugins.CapacitorSQLite.isSecretStored()]).then(r=>{window.__phase7EncryptionProbe=r.every(v=>v.result===true);}).catch(()=>{window.__phase7EncryptionProbe=false;}); true;");
            while ("null".equals(evaluate(scenario, "window.__phase7EncryptionProbe"))) {
                assertTrue("Native encrypted storage probe timed out", System.currentTimeMillis() < deadline);
                Thread.sleep(250);
            }
            assertEquals("true", evaluate(scenario, "window.__phase7EncryptionProbe"));
        }
    }

    private String evaluate(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(script, result -> {value.set(result);completed.countDown();}));
        assertTrue("WebView evaluation timed out", completed.await(10, TimeUnit.SECONDS));
        return value.get();
    }
}
