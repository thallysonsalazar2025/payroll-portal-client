const env = {
  gatewayUrl: window.PAYROLL_GATEWAY_URL ?? (window.location.port === '4173' ? 'http://localhost:8080' : ''),
  authEndpoint: '/api/auth/login',
  generateEndpoint: '/api/payroll/generate',
  statusEndpoint: '/api/payroll/status',
  downloadEndpoint: '/api/payroll/download',
  eventsEndpoint: '/api/payroll/events',
};

const state = { token: null, requestId: null };

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token && !headers.Authorization) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${env.gatewayUrl}${path}`, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

export async function login(username, password) {
  const body = await request(env.authEndpoint, { method: 'POST', body: JSON.stringify({ username, password }) });
  state.token = body.access_token || body.token || body.jwt;
  if (!state.token) throw new Error('Token não encontrado na resposta de autenticação.');
  return body;
}

export async function generatePayroll(payload) {
  const body = await request(env.generateEndpoint, { method: 'POST', body: JSON.stringify(payload) });
  state.requestId = body.requestId || body.id || null;
  return body;
}

export async function getPayrollStatus(params) { return request(`${env.statusEndpoint}?${new URLSearchParams(params)}`); }
export async function getPayrollEvents(params) { return request(`${env.eventsEndpoint}?${new URLSearchParams(params)}`); }

export async function downloadPayrollPdf(params) {
  const res = await fetch(`${env.gatewayUrl}${env.downloadEndpoint}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${state.token}` } });
  if (!res.ok) throw new Error(`Falha no download: HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${params.requestId || params.employeeId}-${params.period}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
  return blob.size;
}

export function getSessionState() { return { ...state }; }
