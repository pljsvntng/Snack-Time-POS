import { isAndroid, getOfflineStore, offlineMode, offlineRequest } from '../offline/runtime';
const configuredApi = import.meta.env.VITE_API_URL;
const API_BASE = (configuredApi?.startsWith('/') ? new URL(configuredApi, window.location.origin).href : configuredApi || `${window.location.protocol}//${window.location.hostname}:4000/api`).replace(/\/$/, '');

async function getToken() {
  return isAndroid() ? (await getOfflineStore()).token() : localStorage.getItem('fh_token');
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const native=isAndroid();
  if(native && await offlineMode()){try{return await offlineRequest(path,{method,body});}catch(error){if(error.status===401)window.dispatchEvent(new Event('pos:unauthorized'));throw error;}}
  if(native && method==='GET' && /^\/orders\/(local:|server:)/.test(path))return (await getOfflineStore()).order(path.slice(8));
  if(native && (!import.meta.env.VITE_API_URL || !API_BASE.startsWith('https://') || ['localhost','127.0.0.1','[::1]'].includes(new URL(API_BASE).hostname)))throw new Error('Configure a reachable HTTPS VITE_API_URL in frontend/.env.android.local and rebuild Android before online authorization.');
  const headers = {};
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  let res;
  try { res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    signal: AbortSignal.timeout(90000),
    ...(native?{redirect:'error'}:{}),
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  }); } catch { const error=new Error('Cannot reach the POS server. Check your connection or choose offline POS on the Android sign-in screen.');if(method==='POST' && path==='/orders')error.message='The online checkout response was lost. Check online transaction history before retrying or starting an offline sale.';error.network=true;throw error; }

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    const message = data?.error || 'Something went wrong. Please try again.';
    if (res.status === 401 && path !== '/auth/login') {
      if(native){const store=await getOfflineStore();if(store.session)await store.revoke(store.session.user.username);await store.token(null);}
      else {localStorage.removeItem('fh_token'); localStorage.removeItem('fh_user');}
      window.dispatchEvent(new Event('pos:unauthorized'));
    }
    const error = new Error(message); error.status = res.status; throw error;
  }
  if(native && method==='GET' && path.startsWith('/orders') && !/^\/orders\//.test(path)) {
    try { const local=await (await getOfflineStore()).listOrders({...Object.fromEntries(new URL(path,'https://pos.invalid').searchParams),localOnly:true});const serverIds=new Set(data.map(o=>o.id));return [...local.filter(o=>!serverIds.has(o.server_order_id)),...data].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)); }catch{}
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData, isFormData: true }),
};

export function imageUrl(path) {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('data:image/')) return path;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  // The API serves both bundled catalog images and new uploads.

  return `${origin}${path}`;
}
