const enc = new TextEncoder();
export const bytes64 = bytes => btoa(String.fromCharCode(...bytes));
export const from64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0));
export function offlineError(message, status=400) { const error=new Error(message);error.status=status;return error; }
export async function verifier(password, salt) {
 const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 return bytes64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:from64(salt),iterations:600000},key,256)));
}
export function equal(a,b) { const x=from64(a),y=from64(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0; }
export async function hash(value) { return bytes64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))); }
export async function verifyGrant(token, publicKey, deviceId, now) {
 try {
  if(typeof token!=='string'||token.length>12000)throw Error();
  const parts=token.split('.');if(parts.length!==3)throw Error();
  const header=JSON.parse(new TextDecoder().decode(from64(parts[0])));
  if(header.alg!=='RS256'||header.typ!=='JWT')throw Error();
  const key=await crypto.subtle.importKey('jwk',publicKey,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,from64(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw Error();
  const p=JSON.parse(new TextDecoder().decode(from64(parts[1])));
  if(p.iss!=='snacktime-pos'||p.aud!=='snacktime-offline'||p.device_id!==deviceId||!Number.isInteger(p.user?.id)||p.user.id<1||p.sub!==String(p.user.id)||!['admin','cashier'].includes(p.user.role)||typeof p.user.username!=='string'||!p.user.username||!p.scopes?.includes('pos')||!p.scopes?.includes('own-orders')||!Number.isFinite(p.exp)||!Number.isFinite(p.iat)||p.exp<=now/1000||p.iat>now/1000+300||p.exp-p.iat>7*86400+5)throw Error();
  return p;
 }catch { throw offlineError('Offline authorization is invalid or expired. Sign in online to authorize this device again.',401); }
}
export function scaled(value, label='Amount', signed=false) {
 const text=String(value);
 if(!/^-?\d+(\.\d{1,2})?$/.test(text))throw offlineError(label+' must have at most two decimal places.');
 const negative=text.startsWith('-');const [whole,fraction='']=text.replace('-','').split('.');
 const result=Number((BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')))*(negative?-1n:1n));
 if(!Number.isSafeInteger(result)||(!signed&&result<0))throw offlineError('Invalid '+label.toLowerCase()+'.');
 return result;
}
export function integer(value,label,min=1) { if(!Number.isSafeInteger(Number(value))||Number(value)<min||typeof value==='boolean'||value==null||value==='')throw offlineError('Invalid '+label+'.');return Number(value); }
export function safe(value) { const n=Number(value);if(!Number.isSafeInteger(n))throw offlineError('Amount exceeds the supported range.');return n; }
