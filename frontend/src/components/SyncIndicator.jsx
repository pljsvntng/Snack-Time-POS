import {useAuth} from '../context/AuthContext';
import {useNavigate} from 'react-router-dom';
export default function SyncIndicator(){
 const {android,offline,offlineStatus,syncStatus:s,switchMode}=useAuth(),navigate=useNavigate();
 if(!android)return null;
 return <section className="offline-status sync-indicator" aria-label="Synchronization status">
  <div role="status" aria-live="polite"><b>{s?.online?'Online':'Offline'}</b> · {offline?'Offline cash register':'Online register'} · {s?.pending??0} pending sale(s){s?.inProgress?' · Synchronizing…':''}</div>
  <div className="sync-actions"><button className="btn btn-outline btn-sm" disabled={s?.inProgress} onClick={()=>window.dispatchEvent(new Event('pos:syncretry'))}>Retry synchronization</button>
  <button className="btn btn-outline btn-sm" disabled={!offline&&!offlineStatus?.preparedAt} onClick={async()=>{await switchMode(!offline);navigate('/login');}}>{offline?'Sign in online':'Use offline POS'}</button></div>
  <small>Last successful upload: {s?.lastSuccess?new Date(s.lastSuccess).toLocaleString('en-PH'):'No sales uploaded yet'}. Saved receipts remain on this device.</small>
  {s?.authRequired>0&&<small>Sign in online again to authorize pending uploads.</small>}
  {s?.review>0&&<small>{s.review} archived sale(s) need administrator approval in Inventory → Offline reconciliation.</small>}
  {(s?.error||s?.catalogError||offlineStatus?.warning)&&<small role="alert">{s?.error||s?.catalogError||offlineStatus?.warning}</small>}
  {offline&&<small>Stock snapshot: {s?.catalogAt?new Date(s.catalogAt).toLocaleString('en-PH'):'unavailable'}. Other devices may have sold the same stock.</small>}
  {s?.catalogDeferred&&<small>Catalog updates will apply after the saved cart is cleared or checked out.</small>}
 </section>;
}
