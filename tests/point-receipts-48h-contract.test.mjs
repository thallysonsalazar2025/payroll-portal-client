import assert from 'node:assert/strict';
import { formatReceiptExport, selectRecentSyncedReceipts } from '../src/point-queue.js';

const now = new Date('2026-09-02T18:00:00.000Z');
const events = [
  { clientEventId: 'a', receiptId: 'ra', status: 'SYNCED', serverStatus: 'CREATED', occurredAt: '2026-09-02T17:00:00.000Z' },
  { clientEventId: 'b', receiptId: 'rb', status: 'SYNCED', serverStatus: 'EXISTING', occurredAt: '2026-08-31T18:00:00.000Z' },
  { clientEventId: 'c', receiptId: 'rc', status: 'SYNCED', occurredAt: '2026-08-31T17:59:59.999Z' },
  { clientEventId: 'd', status: 'REJECTED', occurredAt: '2026-09-02T17:30:00.000Z' },
  { clientEventId: 'e', receiptId: 're', status: 'SYNCED', occurredAt: '2026-09-02T18:00:00.001Z' },
  { clientEventId: 'bad-calendar', receiptId: 'rbad', status: 'SYNCED', serverStatus: 'CREATED', occurredAt: '2026-08-32T18:00:00.000Z' },
  { clientEventId: 'bad-offset', receiptId: 'rbad-offset', status: 'SYNCED', serverStatus: 'CREATED', occurredAt: '2026-09-02T17:00:00+18:01' }
];

const selected = selectRecentSyncedReceipts(events, now, 48);
assert.deepEqual(selected.map(event => event.clientEventId), ['a', 'b']);

const exported = formatReceiptExport(selected);
assert.match(exported, /2026-09-02T17:00:00.000Z\tra\tCREATED/);
assert.match(exported, /2026-08-31T18:00:00.000Z\trb\tEXISTING/);
assert.throws(() => selectRecentSyncedReceipts([], 'not-a-date', 48), /inválido/);

const normalizationWindow = new Date('2026-03-02T12:00:00.000Z');
const impossibleCalendarDate = [
  { clientEventId: 'normalized', receiptId: 'normalized-receipt', status: 'SYNCED', serverStatus: 'CREATED', occurredAt: '2026-02-30T12:00:00Z' }
];
assert.deepEqual(selectRecentSyncedReceipts(impossibleCalendarDate, normalizationWindow, 48), []);

console.log('point receipt 48h contract: PASS');
