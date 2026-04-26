# Payroll Portal Client + E2E Environment

Este projeto agora contém:

1. **Ambiente E2E de microsserviços** via Docker Compose (Java + RabbitMQ).
2. **Código das telas do cliente web** para executar o fluxo ponta a ponta.
3. **Teste E2E de interface** com Playwright cobrindo login -> geração -> status -> eventos -> download.

## Componentes suportados no fluxo

- sboot-security-base-auth-service
- sboot-security-base-api-gateway
- boot-payroll-orchestrator-service
- payroll-generation-request-publisher
- RabbitMQ
- sboot-payroll-generation-processor
- sboot-payroll-validation-service
- sboot-payroll-calculation-service
- sboot-data-employe-serice
- sboot-data-company-serice
- sboot-time-tracking-integration-service
- sboot-payroll-events-service
- sboot-payroll-query-service

## Estrutura

- `docker-compose.e2e.yml`: sobe os serviços do fluxo de folha
- `scripts/e2e-smoke.sh`: smoke test de integração backend
- `index.html` + `src/*`: telas e lógica do cliente web
- `tests/e2e/*`: teste E2E de tela com Playwright

## Executar telas localmente

```bash
python3 -m http.server 4173
# abrir http://localhost:4173
```

## Executar teste E2E de telas

```bash
npm install
npm run test:e2e
```

## Executar smoke test backend

```bash
docker compose -f docker-compose.e2e.yml up -d
./scripts/e2e-smoke.sh
```

## Observações

- O cliente web chama o API Gateway em `http://localhost:8080` por padrão.
- Para customizar a URL, defina `window.PAYROLL_GATEWAY_URL` antes de carregar `src/main.js`.
