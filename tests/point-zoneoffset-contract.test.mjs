import assert from 'node:assert/strict';
import { toSyncPayload } from '../src/point-queue.js';

const baseEvent = {
  clientEventId: '11111111-1111-4111-8111-111111111111',
  employeeId: 'emp-1',
  occurredAt: '2026-09-10T04:00:00Z'
};

assert.equal(toSyncPayload({ ...baseEvent, occurredAt: '2026-09-10T04:00:00+18:00' }).occurredAt, '2026-09-10T04:00:00+18:00');
assert.equal(toSyncPayload({ ...baseEvent, occurredAt: '2026-09-10T04:00:00-18:00' }).occurredAt, '2026-09-10T04:00:00-18:00');
assert.throws(() => toSyncPayload({ ...baseEvent, occurredAt: '2026-09-10T04:00:00+18:01' }), /inválida/);
assert.throws(() => toSyncPayload({ ...baseEvent, occurredAt: '2026-09-10T04:00:00-18:01' }), /inválida/);
assert.throws(() => toSyncPayload({ ...baseEvent, occurredAt: '2026-09-10T04:00:00+23:59' }), /inválida/);

console.log('point ZoneOffset compatibility contract: PASS');
