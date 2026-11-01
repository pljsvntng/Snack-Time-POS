const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const frontend=path.resolve(__dirname,'..');
function resolveToolchain(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Capacitor 8 requires Node.js 22 or newer.');
 const candidates=[process.env.JAVA_HOME,'C:/Program Files/Java/jdk-21',...(process.env.ProgramFiles&&fs.existsSync(path.join(process.env.ProgramFiles,'Eclipse Adoptium'))?fs.readdirSync(path.join(process.env.ProgramFiles,'Eclipse Adoptium')).filter(s=>s.startsWith('jdk-21')).map(s=>path.join(process.env.ProgramFiles,'Eclipse Adoptium',s)):[])].filter(Boolean);
 let java,javaVersion;
 for(const candidate of candidates){const executable=path.join(candidate,'bin',process.platform==='win32'?'java.exe':'java');if(!fs.existsSync(executable))continue;const r=spawnSync(executable,['-version'],{encoding:'utf8',windowsHide:true});const output=r.stdout+r.stderr;if(r.status===0&&/version "21[.\"]/.test(output)){java=candidate;javaVersion=output.split(/\r?\n/)[0];break;}}
 if(!java)throw Error('Install JDK 21 and set JAVA_HOME to that JDK. The Android build does not use an incompatible PATH Java.');
 const properties=path.join(frontend,'android/local.properties'),configured=fs.existsSync(properties)?fs.readFileSync(properties,'utf8').match(/^sdk\.dir=(.+)$/m)?.[1].trim().replace(/\\:/g,':').replace(/\\\\/g,'\\'):null;
 const sdk=[process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,configured,process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Android/Sdk')].filter(Boolean).find(p=>fs.existsSync(path.join(p,'platforms/android-36/android.jar')));
 if(!sdk)throw Error('Install Android SDK Platform 36 and configure android/local.properties or ANDROID_HOME.');
 const tools=path.join(sdk,'build-tools/36.0.0');if(!fs.existsSync(tools))throw Error('Install Android SDK Build-Tools 36.0.0 using SDK Manager.');
 const wrapper=path.join(frontend,'android/gradle/wrapper/gradle-wrapper.jar');if(!fs.existsSync(wrapper))throw Error('The checked-in Gradle Wrapper is missing.');
 return {java,javaVersion,sdk,tools,gradle:'8.14.3',node:process.version,androidStudioFound:[process.env.ProgramFiles&&path.join(process.env.ProgramFiles,'Android/Android Studio/bin/studio64.exe'),process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Programs/Android Studio/bin/studio64.exe')].filter(Boolean).some(p=>fs.existsSync(p))};
}
module.exports={resolveToolchain};
if(require.main===module){try{console.log(JSON.stringify(resolveToolchain(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
