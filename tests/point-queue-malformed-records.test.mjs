import assert from 'node:assert/strict';
import { partitionPendingSyncEvents, toSyncPayload } from '../src/point-queue.js';

const valid = {
  clientEventId: '11111111-1111-4111-8111-111111111111',
  employeeId: 'emp-1',
  occurredAt: '2026-09-09T15:37:55.123Z',
  status: 'PENDING',
  ownerScope: 'tenant-a:user-1'
};

assert.deepEqual(toSyncPayload(valid), {
  clientEventId: valid.clientEventId,
  employeeId: valid.employeeId,
  occurredAt: valid.occurredAt
});

for (const clientEventId of [` ${valid.clientEventId}`, `${valid.clientEventId} `, `${valid.clientEventId}\n`]) {
  assert.throws(() => toSyncPayload({ ...valid, clientEventId }), /inválida/);
}

for (const occurredAt of [
  '0',
  '2026-09-09',
  '2026-02-31T10:00:00Z',
  '2026-02-29T00:00:00Z',
  '2026-09-09T25:00:00Z',
  '2026-09-09T10:00:00+24:00',
  ' 2026-09-09T10:00:00Z'
]) {
  assert.throws(() => toSyncPayload({ ...valid, occurredAt }), /inválida/);
}

assert.equal(
  toSyncPayload({ ...valid, occurredAt: '2026-09-09T12:37:55-03:00' }).occurredAt,
  '2026-09-09T12:37:55-03:00'
);
assert.equal(
  toSyncPayload({ ...valid, occurredAt: '2024-02-29T00:00:00Z' }).occurredAt,
  '2024-02-29T00:00:00Z'
);

const malformed = { ...valid, clientEventId: ` ${valid.clientEventId}` };
const secondValid = {
  ...valid,
  clientEventId: '22222222-2222-4222-8222-222222222222'
};
const partition = partitionPendingSyncEvents([malformed, valid, secondValid]);

assert.equal(partition.validEvents.length, 2);
assert.deepEqual(
  partition.payload.map(item => item.clientEventId),
  [valid.clientEventId, secondValid.clientEventId]
);
assert.equal(partition.quarantinedEvents.length, 1);
assert.equal(partition.quarantinedEvents[0].clientEventId, malformed.clientEventId);
assert.equal(partition.quarantinedEvents[0].status, 'REJECTED');
assert.match(partition.quarantinedEvents[0].rejectionReason, /inválida/);

console.log('malformed point queue records are rejected without blocking valid events: PASS');
