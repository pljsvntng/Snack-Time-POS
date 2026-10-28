const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('fh_token');
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    const message = data?.error || 'Something went wrong. Please try again.';
    throw new Error(message);
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
  if (path.startsWith('http')) return path;
  const origin = API_BASE.replace(/\/api\/?$/, '');
  // in dev, images live in frontend/public and are served by Vite itself at the frontend origin
  const frontendOrigin = window.location.origin;
  return `${frontendOrigin}${path}`;
}
