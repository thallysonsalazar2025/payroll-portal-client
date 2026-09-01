import assert from 'node:assert/strict';
import { reconcileSyncResult, toSyncPayload } from '../src/point-queue.js';

const localEvent = {
  clientEventId: '11111111-1111-4111-8111-111111111111',
  employeeId: 'emp-1',
  occurredAt: '2026-08-31T22:00:00.000Z',
  status: 'PENDING',
  ownerScope: 'tenant-a:user-1',
  tenantId: 'tenant-b',
  token: 'must-not-leave-device',
  password: 'must-not-leave-device'
};

assert.deepEqual(toSyncPayload(localEvent), {
  clientEventId: localEvent.clientEventId,
  employeeId: localEvent.employeeId,
  occurredAt: localEvent.occurredAt
});
assert.deepEqual(Object.keys(toSyncPayload(localEvent)).sort(), ['clientEventId', 'employeeId', 'occurredAt'].sort());

const synchronizedAt = '2026-09-01T03:00:00.000Z';
const created = reconcileSyncResult(localEvent, {
  clientEventId: localEvent.clientEventId,
  status: 'CREATED',
  eventId: 'server-event-1',
  serverReceivedAt: '2026-09-01T02:59:59.000Z'
}, synchronizedAt);
assert.equal(created.status, 'SYNCED');
assert.equal(created.serverStatus, 'CREATED');
assert.equal(created.receiptId, 'server-event-1');
assert.equal(created.serverReceivedAt, '2026-09-01T02:59:59.000Z');
assert.equal(created.synchronizedAt, synchronizedAt);

const existing = reconcileSyncResult(localEvent, {
  clientEventId: localEvent.clientEventId,
  status: 'EXISTING',
  id: 'existing-event-1'
}, synchronizedAt);
assert.equal(existing.status, 'SYNCED');
assert.equal(existing.serverStatus, 'EXISTING');
assert.equal(existing.receiptId, 'existing-event-1');
assert.equal(existing.serverReceivedAt, null);

const rejected = reconcileSyncResult(localEvent, {
  clientEventId: localEvent.clientEventId,
  status: 'REJECTED',
  reason: 'Evento fora do contrato aceito.'
}, synchronizedAt);
assert.equal(rejected.status, 'REJECTED');
assert.equal(rejected.rejectionReason, 'Evento fora do contrato aceito.');

const unknown = reconcileSyncResult(localEvent, {
  clientEventId: localEvent.clientEventId,
  status: 'UNKNOWN'
}, synchronizedAt);
assert.strictEqual(unknown, localEvent);

const mismatched = reconcileSyncResult(localEvent, {
  clientEventId: '22222222-2222-4222-8222-222222222222',
  status: 'CREATED'
}, synchronizedAt);
assert.strictEqual(mismatched, localEvent);

console.log('point queue payload + reconciliation contract: PASS');
