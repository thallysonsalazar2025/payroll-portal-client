# Payroll Portal Client em Flutter


## Fluxo suportado

- login no gateway
- geracao de holerite
- consulta de status
- consulta de eventos
- download do PDF

## Estrutura

- `lib/`: app Flutter
- `web/`: bootstrap web
- `test/`: testes de widget
- `docker-compose.e2e.yml`: ambiente de apoio do ecossistema
- `scripts/e2e-smoke.sh`: smoke test backend

## Configuracao do gateway

Por padrao o app aponta para:

- `http://localhost:8080`

Para trocar a URL em runtime:

```bash
flutter run -d chrome --dart-define=PAYROLL_GATEWAY_URL=http://localhost:8080
```

## Executar localmente

```bash
flutter pub get
flutter run -d chrome
```

Ou no ambiente atual do Windows:

```powershell
.\scripts\run-web.ps1
```

## Gerar build web

```bash
flutter build web
```

## Observacoes

- Neste ambiente atual eu nao encontrei o SDK do Flutter instalado, entao a refatoracao foi preparada no codigo, mas nao validada com `flutter run`.
- O backend continua sendo Java, e o gateway em `8080` segue como ponto unico de entrada da interface.
