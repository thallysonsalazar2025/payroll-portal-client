import assert from 'node:assert/strict';
import { defaultCompetence, formatTimesheet, normalizeTimesheet } from '../src/timesheet.js';

const items = normalizeTimesheet([
  { clientEventId: 'b', occurredAt: '2026-09-03T13:00:00Z', origin: 'AJUSTE_APROVADO', approvedAdjustmentIds: ['adj-1'] },
  { clientEventId: 'a', occurredAt: '2026-09-03T12:00:00Z', origin: 'ORIGINAL', approvedAdjustmentIds: [] },
  { clientEventId: 'c', occurredAt: '2026-09-03T14:00:00Z', origin: 'AUSENCIA_APROVADA', approvedAdjustmentIds: [] }
]);

assert.deepEqual(items.map(item => item.clientEventId), ['a', 'b', 'c']);

const tiedTimestampItems = normalizeTimesheet([
  { clientEventId: 'z', occurredAt: '2026-09-03T15:00:00Z', origin: 'ORIGINAL' },
  { clientEventId: 'a', occurredAt: '2026-09-03T15:00:00Z', origin: 'ORIGINAL' }
]);
assert.deepEqual(tiedTimestampItems.map(item => item.clientEventId), ['a', 'z']);
assert.deepEqual(normalizeTimesheet([...tiedTimestampItems].reverse()), tiedTimestampItems);

assert.match(formatTimesheet(items), /ORIGINAL/);
assert.match(formatTimesheet(items), /AJUSTE_APROVADO/);
assert.match(formatTimesheet(items), /AUSENCIA_APROVADA/);
assert.match(formatTimesheet(items), /ajustes aprovados: adj-1/);
assert.equal(defaultCompetence(new Date('2026-09-03T15:40:00-03:00')), '2026-09');
assert.throws(() => normalizeTimesheet({}), /lista/);
assert.throws(() => normalizeTimesheet([{ clientEventId: '', occurredAt: 'x', origin: '' }]), /item 1/);
assert.throws(() => normalizeTimesheet([{ clientEventId: 'r', occurredAt: '2026-09-03T15:00:00Z', origin: 'AJUSTE_REJEITADO' }]), /item 1/);
assert.throws(() => normalizeTimesheet([{ clientEventId: 'x', occurredAt: '2026-09-03T16:00:00Z', origin: 'CANCELLED' }]), /item 1/);
assert.throws(() => normalizeTimesheet([{ clientEventId: 'm1', occurredAt: '2026-09-03T17:00:00Z', origin: 'AJUSTE_APROVADO', approvedAdjustmentIds: [''] }]), /item 1/);
assert.throws(() => normalizeTimesheet([{ clientEventId: 'm2', occurredAt: '2026-09-03T17:00:00Z', origin: 'AJUSTE_APROVADO', approvedAdjustmentIds: [null] }]), /item 1/);
assert.throws(() => normalizeTimesheet([{ clientEventId: 'm3', occurredAt: '2026-09-03T17:00:00Z', origin: 'AJUSTE_APROVADO', approvedAdjustmentIds: ['adj-1', 'adj-1'] }]), /item 1/);
assert.throws(() => normalizeTimesheet([
  { clientEventId: 'dup-1', occurredAt: '2026-09-03T18:00:00Z', origin: 'ORIGINAL' },
  { clientEventId: 'dup-1', occurredAt: '2026-09-03T19:00:00Z', origin: 'AJUSTE_APROVADO' }
]), /clientEventId duplicado/);

console.log('timesheet portal effective-origin, adjustment-id, duplicate-event and deterministic-order contract: PASS');
