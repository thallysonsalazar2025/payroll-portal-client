# Payroll E2E Environment (Java + RabbitMQ)

Este repositório define um ambiente de execução **somente com componentes Java/Spring Boot + RabbitMQ** para validar o fluxo E2E de geração de folha.

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
- Imagens publicadas dos serviços com o padrão:
  - `local/<service-name>:latest` (padrão)
  - ou ajuste `IMAGE_PREFIX` e `IMAGE_TAG`

## Subir ambiente

```bash
docker compose -f docker-compose.e2e.yml up -d
```

## Executar smoke test E2E

```bash
./scripts/e2e-smoke.sh
```

## Derrubar ambiente

```bash
docker compose -f docker-compose.e2e.yml down -v
```
