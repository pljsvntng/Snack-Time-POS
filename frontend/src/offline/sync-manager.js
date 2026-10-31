// The engine is transport-independent so timeout/crash/retry tests use the same code.
export class SyncManager {
 constructor(store,{baseUrl,fetcher=globalThis.fetch.bind(globalThis),connected=()=>true,now=()=>Date.now(),random=Math.random,onChange=()=>{},onUnauthorized=()=>{},cacheSnapshot=async s=>s,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=clearTimeout}={}){
  const url=new URL(baseUrl);if(url.protocol!=='https:'||url.username||url.password||['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Synchronization requires the deployed HTTPS API.');
  Object.assign(this,{store,baseUrl:baseUrl.replace(/\/$/,''),fetcher,connected,now,random,onChange,onUnauthorized,cacheSnapshot,schedule,cancel});this.state={online:false,inProgress:false,error:null};this.failures=0;this.stopped=false;this.refreshAt=0;
 }
 async emit(update={}){Object.assign(this.state,update);let status={};try{status=await this.store.syncStatus();}catch{this.state.error='SQLite is unavailable. Synchronization will retry without discarding sales.';}this.onChange({...this.state,...status});}
 async http(path,{grant,body,timeout=90000}={}){
  const controller=new AbortController();this.controller=controller;
  const timer=this.schedule(()=>controller.abort(),timeout);
  try{
   const response=await this.fetcher(this.baseUrl+path,{method:body===undefined?'GET':'POST',headers:{...(grant?{Authorization:'Bearer '+grant}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,redirect:'error'});
   let data;try{data=await response.json();}catch{data={};}
   if(!response.ok){const e=Error(typeof data.error==='string'?data.error:'The POS server is temporarily unavailable.');e.status=response.status;throw e;}return data;
  }catch(e){if(!e.status)throw Error(e.name==='AbortError'?'The API timed out. Pending sales are safe and will retry.':'Cannot reach the API. Render may be starting; pending sales are safe.');throw e;}
  finally{this.cancel(timer);if(this.controller===controller)this.controller=null;}
 }
 stop(){this.stopped=true;this.cancel(this.timer);this.controller?.abort();}
 networkChanged(connected){if(!connected){this.controller?.abort();return this.emit({online:false});}return this.kick();}
 kick({retry=false,refresh=false}={}){
  if(this.stopped)return Promise.resolve();if(this.running){this.again=true;this.retryAgain=this.retryAgain||retry;return this.running;}
  this.cancel(this.timer);this.timer=null;this.running=this.run({retry,refresh}).catch(()=>{this.retryLater(30000);return this.emit({inProgress:false,error:'Local storage could not confirm synchronization. Sales remain queued.'});}).finally(()=>{this.running=null;if(this.again&&!this.stopped){this.again=false;const retry=this.retryAgain;this.retryAgain=false;this.kick({retry});}});return this.running;
 }
 async run({retry=false,refresh=false}={}){
  let current=null,transient=false;
  try{
   if(!await this.connected()){await this.emit({online:false,inProgress:false});return;}
   await this.emit({inProgress:true,error:null});const health=await this.http('/health');if(health.status!=='ok'||health.database!=='postgresql')throw Error('The POS API is not ready.');await this.emit({online:true});
   const rows=await this.store.deliveryRows({retry});let remaining=false;
   for(const row of rows){
    if(this.stopped||!await this.connected())break;
    if(row.revoked){await this.store.deliveryFailure(row.order_id,{state:'auth_required',message:'Sign in online to authorize this account.'});continue;}
    if(!retry&&row.next_attempt_ms>this.now()){remaining=true;break;}
    current=row;await this.store.deliveryAttempt(row.order_id);
    try{
     const ack=row.state==='review_required'?await this.http('/offline/sales/'+row.payload.client_id,{grant:row.grant_jwt}):await this.http('/offline/sales',{grant:row.grant_jwt,body:row.payload});
     await this.store.acknowledge(row.order_id,ack);this.failures=0;await this.emit();
    }catch(e){
     if(e.status===401){const locked=await this.store.requireReauthorization(row.user_id);if(locked)this.onUnauthorized();await this.emit({error:'Online sign-in is required to synchronize this account.'});}
     else if(e.status&&e.status<500&&e.status!==408&&e.status!==429){await this.store.deliveryFailure(row.order_id,{state:'blocked',message:e.message});await this.emit({error:e.message});}
     else throw e;
    }
    current=null;
   }
   const credential=await this.store.catalogCredential();
   if(credential&&(refresh||rows.some(r=>r.state!=='review_required')||this.now()-this.refreshAt>5*60000)){
    try{
     let snapshot=await this.http('/offline/catalog',{grant:credential.grant,body:{device_id:credential.deviceId}});snapshot=await this.cacheSnapshot(snapshot);const applied=await this.store.refreshCatalog(snapshot,credential);if(!applied.deferred){this.refreshAt=this.now();this.onCatalog?.();}
    }catch(e){await this.store.catalogFailure(e.status===401?'Sign in online to refresh the catalog.':e.message);if(e.status===401){const locked=await this.store.requireReauthorization(credential.userId);if(locked)this.onUnauthorized();}else if(!e.status||e.status>=500)transient=true;}
   }
   const pending=await this.store.deliveryRows();remaining=remaining||pending.some(r=>r.state==='pending');
   if(remaining)this.retryLater(2000);
  }catch(e){
   transient=true;this.failures++;const delay=Math.min(300000,2000*2**Math.min(this.failures,8))*(0.8+this.random()*0.4);
   if(current)await this.store.deliveryFailure(current.order_id,{message:e.message,retryAt:this.now()+delay});
   await this.emit({online:false,error:e.message});this.retryLater(delay);
  }finally{await this.emit({inProgress:false});if(transient&&!this.timer&&!this.stopped)this.retryLater(30000);}
 }
 retryLater(delay){if(this.stopped)return;this.cancel(this.timer);this.timer=this.schedule(()=>{this.timer=null;this.kick();},delay);}
}

let manager;
export async function startSynchronization(store,{baseUrl,cacheSnapshot}={}){
 if(manager)return manager;
 const {Network}=await import('@capacitor/network'),{App}=await import('@capacitor/app');
 manager=new SyncManager(store,{baseUrl,cacheSnapshot,connected:async()=>(await Network.getStatus()).connected,onChange:state=>window.dispatchEvent(new CustomEvent('pos:syncstatus',{detail:state})),onUnauthorized:()=>window.dispatchEvent(new Event('pos:unauthorized'))});
 manager.onCatalog=()=>window.dispatchEvent(new Event('pos:catalogupdated'));
 await Network.addListener('networkStatusChange',state=>manager.networkChanged(state.connected));
 await App.addListener('appStateChange',state=>{if(state.isActive)manager.kick({refresh:true});});
 window.addEventListener('pos:offlineupdated',()=>manager.kick());window.addEventListener('pos:authorized',()=>manager.kick({retry:true,refresh:true}));window.addEventListener('pos:syncretry',()=>manager.kick({retry:true,refresh:true}));
 window.addEventListener('pos:cartpersisted',async()=>{try{if((await store.syncStatus()).catalogDeferred)manager.kick({refresh:true});}catch{await manager.emit({error:'SQLite is unavailable. Saved receipts will be checked again on retry.'});}});
 manager.kick({refresh:true});return manager;
}
