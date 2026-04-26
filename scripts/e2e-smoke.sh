#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.e2e.yml}"
BASE_URL="${GATEWAY_URL:-http://localhost:8080}"
AUTH_ENDPOINT="${AUTH_ENDPOINT:-/api/auth/login}"
GENERATE_ENDPOINT="${GENERATE_ENDPOINT:-/api/payroll/generate}"
STATUS_ENDPOINT="${STATUS_ENDPOINT:-/api/payroll/status}"
DOWNLOAD_ENDPOINT="${DOWNLOAD_ENDPOINT:-/api/payroll/download}"
AUTH_USER="${AUTH_USER:-admin}"
AUTH_PASS="${AUTH_PASS:-admin}"
PERIOD="${PERIOD:-2026-03}"
EMPLOYEE_ID="${EMPLOYEE_ID:-123}"
COMPANY_ID="${COMPANY_ID:-10}"
MAX_POLL_ATTEMPTS="${MAX_POLL_ATTEMPTS:-30}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-2}"

log() {
  printf '\n[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Dependência obrigatória não encontrada: $cmd"
    exit 1
  fi
}

extract_json_field() {
  local field="$1"
  jq -r "$field // empty" /tmp/payroll-e2e-response.json
}

require_cmd curl
require_cmd jq

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

log "Autenticando no serviço de auth via gateway..."
AUTH_HTTP_CODE=$(curl -s -o /tmp/payroll-auth-response.json -w '%{http_code}' \
  -X POST "$BASE_URL$AUTH_ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\"}")

if [[ "$AUTH_HTTP_CODE" -lt 200 || "$AUTH_HTTP_CODE" -ge 300 ]]; then
  log "Falha na autenticação. HTTP=$AUTH_HTTP_CODE"
  cat /tmp/payroll-auth-response.json || true
  exit 1
fi

TOKEN=$(jq -r '.access_token // .token // .jwt // empty' /tmp/payroll-auth-response.json)
if [[ -z "$TOKEN" ]]; then
  log "Não foi possível extrair token (access_token/token/jwt)."
  cat /tmp/payroll-auth-response.json || true
  exit 1
fi

log "Disparando requisição de geração de folha..."
HTTP_CODE=$(curl -s -o /tmp/payroll-e2e-response.json -w '%{http_code}' \
  -X POST "$BASE_URL$GENERATE_ENDPOINT" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"employeeId\":\"$EMPLOYEE_ID\",\"companyId\":\"$COMPANY_ID\",\"period\":\"$PERIOD\"}")

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  log "Falha na chamada de geração. HTTP=$HTTP_CODE"
  cat /tmp/payroll-e2e-response.json || true
  exit 1
fi

REQUEST_ID=$(extract_json_field '.requestId')
if [[ -z "$REQUEST_ID" ]]; then
  REQUEST_ID=$(extract_json_field '.id')
fi

log "Fluxo disparado com sucesso. HTTP=$HTTP_CODE"
if [[ -n "$REQUEST_ID" ]]; then
  log "requestId detectado: $REQUEST_ID"
else
  log "requestId não retornado; seguirá por employeeId + period."
fi

log "Aguardando processamento assíncrono até status=COMPLETED..."
STATUS_PAYLOAD=""
for attempt in $(seq 1 "$MAX_POLL_ATTEMPTS"); do
  if [[ -n "$REQUEST_ID" ]]; then
    QUERY_URL="$BASE_URL$STATUS_ENDPOINT?requestId=$REQUEST_ID"
  else
    QUERY_URL="$BASE_URL$STATUS_ENDPOINT?employeeId=$EMPLOYEE_ID&period=$PERIOD"
  fi

  STATUS_HTTP=$(curl -s -o /tmp/payroll-status-response.json -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    "$QUERY_URL")

  if [[ "$STATUS_HTTP" -lt 200 || "$STATUS_HTTP" -ge 300 ]]; then
    log "Tentativa $attempt/$MAX_POLL_ATTEMPTS - status endpoint respondeu HTTP=$STATUS_HTTP"
  else
    STATUS_PAYLOAD=$(cat /tmp/payroll-status-response.json)
    CURRENT_STATUS=$(jq -r '.status // .state // empty' /tmp/payroll-status-response.json)
    log "Tentativa $attempt/$MAX_POLL_ATTEMPTS - status atual: ${CURRENT_STATUS:-<vazio>}"

    if [[ "$CURRENT_STATUS" == "COMPLETED" || "$CURRENT_STATUS" == "DONE" || "$CURRENT_STATUS" == "SUCCESS" ]]; then
      log "Processamento concluído."
      break
    fi

    if [[ "$CURRENT_STATUS" == "FAILED" || "$CURRENT_STATUS" == "ERROR" ]]; then
      log "Fluxo retornou falha de negócio."
      echo "$STATUS_PAYLOAD"
      exit 1
    fi
  fi

  if [[ "$attempt" -eq "$MAX_POLL_ATTEMPTS" ]]; then
    log "Timeout aguardando conclusão da geração."
    echo "$STATUS_PAYLOAD"
    exit 1
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done

if [[ -n "$REQUEST_ID" ]]; then
  DOWNLOAD_URL="$BASE_URL$DOWNLOAD_ENDPOINT?requestId=$REQUEST_ID"
else
  DOWNLOAD_URL="$BASE_URL$DOWNLOAD_ENDPOINT?employeeId=$EMPLOYEE_ID&period=$PERIOD"
fi

log "Realizando download do PDF gerado..."
DOWNLOAD_HTTP=$(curl -s -o /tmp/payroll-output.pdf -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  "$DOWNLOAD_URL")

if [[ "$DOWNLOAD_HTTP" -lt 200 || "$DOWNLOAD_HTTP" -ge 300 ]]; then
  log "Falha no download do PDF. HTTP=$DOWNLOAD_HTTP"
  exit 1
fi

PDF_SIZE=$(wc -c </tmp/payroll-output.pdf)
if [[ "$PDF_SIZE" -le 0 ]]; then
  log "Arquivo PDF vazio."
  exit 1
fi

log "E2E smoke test finalizado com sucesso. PDF em /tmp/payroll-output.pdf (${PDF_SIZE} bytes)."
