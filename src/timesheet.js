export function normalizeTimesheet(items) {
  if (!Array.isArray(items)) throw new TypeError('Espelho inválido: resposta deve ser uma lista.');
  const allowedOrigins = new Set(['ORIGINAL', 'AJUSTE_APROVADO', 'AUSENCIA_APROVADA']);
  const isoInstantWithZone = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
  const hasControlChars = value => /[\u0000-\u001F\u007F]/.test(value);
  const hasValidCalendarDate = value => {
    const match = isoInstantWithZone.exec(value);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1) return false;
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
  };
  const normalized = items.map((item, index) => {
    const rawClientEventId = item?.clientEventId;
    const rawOccurredAt = item?.occurredAt;
    const rawOrigin = item?.origin;
    const clientEventId = typeof rawClientEventId === 'string' ? rawClientEventId.trim() : '';
    const occurredAt = typeof rawOccurredAt === 'string' ? rawOccurredAt.trim() : '';
    const origin = typeof rawOrigin === 'string' ? rawOrigin.trim() : '';
    const hasApprovedAdjustmentIds = item != null && Object.prototype.hasOwnProperty.call(item, 'approvedAdjustmentIds');
    if (hasApprovedAdjustmentIds && !Array.isArray(item.approvedAdjustmentIds)) {
      throw new TypeError(`Espelho inválido no item ${index + 1}.`);
    }
    const rawApprovedAdjustmentIds = item?.approvedAdjustmentIds ?? [];
    const approvedAdjustmentIds = rawApprovedAdjustmentIds.map(id => typeof id === 'string' && id === id.trim() ? id : '');
    const hasAdjustmentOriginMismatch = origin === 'AJUSTE_APROVADO' ? approvedAdjustmentIds.length === 0 : approvedAdjustmentIds.length > 0;
    if (!clientEventId || rawClientEventId !== clientEventId || rawOccurredAt !== occurredAt || rawOrigin !== origin || hasControlChars(clientEventId) || !hasValidCalendarDate(occurredAt) || Number.isNaN(Date.parse(occurredAt)) || !allowedOrigins.has(origin)
      || approvedAdjustmentIds.some(id => !id || hasControlChars(id))
      || new Set(approvedAdjustmentIds).size !== approvedAdjustmentIds.length
      || hasAdjustmentOriginMismatch) {
      throw new TypeError(`Espelho inválido no item ${index + 1}.`);
    }
    return { clientEventId, occurredAt, origin, approvedAdjustmentIds };
  });
  if (new Set(normalized.map(item => item.clientEventId)).size !== normalized.length) {
    throw new TypeError('Espelho inválido: clientEventId duplicado.');
  }
  return normalized.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.clientEventId.localeCompare(b.clientEventId));
}

export function defaultCompetence(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('Data inválida.');
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatTimesheet(items, locale = 'pt-BR', timeZone = defaultTimezone()) {
  const normalized = normalizeTimesheet(items);
  if (!normalized.length) return 'Nenhuma marcação encontrada para a competência.';
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone
  });
  return normalized.map(item => {
    const timestamp = formatter.format(new Date(item.occurredAt));
    const adjustments = item.approvedAdjustmentIds.length ? ` — ajustes aprovados: ${item.approvedAdjustmentIds.join(', ')}` : '';
    return `${timestamp} — ${item.origin} — ${item.clientEventId}${adjustments}`;
  }).join('\n');
}
