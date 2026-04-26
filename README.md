# Payroll E2E Environment (Java + RabbitMQ)

Este repositório define um ambiente de execução **somente com componentes Java/Spring Boot + RabbitMQ** para validar o fluxo E2E de geração de folha.

> Importante: as telas Flutter e a implementação do app cliente **não fazem parte deste repositório**. Aqui está apenas o ambiente de serviços para testar integração fim-a-fim (auth -> orquestração -> processamento assíncrono -> consulta -> download de PDF).

## Componentes

- sboot-security-base-auth-service
- sboot-security-base-api-gateway
- boot-payroll-orchestrator-service
- payroll-generation-request-publisher
- sboot-payroll-generation-processor
- sboot-payroll-validation-service
- sboot-payroll-calculation-service
- sboot-payroll-events-service
- sboot-payroll-query-service
- sboot-data-employe-serice
- sboot-data-company-serice
- sboot-time-tracking-integration-service
- RabbitMQ

> Observação: `sboot-security-base-api-gateway` foi informado duas vezes na lista original; no compose ele está declarado uma única vez.

## Pré-requisitos

- Docker
- Docker Compose v2
- `curl` e `jq` (para o script de smoke test)
- Imagens publicadas dos serviços com o padrão:
  - `local/<service-name>:latest` (padrão)
  - ou ajuste `IMAGE_PREFIX` e `IMAGE_TAG`

## Subir ambiente

```bash
docker compose -f docker-compose.e2e.yml up -d
```

## Executar smoke test E2E

O script `scripts/e2e-smoke.sh` executa o fluxo completo:

1. aguarda o API Gateway ficar saudável,
2. autentica no endpoint de auth,
3. solicita geração da folha,
4. faz polling no status até concluir,
5. realiza download do PDF gerado.

```bash
./scripts/e2e-smoke.sh
```

### Variáveis úteis (opcionais)

```bash
AUTH_USER=admin \
AUTH_PASS=admin \
GATEWAY_URL=http://localhost:8080 \
AUTH_ENDPOINT=/api/auth/login \
GENERATE_ENDPOINT=/api/payroll/generate \
STATUS_ENDPOINT=/api/payroll/status \
DOWNLOAD_ENDPOINT=/api/payroll/download \
EMPLOYEE_ID=123 \
COMPANY_ID=10 \
PERIOD=2026-03 \
MAX_POLL_ATTEMPTS=30 \
POLL_INTERVAL_SECONDS=2 \
./scripts/e2e-smoke.sh
```

## Derrubar ambiente

```bash
docker compose -f docker-compose.e2e.yml down -v
```
