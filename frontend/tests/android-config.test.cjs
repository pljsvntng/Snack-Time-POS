const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('Android distribution requires encrypted native storage and excludes backup/external web loading',()=>{
 const root=path.resolve(__dirname,'..'),config=JSON.parse(fs.readFileSync(path.join(root,'capacitor.config.json')));
 assert.equal(config.plugins.CapacitorSQLite.androidIsEncryption,true);assert.equal(config.server.url,undefined);assert.equal(config.server.cleartext,false);assert.equal(config.android.allowMixedContent,false);assert.equal(config.android.webContentsDebuggingEnabled,false);
 const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');assert.ok(manifest.includes('android:allowBackup="false"'));assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));assert.ok(manifest.includes('android:dataExtractionRules="@xml/data_extraction_rules"'));
 const rules=fs.readFileSync(path.join(root,'android/app/src/main/res/xml/data_extraction_rules.xml'),'utf8');assert.ok(rules.includes('<device-transfer>'));assert.ok(rules.includes('domain="database"'));assert.ok(rules.includes('domain="sharedpref"'));
 const key=JSON.parse(fs.readFileSync(path.join(root,'src/offline/server-public-key.json')));assert.equal(key.kty,'RSA');assert.equal(key.d,undefined);
});
