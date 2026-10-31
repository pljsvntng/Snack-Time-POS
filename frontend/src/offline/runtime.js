import { Capacitor } from '@capacitor/core';
import { OfflineStore } from './store.js';
import publicKey from './server-public-key.json';

export const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform()==='android';
let storePromise;
export function getOfflineStore() {
 if(!isAndroid())return Promise.reject(new Error('Offline SQLite is available in the Android application.'));
 if(!storePromise)storePromise=import('./android-driver.js').then(m=>m.openAndroidDatabase()).then(async driver=>{const store=new OfflineStore(driver,publicKey);await store.initialize();return store;});
 return storePromise;
}
export async function offlineMode() { return isAndroid() ? (await (await getOfflineStore()).status()).offline : false; }
export async function setOfflineMode(value) { const store=await getOfflineStore();store.lock();await store.mode(value);window.dispatchEvent(new Event('pos:modechange')); }
export async function activateSynchronization(store){
 if(!isAndroid())return;
 const baseUrl=import.meta.env.VITE_API_URL;if(!baseUrl||!baseUrl.startsWith('https://'))return;
 const {startSynchronization}=await import('./sync-manager.js');
 return startSynchronization(store,{baseUrl,cacheSnapshot:snapshot=>cacheImages(snapshot,p=>new URL(p,baseUrl.replace(/\/api\/?$/,'')+'/').href)});
}
export async function offlineRequest(path,{method='GET',body}={}) {
 const store=await getOfflineStore();const url=new URL(path,'https://pos.invalid');
 if(method==='GET'&&['/products','/categories','/discounts','/settings'].includes(url.pathname))return store.catalog(url.pathname.slice(1));
 if(method==='GET'&&url.pathname==='/orders')return store.listOrders(Object.fromEntries(url.searchParams));
 if(method==='GET'&&url.pathname.startsWith('/orders/'))return store.order(decodeURIComponent(url.pathname.slice(8)));
 if(method==='POST'&&url.pathname==='/orders'){const receipt=await store.checkout(body);window.dispatchEvent(new Event('pos:offlineupdated'));return receipt;}
 if(method==='GET'&&url.pathname==='/auth/me'){const user=await store.exclusive(()=>store.actor());return {user:{...user,serverRole:user.role,role:'cashier',offline:true}};}
 throw new Error('This feature needs the online server. Offline mode supports cash POS and your transaction history.');
}
export async function cacheImages(snapshot, imageUrl) {
 const products=[];let missingImages=0;
 for(const product of snapshot.products){
  let image=null;
  if(product.image){
   try {
    const response=await fetch(imageUrl(product.image),{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();
    const blob=await response.blob();if(!blob.type.startsWith('image/')||blob.size>5*1024*1024)throw Error();
    if(blob.size<=96*1024)image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    else {
      const bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas');const ratio=Math.min(1,384/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();image=canvas.toDataURL('image/webp',0.7);if(image.length>180000)throw Error('Photo is too large for local preview');
    }
   }catch{missingImages++;}
  }
  products.push({...product,image});
 }
 return {...snapshot,products,missingImages};
}
