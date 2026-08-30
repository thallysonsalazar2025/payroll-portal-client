import { login, syncTimeClockEvents } from './api.js';
import { enqueueClockEvent, listClockEvents, syncPendingClockEvents } from './point-queue.js';

const loginForm = document.querySelector('#point-login-form');
const clockForm = document.querySelector('#clock-form');
const queueOutput = document.querySelector('#queue-output');
const statusOutput = document.querySelector('#point-status');
const syncButton = document.querySelector('#sync-point-btn');

function setStatus(message, type = 'info') {
  statusOutput.textContent = message;
  statusOutput.className = `log-${type}`;
}

async function renderQueue() {
  const events = await listClockEvents();
  if (events.length === 0) {
    queueOutput.textContent = 'Nenhuma marcação pendente.';
    return;
  }
  queueOutput.textContent = events.map(event => {
    const suffix = event.status === 'REJECTED' ? ` — ${event.rejectionReason}` : '';
    return `${event.occurredAt} — ${event.status} — ${event.clientEventId}${suffix}`;
  }).join('\n');
}

async function syncQueue() {
  if (!navigator.onLine) {
    setStatus('Sem conexão. As marcações permanecem no dispositivo.', 'info');
    return;
  }
  try {
    const results = await syncPendingClockEvents(syncTimeClockEvents);
    setStatus(results.length ? 'Sincronização concluída.' : 'Não há marcações pendentes para sincronizar.', 'ok');
    await renderQueue();
  } catch (error) {
    setStatus(`Sincronização não concluída: ${error.message}`, 'err');
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    await login(data.get('username'), data.get('password'));
    setStatus('Sessão autenticada. A fila local não armazena token ou senha.', 'ok');
    await syncQueue();
  } catch (error) {
    setStatus(error.message, 'err');
  }
});

clockForm.addEventListener('submit', async event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    const queued = await enqueueClockEvent(data.get('employeeId'));
    setStatus(`Marcação ${queued.clientEventId} registrada localmente.`, 'ok');
    await renderQueue();
    await syncQueue();
  } catch (error) {
    setStatus(error.message, 'err');
  }
});

syncButton.addEventListener('click', syncQueue);
window.addEventListener('online', syncQueue);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {
    setStatus('Modo offline disponível para a fila; cache PWA não pôde ser registrado.', 'err');
  });
}

renderQueue().catch(error => setStatus(error.message, 'err'));
