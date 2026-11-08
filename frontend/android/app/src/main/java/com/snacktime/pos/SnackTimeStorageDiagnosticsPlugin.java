package com.snacktime.pos;

import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Validated-profile read-only diagnostics. Never returns contents or Keystore values. */
@CapacitorPlugin(name="SnackTimeStorageDiagnostics")
public class SnackTimeStorageDiagnosticsPlugin extends Plugin {
    private String activeDatabase="snack_time_offline";
    private static final Set<String> STAGES=new HashSet<>(Arrays.asList("configuration","key","open","keyed_handle","materialize","persisted_file","reopen","ready"));
    private static final Set<String> CODES=new HashSet<>(Arrays.asList("BEGIN","OK","CONFIG_DISABLED","MISSING_KEY","HANDLE_UNKEYED","FILE_NOT_ENCRYPTED","NATIVE_FAILURE","MALFORMED_RESULT"));

    private String databaseName(PluginCall call) {
        String name=call.getString("database");
        if(name==null)name=activeDatabase;
        return name.matches("snack_time_offline(?:_demo_[a-z0-9_]{1,40})?")?name:null;
    }
    private JSObject snapshot(String name) {
        File database=getContext().getDatabasePath(name+"SQLite.db");
        File wal=new File(database.getPath()+"-wal"),journal=new File(database.getPath()+"-journal");
        String header=database.exists()?(database.length()==0?"empty":"opaque"):"absent";
        if(database.exists()&&database.length()>=16){
            try(FileInputStream input=new FileInputStream(database)){
                byte[] bytes=new byte[16];
                if(input.read(bytes)==16&&Arrays.equals(bytes,"SQLite format 3\u0000".getBytes(StandardCharsets.US_ASCII)))header="plaintext";
            }catch(Exception ignored){header="unreadable";}
        }
        boolean artifacts=false;
        File[] files=database.getParentFile().listFiles();
        if(files!=null)for(File file:files)if(file.getName().matches("snack_time_offline(?:_demo_[a-z0-9_]{1,40})?SQLite\\.db(?:-wal|-journal|-shm)?")){artifacts=true;break;}
        JSObject result=new JSObject();result.put("database",name);result.put("databasePresent",database.exists());result.put("walPresent",wal.exists());result.put("journalPresent",journal.exists());result.put("anyDatabaseArtifacts",artifacts);
        result.put("databaseBytes",database.length());result.put("walBytes",wal.length());result.put("headerKind",header);result.put("androidSdk",Build.VERSION.SDK_INT);return result;
    }
    @PluginMethod
    public void inspectState(PluginCall call){String name=databaseName(call);if(name==null){call.reject("Invalid database profile");return;}call.resolve(snapshot(name));}

    @PluginMethod
    public void record(PluginCall call){
        String stage=call.getString("stage"),code=call.getString("code"),name=databaseName(call);
        if(name==null||!STAGES.contains(stage)||!CODES.contains(code)){call.reject("Invalid diagnostic code");return;}
        if(stage.equals("ready")&&code.equals("OK"))activeDatabase=name;
        // Strict enum inputs + non-sensitive file metadata only. No raw exceptions.
        Log.i("SnackTimeStorage","stage="+stage+" code="+code+" state="+snapshot(name).toString());call.resolve();
    }
}
