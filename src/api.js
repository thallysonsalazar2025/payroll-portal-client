const env = {
  gatewayUrl: window.PAYROLL_GATEWAY_URL ?? '',
  authEndpoint: '/api/auth/login',
  generateEndpoint: '/api/payroll/generate',
  statusEndpoint: '/api/payroll/status',
  downloadEndpoint: '/api/payroll/download',
  eventsEndpoint: '/api/payroll/events',
  preValidateClosingEndpoint: '/api/payroll/closing/pre-validate',
  closePayrollEndpoint: '/api/payroll/closing',
  requestTimeoutMs: Number(window.PAYROLL_REQUEST_TIMEOUT_MS ?? 15000),
};

const state = { token: null, requestId: null };

function clearSession() { state.token = null; state.requestId = null; }
function timeoutMessage() { return 'A operação demorou mais que o esperado. Verifique a rede e tente novamente.'; }

function decodeJwtPayload(token) {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(Array.from(atob(normalized), c => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join('')));
  } catch { return null; }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) { if (error?.name === 'AbortError') throw new Error(timeoutMessage(), { cause: error }); throw error; }
  finally { clearTimeout(timeoutId); }
}

export class ApiError extends Error {
  constructor(status, path, body) { super(ApiError.messageFor(status)); this.name = 'ApiError'; this.status = status; this.path = path; }
  static messageFor(status) {
    if (status === 401) return 'Sua sessão expirou ou as credenciais são inválidas. Autentique-se novamente.';
    if (status === 403) return 'Você não tem permissão para executar esta operação.';
    if (status === 404) return 'O recurso solicitado ainda não foi encontrado.';
    if (status === 409) return 'A operação entrou em conflito com o estado atual. Atualize e tente novamente.';
    if (status === 422) return 'Os dados enviados não puderam ser processados. Revise os campos informados.';
    if (status >= 500) return 'O serviço está temporariamente indisponível. Tente novamente em instantes.';
    return `Não foi possível concluir a operação (HTTP ${status}).`;
  }
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token && !headers.Authorization) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try { res = await fetchWithTimeout(`${env.gatewayUrl}${path}`, { ...options, headers }); }
  catch (error) { if (error?.cause?.name === 'AbortError') throw error; throw new Error('Não foi possível conectar ao serviço. Verifique a rede e tente novamente.', { cause: error }); }
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) { if (res.status === 401) clearSession(); throw new ApiError(res.status, path, body); }
  return body;
}

export async function login(username, password) {
  clearSession();
  const body = await request(env.authEndpoint, { method: 'POST', body: JSON.stringify({ username, password }) });
  state.token = body.access_token || body.token || body.jwt;
  if (!state.token) throw new Error('Token não encontrado na resposta de autenticação.');
  return body;
}

export function getAuthenticatedCompanyId() {
  if (!state.token) return null;
  const claims = decodeJwtPayload(state.token);
  const companyId = String(claims?.companyId ?? '').trim();
  return companyId || null;
}

export function getAuthenticatedPointScope() {
  if (!state.token) return null;
  const claims = decodeJwtPayload(state.token);
  const companyId = getAuthenticatedCompanyId();
  if (!companyId) return null;
  const principal = claims?.employeeId || claims?.sub;
  if (!principal) return null;
  return `${companyId}:${principal}`;
}

export async function generatePayroll(payload) { const body = await request(env.generateEndpoint, { method: 'POST', body: JSON.stringify(payload) }); state.requestId = body.requestId || body.id || null; return body; }
export async function getPayrollStatus(params) { return request(`${env.statusEndpoint}?${new URLSearchParams(params)}`); }
export async function getPayrollEvents(params) { return request(`${env.eventsEndpoint}?${new URLSearchParams(params)}`); }
export async function preValidatePayrollClosing(payload) { return request(env.preValidateClosingEndpoint, { method: 'POST', body: JSON.stringify(payload) }); }
export async function closePayroll(payload) { return request(env.closePayrollEndpoint, { method: 'POST', body: JSON.stringify(payload) }); }
export async function syncTimeClockEvents(items) { return request('/api/time-clock/events/sync', { method: 'POST', body: JSON.stringify(items) }); }
export async function getTimeClockTimesheet(competence, timezone) { return request(`/api/time-clock/timesheet?${new URLSearchParams({ competence, timezone })}`); }

export async function downloadPayrollPdf(params) {
  if (!state.token) throw new Error('Autentique-se antes de baixar o PDF.');
  let res;
  try { res = await fetchWithTimeout(`${env.gatewayUrl}${env.downloadEndpoint}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${state.token}` } }); }
  catch (error) { if (error?.cause?.name === 'AbortError') throw error; throw new Error('Não foi possível conectar ao serviço para baixar o PDF.', { cause: error }); }
  if (!res.ok) { if (res.status === 401) clearSession(); throw new ApiError(res.status, env.downloadEndpoint, null); }
  const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
  a.download = `payroll-${params.requestId || params.employeeId}-${params.period || 'generated'}.pdf`; a.click(); URL.revokeObjectURL(url); return blob.size;
}

export function getSessionState() { return { ...state }; }
