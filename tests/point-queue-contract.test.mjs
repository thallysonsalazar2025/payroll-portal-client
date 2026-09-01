import assert from 'node:assert/strict';
import { toSyncPayload } from '../src/point-queue.js';

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
console.log('point queue sync payload minimization: PASS');
