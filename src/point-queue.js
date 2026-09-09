const DB_NAME = 'payroll-point-offline';
const STORE_NAME = 'clock-events';
const DB_VERSION = 1;
const syncFlights = new Map();

function hasControlChars(value) { return /[\u0000-\u001F\u007F]/.test(value); }

function isStrictIsoInstant(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const hour = Number(hourText); const minute = Number(minuteText); const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;
  if (zone !== 'Z') {
    const zoneHour = Number(zone.slice(1, 3)); const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function requireScope(scope) {
  const normalized = String(scope ?? '').trim();
  if (!normalized || hasControlChars(normalized)) throw new Error('Autentique-se antes de acessar marcações deste dispositivo.');
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

async function persistClockEvents(events) {
  if (!events.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite'); const store = tx.objectStore(STORE_NAME);
    for (const event of events) store.put(event);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
  db.close();
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
  const rawClientEventId = typeof event?.clientEventId === 'string' ? event.clientEventId : '';
  const rawEmployeeId = typeof event?.employeeId === 'string' ? event.employeeId : '';
  const rawOccurredAt = typeof event?.occurredAt === 'string' ? event.occurredAt : '';
  const clientEventId = rawClientEventId.trim(); const employeeId = rawEmployeeId.trim(); const occurredAt = rawOccurredAt.trim();
  if (!clientEventId || !employeeId || !occurredAt || rawClientEventId !== clientEventId || rawEmployeeId !== employeeId || rawOccurredAt !== occurredAt || hasControlChars(clientEventId) || hasControlChars(employeeId) || hasControlChars(occurredAt) || !isStrictIsoInstant(occurredAt)) {
    throw new Error('Marcação local inválida para sincronização.');
  }
  return { clientEventId, employeeId, occurredAt };
}

export function partitionPendingSyncEvents(events) {
  const validEvents = []; const payload = []; const quarantinedEvents = [];
  for (const event of events ?? []) {
    try {
      payload.push(toSyncPayload(event));
      validEvents.push(event);
    } catch {
      quarantinedEvents.push({
        ...event,
        status: 'REJECTED',
        rejectionReason: 'Marcação local inválida para sincronização.'
      });
    }
  }
  return { validEvents, payload, quarantinedEvents };
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
  if (!normalizedEmployeeId || hasControlChars(normalizedEmployeeId)) throw new Error('Funcionário é obrigatório para registrar a marcação.');
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
    const { validEvents, payload, quarantinedEvents } = partitionPendingSyncEvents(pending);
    await persistClockEvents(quarantinedEvents);
    if (payload.length === 0) return [];
    const results = await sendBatch(payload); const byId = indexSyncResults(validEvents, results);
    const reconciledEvents = [];
    for (const event of validEvents) {
      const result = byId.get(event.clientEventId); if (!result) continue;
      const reconciled = reconcileSyncResult(event, result);
      if (reconciled !== event) reconciledEvents.push(reconciled);
    }
    await persistClockEvents(reconciledEvents);
    return results;
  });
}
