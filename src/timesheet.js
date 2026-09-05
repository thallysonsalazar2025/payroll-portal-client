export function normalizeTimesheet(items) {
  if (!Array.isArray(items)) throw new TypeError('Espelho inválido: resposta deve ser uma lista.');
  const allowedOrigins = new Set(['ORIGINAL', 'AJUSTE_APROVADO', 'AUSENCIA_APROVADA']);
  return items.map((item, index) => {
    const clientEventId = String(item?.clientEventId ?? '').trim();
    const occurredAt = String(item?.occurredAt ?? '').trim();
    const origin = String(item?.origin ?? '').trim();
    const approvedAdjustmentIds = Array.isArray(item?.approvedAdjustmentIds) ? item.approvedAdjustmentIds.map(String) : [];
    if (!clientEventId || !occurredAt || Number.isNaN(Date.parse(occurredAt)) || !allowedOrigins.has(origin)) {
      throw new TypeError(`Espelho inválido no item ${index + 1}.`);
    }
    return { clientEventId, occurredAt, origin, approvedAdjustmentIds };
  }).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.clientEventId.localeCompare(b.clientEventId));
}

export function defaultCompetence(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new TypeError('Data inválida.');
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function defaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function formatTimesheet(items, locale = 'pt-BR') {
  const normalized = normalizeTimesheet(items);
  if (!normalized.length) return 'Nenhuma marcação encontrada para a competência.';
  return normalized.map(item => {
    const timestamp = new Date(item.occurredAt).toLocaleString(locale);
    const adjustments = item.approvedAdjustmentIds.length ? ` — ajustes aprovados: ${item.approvedAdjustmentIds.join(', ')}` : '';
    return `${timestamp} — ${item.origin} — ${item.clientEventId}${adjustments}`;
  }).join('\n');
}
