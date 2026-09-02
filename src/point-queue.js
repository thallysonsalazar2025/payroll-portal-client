const DB_NAME = 'payroll-point-offline';
const STORE_NAME = 'clock-events';
const DB_VERSION = 1;
const syncFlights = new Map();

function requireScope(scope) {
  const normalized = String(scope ?? '').trim();
  if (!normalized) throw new Error('Autentique-se antes de acessar marcações deste dispositivo.');
  return normalized;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'clientEventId' }); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}

function transaction(mode, operation) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode); const store = tx.objectStore(STORE_NAME); let result;
    try { result = operation(store); } catch (error) { db.close(); reject(error); return; }
    tx.oncomplete = () => { db.close(); resolve(result); }; tx.onerror = () => { db.close(); reject(tx.error); }; tx.onabort = () => { db.close(); reject(tx.error); };
  }));
}

export function runSingleFlight(scope, operation) {
  const key = requireScope(scope);
  if (syncFlights.has(key)) return syncFlights.get(key);

  const flight = Promise.resolve().then(operation).finally(() => {
    if (syncFlights.get(key) === flight) syncFlights.delete(key);
  });
  syncFlights.set(key, flight);
  return flight;
}

export function toSyncPayload(event) {
  const { clientEventId, employeeId, occurredAt } = event ?? {};
  return { clientEventId, employeeId, occurredAt };
}

export function reconcileSyncResult(event, result, synchronizedAt = new Date().toISOString()) {
  if (!event || !result || result.clientEventId !== event.clientEventId) return event;

  if (result.status === 'CREATED' || result.status === 'EXISTING') {
    const serverReceivedAt = typeof result.serverReceivedAt === 'string' && result.serverReceivedAt.trim() ? result.serverReceivedAt : null;
    return {
      ...event,
      status: 'SYNCED',
      serverStatus: result.status,
      synchronizedAt,
      serverReceivedAt,
      receiptId: result.eventId || result.id || event.clientEventId
    };
  }

  if (result.status === 'REJECTED') {
    return {
      ...event,
      status: 'REJECTED',
      rejectionReason: result.reason || 'Marcação rejeitada pelo servidor.'
    };
  }

  return event;
}

export function indexSyncResults(pendingEvents, results) {
  if (!Array.isArray(results)) throw new Error('Resposta de sincronização inválida.');
  const pendingIds = new Set((pendingEvents ?? []).map(event => event?.clientEventId).filter(Boolean));
  const byId = new Map();
  for (const result of results) {
    const clientEventId = typeof result?.clientEventId === 'string' ? result.clientEventId.trim() : '';
    if (!clientEventId || !pendingIds.has(clientEventId) || byId.has(clientEventId)) {
      throw new Error('Resposta de sincronização inconsistente.');
    }
    byId.set(clientEventId, result);
  }
  return byId;
}

export function selectRecentSyncedReceipts(events, now = new Date(), hours = 48) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error('Horário de referência inválido.');
  const windowMs = hours * 60 * 60 * 1000;
  return (events ?? []).filter(event => {
    if (event?.status !== 'SYNCED') return false;
    const occurredAtMs = Date.parse(event.occurredAt);
    return Number.isFinite(occurredAtMs) && occurredAtMs <= nowMs && occurredAtMs >= nowMs - windowMs;
  });
}

export function formatReceiptExport(events) {
  return (events ?? []).map(event => [
    event.occurredAt,
    event.receiptId ?? event.clientEventId,
    event.serverStatus ?? '',
    event.serverReceivedAt ?? ''
  ].join('\t')).join('\n');
}

export async function enqueueClockEvent(employeeId, scope) {
  const ownerScope = requireScope(scope); const normalizedEmployeeId = String(employeeId ?? '').trim();
  if (!normalizedEmployeeId) throw new Error('Funcionário é obrigatório para registrar a marcação.');
  const event = { clientEventId: crypto.randomUUID(), employeeId: normalizedEmployeeId, occurredAt: new Date().toISOString(), status: 'PENDING', ownerScope };
  await transaction('readwrite', store => store.add(event)); return event;
}

export async function listClockEvents(scope) {
  const ownerScope = requireScope(scope); const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly'); const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result.filter(event => event.ownerScope === ownerScope).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)));
    request.onerror = () => reject(request.error); tx.oncomplete = () => db.close();
  });
}

export async function syncPendingClockEvents(sendBatch, scope) {
  const ownerScope = requireScope(scope);
  return runSingleFlight(ownerScope, async () => {
    const events = await listClockEvents(ownerScope); const pending = events.filter(event => event.status === 'PENDING');
    if (pending.length === 0) return [];
    const payload = pending.map(toSyncPayload);
    const results = await sendBatch(payload); const byId = indexSyncResults(pending, results); const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME);
      for (const event of pending) {
        const result = byId.get(event.clientEventId); if (!result) continue;
        const reconciled = reconcileSyncResult(event, result);
        if (reconciled !== event) store.put(reconciled);
      }
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    db.close(); return results;
  });
}
