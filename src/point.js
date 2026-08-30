import { login, syncTimeClockEvents, getAuthenticatedPointScope } from './api.js';
import { enqueueClockEvent, listClockEvents, syncPendingClockEvents } from './point-queue.js';

const loginForm = document.querySelector('#point-login-form');
const clockForm = document.querySelector('#clock-form');
const queueOutput = document.querySelector('#queue-output');
const statusOutput = document.querySelector('#point-status');
const syncButton = document.querySelector('#sync-point-btn');

function setStatus(message, type = 'info') { statusOutput.textContent = message; statusOutput.className = `log-${type}`; }
function scope() { return getAuthenticatedPointScope(); }
function describeEvent(event) {
  if (event.status === 'SYNCED') return `${event.occurredAt} — SINCRONIZADA — comprovante ${event.receiptId} — servidor ${event.serverStatus} — sincronizada em ${event.synchronizedAt}`;
  if (event.status === 'REJECTED') return `${event.occurredAt} — REJEITADA — ${event.clientEventId} — ${event.rejectionReason}`;
  return `${event.occurredAt} — ${event.status} — ${event.clientEventId}`;
}

async function renderQueue() {
  const authenticatedScope = scope();
  if (!authenticatedScope) { queueOutput.textContent = 'Autentique-se para visualizar as marcações deste dispositivo.'; return; }
  const events = await listClockEvents(authenticatedScope);
  queueOutput.textContent = events.length ? events.map(describeEvent).join('\n') : 'Nenhuma marcação registrada para esta sessão.';
}

async function syncQueue() {
  const authenticatedScope = scope();
  if (!authenticatedScope) return setStatus('Autentique-se antes de sincronizar marcações.', 'info');
  if (!navigator.onLine) return setStatus('Sem conexão. As marcações permanecem no dispositivo.', 'info');
  try {
    const results = await syncPendingClockEvents(syncTimeClockEvents, authenticatedScope);
    setStatus(results.length ? 'Sincronização concluída. Comprovantes locais atualizados.' : 'Não há marcações pendentes para sincronizar.', 'ok');
    await renderQueue();
  } catch (error) { setStatus(`Sincronização não concluída: ${error.message}`, 'err'); }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault(); const data = new FormData(event.currentTarget);
  try {
    await login(data.get('username'), data.get('password'));
    if (!scope()) throw new Error('A identidade autenticada não contém companyId e principal válidos para o ponto.');
    setStatus('Sessão autenticada. A fila local não armazena token ou senha.', 'ok'); await renderQueue(); await syncQueue();
  } catch (error) { setStatus(error.message, 'err'); }
});

clockForm.addEventListener('submit', async event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const authenticatedScope = scope();
  try {
    if (!authenticatedScope) throw new Error('Autentique-se antes de registrar a marcação neste dispositivo.');
    const queued = await enqueueClockEvent(data.get('employeeId'), authenticatedScope);
    setStatus(`Marcação ${queued.clientEventId} registrada localmente.`, 'ok'); await renderQueue(); await syncQueue();
  } catch (error) { setStatus(error.message, 'err'); }
});

syncButton.addEventListener('click', syncQueue); window.addEventListener('online', syncQueue);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => setStatus('Fila offline ativa; cache PWA indisponível.', 'err'));
renderQueue().catch(error => setStatus(error.message, 'err'));
