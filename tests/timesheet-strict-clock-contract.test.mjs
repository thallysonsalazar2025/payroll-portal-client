import assert from 'node:assert/strict';
import { normalizeTimesheet } from '../src/timesheet.js';

const valid = {
  clientEventId: 'strict-clock',
  occurredAt: '2026-09-03T23:59:59Z',
  origin: 'ORIGINAL'
};

assert.equal(normalizeTimesheet([valid])[0].occurredAt, valid.occurredAt);

for (const occurredAt of [
  '2026-09-03T24:00:00Z',
  '2026-09-03T23:60:00Z',
  '2026-09-03T23:59:60Z',
  '2026-09-03T12:00:00+24:00',
  '2026-09-03T12:00:00+18:01',
  '2026-09-03T12:00:00+23:59',
  '2026-09-03T12:00:00+03:60'
]) {
  assert.throws(() => normalizeTimesheet([{ ...valid, occurredAt }]), /item 1/);
}

for (const occurredAt of ['2026-09-03T12:00:00-03:00', '2026-09-03T12:00:00+18:00']) {
  assert.equal(
    normalizeTimesheet([{ ...valid, clientEventId: occurredAt, occurredAt }])[0].occurredAt,
    occurredAt
  );
}

console.log('timesheet strict clock and Java-compatible timezone-offset contract: PASS');
