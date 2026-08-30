import {
  login,
  generatePayroll,
  getPayrollStatus,
  getPayrollEvents,
  downloadPayrollPdf,
  preValidatePayrollClosing,
  closePayroll,
  getAuthenticatedCompanyId
} from './api.js';
import { normalizePayrollStatus, pollPayrollStatus } from './polling.js';

const app = document.querySelector('#app');
let requestId = '';
let generatedPeriod = '';

function log(message, type = 'info') {
  const row = document.createElement('p');
  row.className = `log-${type}`;
  row.textContent = `${new Date().toISOString()} - ${message}`;
  document.querySelector('#log-panel').prepend(row);
}

app.innerHTML = `
<section class="grid">
  <article class="card"><h2>1. Login</h2><form id="login-form"><input name="username" value="admin" required><input name="password" value="admin" type="password" required><button>Autenticar</button></form><small id="company-context">Empresa: autentique-se para carregar o contexto.</small></article>
  <article class="card"><h2>2. Geração</h2><form id="generate-form"><input name="employeeId" value="123" required><input name="period" value="2026-08" required><button>Gerar folha</button></form><small id="request-id"></small></article>
  <article class="card"><h2>3. Consulta</h2><button id="status-btn">Consultar status</button><button id="events-btn">Consultar eventos</button><pre id="status-output"></pre></article>
  <article class="card"><h2>4. PDF</h2><button id="download-btn">Baixar PDF</button></article>
  <article class="card">
    <h2>5. Fechamento</h2>
    <form id="closing-form">
      <input name="competence" value="2026-08" required aria-label="Competência">
      <button id="validate-closing-btn" type="button">Validar folha</button>
      <button id="close-payroll-btn" type="button" disabled>Fechar folha</button>
    </form>
    <pre id="closing-output" aria-live="polite"></pre>
  </article>
</section>
<section class="card" aria-labelledby="privacy-title">
  <h2 id="privacy-title">Privacidade e transparência</h2>
  <p>Consulte como o portal apresenta finalidade, direitos e limites do tratamento. A leitura deste aviso não é tratada como consentimento.</p>
  <a href="privacy.html">Abrir aviso de transparência — versão 2026-08-30.v1</a>
</section>
<section class="card"><h2>Logs E2E</h2><div id="log-panel"></div></section>`;

function requireAuthenticatedCompanyId() {
  const companyId = getAuthenticatedCompanyId();
  if (!companyId) throw new Error('Autentique-se com uma identidade que contenha companyId antes de executar esta operação.');
  return companyId;
}

const payrollParams = () => {
  const data = new FormData(document.querySelector('#generate-form'));
  return { employeeId: data.get('employeeId'), companyId: requireAuthenticatedCompanyId(), period: data.get('period') };
};

const closingParams = () => {
  const data = new FormData(document.querySelector('#closing-form'));
  return { companyId: requireAuthenticatedCompanyId(), competence: data.get('competence') };
};

const statusOutput = document.querySelector('#status-output');
const closingOutput = document.querySelector('#closing-output');
const closePayrollButton = document.querySelector('#close-payroll-btn');
const validateClosingButton = document.querySelector('#validate-closing-btn');
const companyContext = document.querySelector('#company-context');

function setClosingBusy(busy) {
  validateClosingButton.disabled = busy;
  if (busy) closePayrollButton.disabled = true;
}

async function trackGeneratedPayroll(params) {
  const statusParams = requestId ? { requestId } : { employeeId: params.employeeId, period: params.period };
  try {
    const result = await pollPayrollStatus(getPayrollStatus, statusParams);
    statusOutput.textContent = JSON.stringify(result.payload, null, 2);
    const status = normalizePayrollStatus(result.payload) || 'DESCONHECIDO';
    if (result.terminal) {
      const type = ['FAILED', 'ERROR', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(status) ? 'err' : 'ok';
      log(`Processamento finalizado em ${result.attempts} consulta(s): ${status}.`, type);
    } else {
      log(`Processamento ainda não terminou após ${result.attempts} consultas. Use Consultar status para continuar.`, 'info');
    }
  } catch (err) {
    log(`Acompanhamento automático interrompido: ${err.message}`, 'err');
  }
}

document.querySelector('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const d = new FormData(e.target);
  try {
    await login(d.get('username'), d.get('password'));
    const companyId = requireAuthenticatedCompanyId();
    companyContext.textContent = `Empresa autenticada: ${companyId}`;
    log('Autenticação realizada e contexto da empresa derivado do token.', 'ok');
  } catch (err) {
    companyContext.textContent = 'Empresa: contexto autenticado indisponível.';
    log(err.message, 'err');
  }
});
document.querySelector('#generate-form').addEventListener('submit', async e => { e.preventDefault(); try { const params = payrollParams(); const result = await generatePayroll(params); requestId = result.requestId || result.id || ''; generatedPeriod = params.period; document.querySelector('#request-id').textContent = `requestId: ${requestId || 'não retornado'}`; log('Geração enviada. Acompanhando processamento automaticamente.', 'ok'); void trackGeneratedPayroll(params); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#status-btn').addEventListener('click', async () => { try { const p = payrollParams(); const status = await getPayrollStatus(requestId ? { requestId } : { employeeId: p.employeeId, period: p.period }); statusOutput.textContent = JSON.stringify(status, null, 2); log('Status consultado.', 'ok'); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#events-btn').addEventListener('click', async () => { if (!requestId) return log('Gere uma folha antes de consultar eventos.', 'err'); try { const events = await getPayrollEvents({ requestId }); statusOutput.textContent = JSON.stringify(events, null, 2); log('Eventos consultados.', 'ok'); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#download-btn').addEventListener('click', async () => { try { const p = payrollParams(); const downloadParams = requestId ? { requestId } : { employeeId: p.employeeId, period: p.period }; const size = await downloadPayrollPdf(downloadParams); log(`PDF baixado com ${size} bytes${generatedPeriod ? ` para ${generatedPeriod}` : ''}.`, 'ok'); } catch (err) { log(err.message, 'err'); } });

validateClosingButton.addEventListener('click', async () => {
  setClosingBusy(true);
  closingOutput.textContent = 'Validando folha...';
  try {
    const result = await preValidatePayrollClosing(closingParams());
    closingOutput.textContent = JSON.stringify(result, null, 2);
    const blockers = result.blockers || result.blockingIssues || [];
    closePayrollButton.disabled = blockers.length > 0 || result.valid === false;
    log(closePayrollButton.disabled ? 'Pré-validação encontrou bloqueios.' : 'Folha pronta para fechamento.', closePayrollButton.disabled ? 'err' : 'ok');
  } catch (err) {
    closingOutput.textContent = err.message;
    log(err.message, 'err');
  } finally {
    validateClosingButton.disabled = false;
  }
});

closePayrollButton.addEventListener('click', async () => {
  if (!window.confirm('Confirma o fechamento desta competência?')) return;
  setClosingBusy(true);
  closingOutput.textContent = 'Fechando folha...';
  try {
    const result = await closePayroll(closingParams());
    closingOutput.textContent = JSON.stringify(result, null, 2);
    closePayrollButton.disabled = true;
    log('Folha fechada com sucesso.', 'ok');
  } catch (err) {
    closingOutput.textContent = err.message;
    log(err.message, 'err');
  } finally {
    validateClosingButton.disabled = false;
  }
});

log('Portal inicializado.', 'info');
