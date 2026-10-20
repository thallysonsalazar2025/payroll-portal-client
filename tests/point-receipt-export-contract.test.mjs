import assert from 'node:assert/strict';
import { formatReceiptExport } from '../src/point-queue.js';
assert.equal(formatReceiptExport([{ occurredAt: '2026-09-02T17:00:00Z', receiptId: 'r1', serverStatus: 'CREATED' }]), '2026-09-02T17:00:00Z\tr1\tCREATED\t');
console.log('receipt export contract: PASS');
