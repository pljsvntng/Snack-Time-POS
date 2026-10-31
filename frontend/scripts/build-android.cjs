const path=require('node:path');
const {spawnSync}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..');process.chdir(root);
 const {build,loadEnv}=await import('vite');
 const settings=loadEnv('android',root,'VITE_');
 const api=process.env.VITE_API_URL||settings.VITE_API_URL;
 const url=api?new URL(api):null;
 if(!url||url.protocol!=='https:'||/^(localhost|127\..*|\[::1\])$|\.(localhost|test|invalid|example)$|(^|\.)example\.(com|org|net)$/i.test(url.hostname)||url.username||url.password||url.pathname.replace(/\/$/,'')!=='/api')throw Error('Set the actual deployed HTTPS API URL ending in /api in frontend/.env.android.local before building Android. Localhost and example URLs are not allowed.');
 const health=await fetch(new URL('/api/health',url),{signal:AbortSignal.timeout(90000)});
 const status=await health.json();
 if(!health.ok||status.status!=='ok'||status.database!=='postgresql')throw Error('The production API health check failed. Android build stopped.');
 await build({mode:'android'});
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/@capacitor/cli/bin/capacitor'),'sync','android'],{cwd:root,stdio:'inherit',windowsHide:true});
 if(result.status!==0)process.exitCode=result.status||1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
