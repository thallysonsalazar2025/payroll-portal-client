import assert from 'node:assert/strict';
import { defaultCompetence, formatTimesheet, normalizeTimesheet } from '../src/timesheet.js';

const items = normalizeTimesheet([
  { clientEventId: 'b', occurredAt: '2026-09-03T13:00:00Z', origin: 'AJUSTE_APROVADO', approvedAdjustmentIds: ['adj-1'] },
  { clientEventId: 'a', occurredAt: '2026-09-03T12:00:00Z', origin: 'ORIGINAL', approvedAdjustmentIds: [] }
]);

assert.deepEqual(items.map(item => item.clientEventId), ['a', 'b']);
assert.match(formatTimesheet(items), /ORIGINAL/);
assert.match(formatTimesheet(items), /ajustes aprovados: adj-1/);
assert.equal(defaultCompetence(new Date('2026-09-03T15:40:00-03:00')), '2026-09');
assert.throws(() => normalizeTimesheet({}), /lista/);
assert.throws(() => normalizeTimesheet([{ clientEventId: '', occurredAt: 'x', origin: '' }]), /item 1/);

console.log('timesheet portal contract: PASS');
