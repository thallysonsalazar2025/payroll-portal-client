import assert from 'node:assert/strict';
import { indexSyncResults, reconcileSyncResult, runSingleFlight, toSyncPayload } from '../src/point-queue.js';

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

let releaseTenantA;
let releaseTenantB;
let tenantACalls = 0;
let tenantBCalls = 0;
const tenantAFlight = runSingleFlight('tenant-a:user-1', async () => {
  tenantACalls += 1;
  await new Promise(resolve => { releaseTenantA = resolve; });
  return 'tenant-a-result';
});
const tenantBFlight = runSingleFlight('tenant-b:user-1', async () => {
  tenantBCalls += 1;
  await new Promise(resolve => { releaseTenantB = resolve; });
  return 'tenant-b-result';
});
await Promise.resolve();
assert.equal(tenantACalls, 1);
assert.equal(tenantBCalls, 1);
assert.notStrictEqual(tenantAFlight, tenantBFlight);
releaseTenantA();
releaseTenantB();
assert.equal(await tenantAFlight, 'tenant-a-result');
assert.equal(await tenantBFlight, 'tenant-b-result');

let releaseFirstFlight;
let operationCalls = 0;
const firstFlight = runSingleFlight('tenant-a:user-1', async () => {
  operationCalls += 1;
  await new Promise(resolve => { releaseFirstFlight = resolve; });
  return 'first-result';
});
const duplicateFlight = runSingleFlight('tenant-a:user-1', async () => {
  operationCalls += 1;
  return 'must-not-run';
});
assert.strictEqual(duplicateFlight, firstFlight);
await Promise.resolve();
assert.equal(operationCalls, 1);
releaseFirstFlight();
assert.equal(await duplicateFlight, 'first-result');
assert.equal(await runSingleFlight('tenant-a:user-1', async () => {
  operationCalls += 1;
  return 'second-result';
}), 'second-result');
assert.equal(operationCalls, 2);

let failureCalls = 0;
await assert.rejects(
  runSingleFlight('tenant-a:user-failure', async () => {
    failureCalls += 1;
    throw new Error('backend unavailable');
  }),
  /backend unavailable/
);
assert.equal(await runSingleFlight('tenant-a:user-failure', async () => {
  failureCalls += 1;
  return 'retry-result';
}), 'retry-result');
assert.equal(failureCalls, 2);

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

const indexed = indexSyncResults([localEvent], [{ clientEventId: localEvent.clientEventId, status: 'CREATED' }]);
assert.equal(indexed.get(localEvent.clientEventId)?.status, 'CREATED');
assert.throws(() => indexSyncResults([localEvent], [
  { clientEventId: localEvent.clientEventId, status: 'CREATED' },
  { clientEventId: localEvent.clientEventId, status: 'EXISTING' }
]), /inconsistente/);
assert.throws(() => indexSyncResults([localEvent], [
  { clientEventId: '33333333-3333-4333-8333-333333333333', status: 'CREATED' }
]), /inconsistente/);
assert.throws(() => indexSyncResults([localEvent], [{ status: 'CREATED' }]), /inconsistente/);

console.log('point queue payload + tenant-scope isolation + single-flight + failure retry + reconciliation contract: PASS');
