import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, imageUrl } from '../services/api';
import { isAndroid, getOfflineStore, setOfflineMode, cacheImages,activateSynchronization } from '../offline/runtime';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user,setUser]=useState(()=>{if(isAndroid())return null;try{return localStorage.getItem('fh_token')?JSON.parse(localStorage.getItem('fh_user')):null;}catch{return null;}});
  const [loading,setLoading]=useState(false),[initializing,setInitializing]=useState(isAndroid());
  const [error,setError]=useState(null),[offline,setOffline]=useState(false),[offlineStatus,setOfflineStatus]=useState(null);
  const [syncStatus,setSyncStatus]=useState(null);
  const logout=useCallback(()=>{
    if(isAndroid())getOfflineStore().then(s=>{s.lock();return s.token(null);}).catch(()=>{});
    else {localStorage.removeItem('fh_token');localStorage.removeItem('fh_user');}
    setUser(null);
  },[]);
  const switchMode=useCallback(async value=>{
    logout();await setOfflineMode(value);setOffline(value);setError(null);setOfflineStatus((await (await getOfflineStore()).status()));
  },[logout]);
  const login=useCallback(async(username,password)=>{
    setLoading(true);setError(null);
    try{
      if(isAndroid()){
        const store=await getOfflineStore();store.lock();
        if((await store.status()).offline){const local=await store.login(username,password);setOffline(true);setUser(local);return local;}
        const device=(await store.status()).deviceId;
        let data;
        try{data=await api.post('/auth/login',{username,password,offline_device_id:device});}
        catch(e){if(e.status===401)await store.revoke(username);throw e;}
        await store.token(data.token);setOffline(false);
        if(data.offline_authorization){
          try {
            let snapshot=await api.post('/offline/catalog',{device_id:device});
            const pending=(await store.status()).localSales;
            if(!pending)snapshot=await cacheImages(snapshot,imageUrl);
            const prepared=await store.enroll({password,alias:username,grant:data.offline_authorization,snapshot});
            setOfflineStatus({...await store.status(),warning:prepared.retainedStock?'Local sales are retained. Offline stock has not been reset.':snapshot.missingImages?'Some product photos could not be saved; their names and prices are available.':null});
           }catch(e){
            let warning='Offline preparation failed: '+e.message;
            try { await store.renew({password,alias:username,grant:data.offline_authorization});warning='Offline authorization renewed; the existing catalog and stock were retained.'; }
            catch { await store.revoke(username); }
            setOfflineStatus({...await store.status(),warning});
          }
        }else {await store.revoke(username);setOfflineStatus({...await store.status(),warning:data.offline_error||'Offline authorization was not issued.'});}
        await store.wakeDeliveries(data.user.id);window.dispatchEvent(new Event('pos:authorized'));setUser(data.user);return data.user;
      }
      const data=await api.post('/auth/login',{username,password});
      localStorage.setItem('fh_token',data.token);localStorage.setItem('fh_user',JSON.stringify(data.user));setUser(data.user);return data.user;
    }catch(e){setError(e.message);throw e;}finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    const refreshLocal=()=>{if(isAndroid())getOfflineStore().then(s=>s.status()).then(setOfflineStatus).catch(()=>{});};
    window.addEventListener('pos:offlineupdated',refreshLocal);
    const syncChanged=e=>setSyncStatus(e.detail);window.addEventListener('pos:syncstatus',syncChanged);
    window.addEventListener('pos:unauthorized',logout);
    if(isAndroid())getOfflineStore().then(async store=>{const status=await store.status();setOffline(status.offline);setOfflineStatus(status);setSyncStatus(await store.syncStatus());activateSynchronization(store).catch(()=>setSyncStatus(s=>({...s,error:'Synchronization could not start. Retry or reopen the app.'})));}).catch(e=>setError(e.message)).finally(()=>setInitializing(false));
    else if(localStorage.getItem('fh_token'))api.get('/auth/me').then(data=>{setUser(data.user);localStorage.setItem('fh_user',JSON.stringify(data.user));}).catch(()=>{});
    return()=>{window.removeEventListener('pos:unauthorized',logout);window.removeEventListener('pos:offlineupdated',refreshLocal);window.removeEventListener('pos:syncstatus',syncChanged);};
  },[logout]);
  useEffect(()=>{
    if(!isAndroid())return;
    let listener,stopped=false,backgroundAt=0;
    import('@capacitor/app').then(({App})=>App.addListener('appStateChange',({isActive})=>{if(!isActive)backgroundAt=Date.now();else if(backgroundAt&&Date.now()-backgroundAt>300000)logout();})).then(value=>{if(stopped)value.remove();else listener=value;});
    return()=>{stopped=true;listener?.remove();};
  },[logout]);
  return <AuthContext.Provider value={{user,login,logout,loading,initializing,error,offline,offlineStatus,syncStatus,switchMode,android:isAndroid()}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider');return value;}
