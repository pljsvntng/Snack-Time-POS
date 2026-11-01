import {useEffect,useId,useState} from 'react';
import {AlertTriangle,ChevronDown,RefreshCw} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {useNavigate} from 'react-router-dom';

// These warnings stay visible outside the disclosure until explicitly acknowledged.
const storageWarning=message=>/sqlite|local storage|database|encrypt|corrupt|data loss|keep.*data.*intact|(?:cannot|could not|failed to).*(?:save|persist|commit)|(?:save|persist|commit).*fail/i.test(message||'');
const stamp=value=>value?new Date(value).toLocaleString('en-PH'):'Unavailable';
export default function SyncIndicator(){
 const {android,offline,offlineStatus,syncStatus:s,switchMode}=useAuth(),navigate=useNavigate();
 const [expanded,setExpanded]=useState(false),[lastError,setLastError]=useState(''),[retainedWarnings,setRetainedWarnings]=useState([]),detailsId=useId();
 const error=s?.error||s?.catalogError||'',catalogError=s?.catalogError||'',warning=offlineStatus?.warning||'';
 const activeWarnings=[...new Set([error,catalogError,warning].filter(storageWarning))];
 useEffect(()=>{if(error)setLastError(error);},[error]);
 useEffect(()=>{const important=[error,catalogError,warning].filter(storageWarning);if(important.length)setRetainedWarnings(previous=>[...new Set([...previous,...important])]);},[error,catalogError,warning]);
 if(!android)return null;
 const pending=s?.pending??0,online=Boolean(s?.online),busy=Boolean(s?.inProgress);
 const attention=Boolean(error||warning||s?.blocked||s?.authRequired||s?.review);
 const label=online?'Online':'Offline',queue=online&&pending===0?'Synced':`${pending} pending`;
 const important=[...new Set([...retainedWarnings,...activeWarnings])];
 const toggle=()=>setExpanded(value=>!value),retry=()=>window.dispatchEvent(new Event('pos:syncretry'));
 const signIn=async mode=>{await switchMode(mode);navigate('/login');};
 return <section className={`sync-indicator ${expanded?'is-expanded':''}`} aria-label="Synchronization status">
  <div className="sync-status-bar">
   <button className="sync-summary" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={toggle} aria-label={`${label}, ${queue}${busy?', synchronizing':''}${attention?', synchronization needs attention':''}. ${expanded?'Hide':'Show'} synchronization details`}>
    <span className={`sync-dot ${online?'is-online':'is-offline'}`} aria-hidden="true"/>
    <span role="status" aria-live="polite" className="sync-summary-text"><b>{label}</b><span aria-hidden="true"> · </span><span>{queue}</span>{busy&&<span className="sr-only"> · Synchronizing</span>}</span>
    <span className="sync-register-label">{offline?'Offline cash register':'Online register'}</span>
    {attention&&<AlertTriangle className="sync-attention" size={17} aria-hidden="true"/>}
   </button>
   <button type="button" className={`sync-icon-button sync-retry ${busy?'is-syncing':''}`} aria-label="Retry synchronization" title={busy?'Synchronization in progress':'Retry synchronization'} aria-busy={busy} disabled={busy} onClick={retry}><RefreshCw size={18}/></button>
   <button type="button" className="sync-icon-button sync-toggle" aria-label={`${expanded?'Collapse':'Expand'} synchronization details`} aria-expanded={expanded} aria-controls={detailsId} onClick={toggle}><ChevronDown size={20} aria-hidden="true"/></button>
  </div>
  {important.length>0&&<div className="sync-critical" role="alert"><AlertTriangle size={18} aria-hidden="true"/><div>{important.map(message=><p key={message}>{message}</p>)}{activeWarnings.length===0&&<button type="button" className="btn btn-outline btn-sm" onClick={()=>setRetainedWarnings([])}>Acknowledge retained warning</button>}</div></div>}
  <div id={detailsId} className="sync-details" hidden={!expanded} aria-label="Synchronization details">
   <dl className="sync-detail-grid">
    <div><dt>Connection</dt><dd>{label}{busy?' · Synchronizing…':''}</dd></div>
    <div><dt>Register</dt><dd>{offline?'Offline cash register':'Online register'}</dd></div>
    <div><dt>Pending sales</dt><dd>{pending}</dd></div>
    <div><dt>Last successful upload</dt><dd>{s?.lastSuccess?stamp(s.lastSuccess):'No sales uploaded yet'}</dd></div>
    <div><dt>Stock snapshot</dt><dd>{stamp(s?.catalogAt||offlineStatus?.preparedAt)}</dd></div>
    <div><dt>Last synchronization error</dt><dd>{error||lastError||'None reported'}</dd></div>
   </dl>
   <div className="sync-actions">
    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={retry}>Retry synchronization</button>
    <button type="button" className="btn btn-outline btn-sm" onClick={()=>signIn(false)}>Sign in online</button>
    {!offline&&<button type="button" className="btn btn-outline btn-sm" disabled={!offlineStatus?.preparedAt} onClick={()=>signIn(true)}>Use offline POS</button>}
   </div>
   {s?.authRequired>0&&<p>Sign in online again to authorize pending uploads.</p>}
   {s?.blocked>0&&<p>{s.blocked} sale(s) need attention. Retry to view the server response; saved receipts remain intact.</p>}
   {s?.review>0&&<p>{s.review} archived sale(s) need administrator approval in Inventory → Offline reconciliation.</p>}
   {warning&&!storageWarning(warning)&&<p>{warning}</p>}
   {s?.catalogDeferred&&<p>Catalog updates will apply after the saved cart is cleared or checked out.</p>}
   <p className="sync-footnote">Saved receipts remain on this device. Other devices may have sold stock since the snapshot.</p>
  </div>
 </section>;
}
