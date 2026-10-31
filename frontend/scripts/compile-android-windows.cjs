// Materialize the native build outside OneDrive. Gradle cannot reliably snapshot
// OneDrive cloud reparse-point images even when their contents are readable.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
try{
 if(process.platform!=='win32')throw Error('Use Gradle directly on non-Windows platforms.');
 const frontend=path.resolve(__dirname,'..'),native=path.join(frontend,'android');
 const local=process.env.LOCALAPPDATA;if(!local)throw Error('LOCALAPPDATA is unavailable.');
 const stage=path.join(local,'SnackTimePOS','builds','android-'+crypto.randomUUID());
 const copy=(from,to)=>{fs.mkdirSync(to,{recursive:true});for(const item of fs.readdirSync(from,{withFileTypes:true})){if(['.gradle','build','.git'].includes(item.name))continue;const source=path.join(from,item.name),target=path.join(to,item.name);if(fs.statSync(source).isDirectory())copy(source,target);else fs.writeFileSync(target,fs.readFileSync(source));}};
 if(!fs.existsSync(path.join(native,'app/src/main/assets/public/index.html')))throw Error('Run npm run android:prepare first.');
 copy(native,stage);
 const settings=path.join(stage,'capacitor.settings.gradle');let settingsText=fs.readFileSync(settings,'utf8');
 const projects=[['@capacitor/android/capacitor','capacitor-android'],['@capacitor-community/sqlite/android','capacitor-community-sqlite'],['@capacitor/app/android','capacitor-app'],['@capacitor/network/android','capacitor-network']];
 for(const [source,name] of projects){
  const destination=path.join(stage,'native-plugins',name);copy(path.join(frontend,'node_modules',source),destination);
  settingsText=settingsText.replaceAll('../node_modules/'+source,destination.replaceAll('\\','/'));
 }
 fs.writeFileSync(settings,settingsText);
 const java=process.env.JAVA_HOME||'C:/Program Files/Java/jdk-21';if(!fs.existsSync(path.join(java,'bin/java.exe')))throw Error('Set JAVA_HOME to JDK 21.');
 console.log('Building materialized Android assets outside OneDrive.');
 const result=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c','gradlew.bat :app:assembleDebug --no-daemon'],{cwd:stage,env:{...process.env,JAVA_HOME:java},stdio:'inherit',windowsHide:true});
 if(result.error||result.status!==0)throw Error('Android Gradle build failed. Inspect the build output above.');
 const bytes=fs.readFileSync(path.join(stage,'app/build/outputs/apk/debug/app-debug.apk'));
 const artifacts=path.resolve(frontend,'../database/backups/android-build-artifacts');fs.mkdirSync(artifacts,{recursive:true});
 const apk=path.join(artifacts,'snack-time-pos-cloud-debug.apk');fs.writeFileSync(apk,bytes);
 fs.writeFileSync(path.join(artifacts,'build.json'),JSON.stringify({createdAt:new Date().toISOString(),apk,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),stage,releaseSigned:false},null,2));
 console.log('Debug APK for device testing: '+apk);
}catch(e){console.error(e.message);process.exitCode=1;}
