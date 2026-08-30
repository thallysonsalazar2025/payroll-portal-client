const SUCCESS_STATUSES = new Set(['COMPLETED', 'COMPLETE', 'DONE', 'READY', 'SUCCESS', 'SUCCEEDED']);
const FAILURE_STATUSES = new Set(['FAILED', 'ERROR', 'REJECTED', 'CANCELLED', 'CANCELED']);

export function normalizePayrollStatus(payload) {
  const value = payload?.status ?? payload?.state ?? payload?.processingStatus ?? '';
  return String(value).trim().toUpperCase();
}

export function isTerminalPayrollStatus(payload) {
  const status = normalizePayrollStatus(payload);
  return SUCCESS_STATUSES.has(status) || FAILURE_STATUSES.has(status);
}

export async function pollPayrollStatus(fetchStatus, params, options = {}) {
  if (typeof fetchStatus !== 'function') throw new TypeError('fetchStatus must be a function');
  const maxAttempts = options.maxAttempts ?? 20;
  const intervalMs = options.intervalMs ?? 1500;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new RangeError('maxAttempts must be >= 1');
  if (!Number.isFinite(intervalMs) || intervalMs < 0) throw new RangeError('intervalMs must be >= 0');

  let last = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = await fetchStatus(params);
    if (isTerminalPayrollStatus(last)) return { payload: last, attempts: attempt, terminal: true };
    if (attempt < maxAttempts) await sleep(intervalMs);
  }
  return { payload: last, attempts: maxAttempts, terminal: false };
}
