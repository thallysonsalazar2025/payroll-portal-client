import assert from 'node:assert/strict';
import { indexSyncResults } from '../src/point-queue.js';

const event = {
  clientEventId: '11111111-1111-4111-8111-111111111111',
  employeeId: 'emp-1',
  occurredAt: '2026-09-10T03:00:00.000Z',
  status: 'PENDING'
};

const exact = indexSyncResults([event], [
  { clientEventId: event.clientEventId, status: 'CREATED' }
]);
assert.equal(exact.get(event.clientEventId)?.status, 'CREATED');

assert.throws(() => indexSyncResults([event], [
  { clientEventId: ` ${event.clientEventId}`, status: 'CREATED' }
]), /inconsistente/);

assert.throws(() => indexSyncResults([event], [
  { clientEventId: `${event.clientEventId} `, status: 'CREATED' }
]), /inconsistente/);

assert.throws(() => indexSyncResults([event], [
  { clientEventId: `${event.clientEventId}\n`, status: 'CREATED' }
]), /inconsistente/);

console.log('point sync result exact-id contract: PASS');
