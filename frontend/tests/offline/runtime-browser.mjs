// Test-only SQLite transport. Never imported by production builds.
const address='http://127.0.0.1:14804';let queue=Promise.resolve();
function call(method,args=[]){const task=queue.then(async()=>{const res=await fetch(address+'/sqlite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,args})});const result=await res.json();if(!res.ok){const error=new Error(result.error);error.status=result.status;throw error;}return result.value;});queue=task.catch(()=>{});return task;}
const methods=['status','mode','enroll','renew','login','revoke','token','catalog','draft','listOrders','order','checkout'];
const store=Object.fromEntries(methods.map(method=>[method,(...args)=>call(method,args)]));store.lock=()=>call('lock');store.session=null;
export const isAndroid=()=>true;
export const getOfflineStore=async()=>store;
export const offlineMode=async()=>(await store.status()).offline;
export const setOfflineMode=async value=>{await store.lock();await store.mode(value);};
export const cacheImages=async snapshot=>({...snapshot,products:snapshot.products.map(p=>({...p,image:null}))});
export async function offlineRequest(path,{method='GET',body}={}){
 const url=new URL(path,'https://pos.test');
 if(method==='GET'&&['/products','/categories','/discounts','/settings'].includes(url.pathname))return store.catalog(url.pathname.slice(1));
 if(method==='GET'&&url.pathname==='/orders')return store.listOrders(Object.fromEntries(url.searchParams));
 if(method==='GET'&&url.pathname.startsWith('/orders/'))return store.order(url.pathname.slice(8));
 if(method==='POST'&&url.pathname==='/orders'){const r=await store.checkout(body);window.dispatchEvent(new Event('pos:offlineupdated'));return r;}
 if(method==='GET'&&url.pathname==='/auth/me')return {user:await call('identity')};
 throw Error('Unavailable offline');
}
