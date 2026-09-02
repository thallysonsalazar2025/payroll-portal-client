import assert from 'node:assert/strict';
import { formatReceiptExport, selectRecentSyncedReceipts } from '../src/point-queue.js';

const now = new Date('2026-09-02T18:00:00.000Z');
const events = [
  { clientEventId: 'a', receiptId: 'ra', status: 'SYNCED', serverStatus: 'CREATED', occurredAt: '2026-09-02T17:00:00.000Z' },
  { clientEventId: 'b', receiptId: 'rb', status: 'SYNCED', serverStatus: 'EXISTING', occurredAt: '2026-08-31T18:00:00.000Z' },
  { clientEventId: 'c', receiptId: 'rc', status: 'SYNCED', occurredAt: '2026-08-31T17:59:59.999Z' },
  { clientEventId: 'd', status: 'REJECTED', occurredAt: '2026-09-02T17:30:00.000Z' },
  { clientEventId: 'e', receiptId: 're', status: 'SYNCED', occurredAt: '2026-09-02T18:00:00.001Z' }
];

const selected = selectRecentSyncedReceipts(events, now, 48);
assert.deepEqual(selected.map(event => event.clientEventId), ['a', 'b']);

const exported = formatReceiptExport(selected);
assert.match(exported, /2026-09-02T17:00:00.000Z\tra\tCREATED/);
assert.match(exported, /2026-08-31T18:00:00.000Z\trb\tEXISTING/);
assert.throws(() => selectRecentSyncedReceipts([], 'not-a-date', 48), /inválido/);

console.log('point receipt 48h contract: PASS');
