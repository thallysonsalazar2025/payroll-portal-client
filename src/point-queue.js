const DB_NAME = 'payroll-point-offline';
const STORE_NAME = 'clock-events';
const DB_VERSION = 1;

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

export function toSyncPayload(event) {
  const { clientEventId, employeeId, occurredAt } = event ?? {};
  return { clientEventId, employeeId, occurredAt };
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
  const ownerScope = requireScope(scope); const events = await listClockEvents(ownerScope); const pending = events.filter(event => event.status === 'PENDING');
  if (pending.length === 0) return [];
  const payload = pending.map(toSyncPayload);
  const results = await sendBatch(payload); if (!Array.isArray(results)) throw new Error('Resposta de sincronização inválida.');
  const byId = new Map(results.map(result => [result.clientEventId, result])); const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME);
    for (const event of pending) {
      const result = byId.get(event.clientEventId); if (!result) continue;
      if (result.status === 'CREATED' || result.status === 'EXISTING') {
        const serverReceivedAt = typeof result.serverReceivedAt === 'string' && result.serverReceivedAt.trim() ? result.serverReceivedAt : null;
        store.put({ ...event, status: 'SYNCED', serverStatus: result.status, synchronizedAt: new Date().toISOString(), serverReceivedAt, receiptId: result.eventId || result.id || event.clientEventId });
      } else if (result.status === 'REJECTED') store.put({ ...event, status: 'REJECTED', rejectionReason: result.reason || 'Marcação rejeitada pelo servidor.' });
    }
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
  db.close(); return results;
}
