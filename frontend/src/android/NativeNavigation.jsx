import {useEffect,useRef,useState} from 'react';
import {useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useCart} from '../context/CartContext';
import {isAndroid} from '../offline/runtime';
import {handleAndroidBack} from './back';
import {registerPlugin} from '@capacitor/core';
const NativePrint=registerPlugin('SnackTimePrint');
export default function NativeNavigation(){
 const {user,offline}=useAuth(),cart=useCart(),location=useLocation(),navigate=useNavigate(),current=useRef(),[error,setError]=useState('');
 current.current={user,offline,cart,location,navigate};
 useEffect(()=>{
  if(!isAndroid())return;
  const previous=window.print;window.print=()=>{NativePrint.print().catch(()=>setError('The Android print dialog could not open. Your receipt remains in transaction history.'));};
  return()=>{window.print=previous;};
 },[]);
 useEffect(()=>{
  if(!isAndroid())return;
  let cancelled=false,listener,busy=false;
  import('@capacitor/app').then(async({App})=>{
   const value=await App.addListener('backButton',async()=>{
    if(busy)return;busy=true;setError('');
    try{const c=current.current;await handleAndroidBack({doc:document,path:c.location.pathname,home:c.user?.role==='admin'?'/dashboard':'/pos',index:window.history.state?.idx||0,navigate:c.navigate,minimize:()=>App.minimizeApp(),saveDraft:c.offline&&c.user?()=>c.cart.flushDraft():null});}
    catch{setError('The cart could not be saved. Keep the app open and retry.');}finally{busy=false;}
   });if(cancelled)value.remove();else listener=value;
  }).catch(()=>{if(!cancelled)setError('Android navigation could not start. Reopen the app to retry.');});
  return()=>{cancelled=true;listener?.remove();};
 },[]);
 return error?<div className="native-navigation-error" role="alert">{error}</div>:null;
}
