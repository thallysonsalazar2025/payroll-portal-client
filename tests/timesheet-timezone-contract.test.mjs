import assert from 'node:assert/strict';
import { formatTimesheet } from '../src/timesheet.js';

const boundaryItem = [{
  clientEventId: 'tz-boundary',
  occurredAt: '2026-09-01T02:30:00Z',
  origin: 'ORIGINAL'
}];

assert.match(formatTimesheet(boundaryItem, 'pt-BR', 'America/Sao_Paulo'), /31\/08\/2026/);
assert.match(formatTimesheet(boundaryItem, 'pt-BR', 'UTC'), /01\/09\/2026/);
assert.throws(() => formatTimesheet(boundaryItem, 'pt-BR', 'Invalid/Timezone'), RangeError);

console.log('timesheet explicit timezone contract: PASS');
