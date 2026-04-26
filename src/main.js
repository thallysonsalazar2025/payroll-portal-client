import {
  login,
  generatePayroll,
  getPayrollStatus,
  getPayrollEvents,
  downloadPayrollPdf,
  getSessionState,
} from './api.js';

const app = document.querySelector('#app');

const services = [
  'sboot-security-base-auth-service',
  'sboot-security-base-api-gateway',
  'boot-payroll-orchestrator-service',
  'payroll-generation-request-publisher',
  'RabbitMQ',
  'sboot-payroll-generation-processor',
  'sboot-payroll-validation-service',
  'sboot-payroll-calculation-service',
  'sboot-data-employe-serice',
  'sboot-data-company-serice',
  'sboot-time-tracking-integration-service',
  'sboot-payroll-events-service',
  'sboot-payroll-query-service',
];

let requestId = '';

function log(message, type = 'info') {
  const panel = document.querySelector('#log-panel');
  const row = document.createElement('p');
  row.className = `log-${type}`;
  row.textContent = `${new Date().toISOString()} - ${message}`;
  panel.prepend(row);
}

function render() {
  app.innerHTML = `
    <section class="grid">
      <article class="card">
        <h2>Tela 1: Login</h2>
        <form id="login-form">
          <input name="username" value="admin" required />
          <input name="password" value="admin" type="password" required />
          <button type="submit">Autenticar</button>
        </form>
      </article>

      <article class="card">
        <h2>Tela 2: Geração de Folha</h2>
        <form id="generate-form">
          <input name="employeeId" value="123" required />
          <input name="companyId" value="10" required />
          <input name="period" value="2026-03" required />
          <button type="submit">Gerar</button>
        </form>
        <small id="request-id"></small>
      </article>

      <article class="card">
        <h2>Tela 3: Status e Eventos</h2>
        <button id="status-btn">Consultar status</button>
        <button id="events-btn">Consultar eventos</button>
        <pre id="status-output"></pre>
      </article>

      <article class="card">
        <h2>Tela 4: Download PDF</h2>
        <button id="download-btn">Baixar PDF</button>
      </article>
    </section>

    <section class="card">
      <h2>Mapa de Comunicação entre Componentes</h2>
      <ol>
        ${services.map((service) => `<li>${service}</li>`).join('')}
      </ol>
      <p>
        Fluxo implementado: Auth Service -> API Gateway -> Orchestrator -> Publisher -> RabbitMQ -> Processor
        -> Validation/Calculation/Data/TimeTracking -> Events -> Query -> Gateway -> Cliente.
      </p>
    </section>

    <section class="card">
      <h2>Logs do fluxo E2E</h2>
      <div id="log-panel"></div>
    </section>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    try {
      await login(data.get('username'), data.get('password'));
      log('Autenticação realizada com sucesso.', 'ok');
    } catch (error) {
      log(error.message, 'err');
    }
  });

  document.querySelector('#generate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const payload = {
      employeeId: data.get('employeeId'),
      companyId: data.get('companyId'),
      period: data.get('period'),
    };

    try {
      const result = await generatePayroll(payload);
      requestId = result.requestId || result.id || '';
      document.querySelector('#request-id').textContent = `requestId: ${requestId || 'não retornado'}`;
      log('Requisição de geração enviada para o orquestrador.', 'ok');
    } catch (error) {
      log(error.message, 'err');
    }
  });

  document.querySelector('#status-btn').addEventListener('click', async () => {
    const form = document.querySelector('#generate-form');
    const data = new FormData(form);
    const params = requestId
      ? { requestId }
      : { employeeId: data.get('employeeId'), period: data.get('period') };

    try {
      const status = await getPayrollStatus(params);
      document.querySelector('#status-output').textContent = JSON.stringify(status, null, 2);
      log(`Status consultado: ${status.status || status.state || 'indefinido'}.`, 'ok');
    } catch (error) {
      log(error.message, 'err');
    }
  });

  document.querySelector('#events-btn').addEventListener('click', async () => {
    if (!requestId) return log('Gere uma folha antes de consultar eventos.', 'err');
    try {
      const events = await getPayrollEvents({ requestId });
      document.querySelector('#status-output').textContent = JSON.stringify(events, null, 2);
      log('Eventos da folha consultados com sucesso.', 'ok');
    } catch (error) {
      log(error.message, 'err');
    }
  });

  document.querySelector('#download-btn').addEventListener('click', async () => {
    const form = document.querySelector('#generate-form');
    const data = new FormData(form);
    const params = requestId
      ? { requestId, period: data.get('period') }
      : { employeeId: data.get('employeeId'), period: data.get('period') };

    try {
      const size = await downloadPayrollPdf(params);
      log(`PDF baixado com ${size} bytes.`, 'ok');
    } catch (error) {
      log(error.message, 'err');
    }
  });
}

render();
log('Aplicação inicializada. Faça login para iniciar o fluxo.', 'info');
log(`Sessão inicial: ${JSON.stringify(getSessionState())}`, 'info');
