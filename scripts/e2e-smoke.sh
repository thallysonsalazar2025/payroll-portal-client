#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.e2e.yml}"
BASE_URL="${GATEWAY_URL:-http://localhost:8080}"

log() {
  printf '\n[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

log "Subindo ambiente E2E (Java + RabbitMQ)..."
docker compose -f "$COMPOSE_FILE" up -d

log "Aguardando API Gateway responder /actuator/health ..."
for i in $(seq 1 60); do
  if curl -fsS "$BASE_URL/actuator/health" >/dev/null 2>&1; then
    log "Gateway online."
    break
  fi
  sleep 2
  if [[ "$i" -eq 60 ]]; then
    log "Timeout aguardando gateway."
    docker compose -f "$COMPOSE_FILE" ps
    exit 1
  fi
done

log "Disparando requisição de geração de folha (exemplo)..."
HTTP_CODE=$(curl -s -o /tmp/payroll-e2e-response.json -w '%{http_code}' \
  -X POST "$BASE_URL/api/payroll/generate" \
  -H 'Content-Type: application/json' \
  -d '{"employeeId":"123","companyId":"10","period":"2026-03"}')

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  log "Falha na chamada de geração. HTTP=$HTTP_CODE"
  cat /tmp/payroll-e2e-response.json || true
  exit 1
fi

log "Fluxo disparado com sucesso. HTTP=$HTTP_CODE"
log "Validando disponibilidade de consulta..."
curl -fsS "$BASE_URL/api/payroll/status?employeeId=123&period=2026-03" >/dev/null

log "E2E smoke test finalizado com sucesso."
