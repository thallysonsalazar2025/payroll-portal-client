import { login, generatePayroll, getPayrollStatus, getPayrollEvents, downloadPayrollPdf } from './api.js';

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
  <article class="card"><h2>1. Login</h2><form id="login-form"><input name="username" value="admin" required><input name="password" value="admin" type="password" required><button>Autenticar</button></form></article>
  <article class="card"><h2>2. Geração</h2><form id="generate-form"><input name="employeeId" value="123" required><input name="companyId" value="10" required><input name="period" value="2026-08" required><button>Gerar folha</button></form><small id="request-id"></small></article>
  <article class="card"><h2>3. Consulta</h2><button id="status-btn">Consultar status</button><button id="events-btn">Consultar eventos</button><pre id="status-output"></pre></article>
  <article class="card"><h2>4. PDF</h2><button id="download-btn">Baixar PDF</button></article>
</section>
<section class="card"><h2>Logs E2E</h2><div id="log-panel"></div></section>`;

const payrollParams = () => {
  const data = new FormData(document.querySelector('#generate-form'));
  return { employeeId: data.get('employeeId'), companyId: data.get('companyId'), period: data.get('period') };
};

document.querySelector('#login-form').addEventListener('submit', async e => { e.preventDefault(); const d = new FormData(e.target); try { await login(d.get('username'), d.get('password')); log('Autenticação realizada.', 'ok'); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#generate-form').addEventListener('submit', async e => { e.preventDefault(); try { const params = payrollParams(); const result = await generatePayroll(params); requestId = result.requestId || result.id || ''; generatedPeriod = params.period; document.querySelector('#request-id').textContent = `requestId: ${requestId || 'não retornado'}`; log('Geração enviada.', 'ok'); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#status-btn').addEventListener('click', async () => { try { const p = payrollParams(); const status = await getPayrollStatus(requestId ? { requestId } : { employeeId: p.employeeId, period: p.period }); document.querySelector('#status-output').textContent = JSON.stringify(status, null, 2); log('Status consultado.', 'ok'); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#events-btn').addEventListener('click', async () => { if (!requestId) return log('Gere uma folha antes de consultar eventos.', 'err'); try { const events = await getPayrollEvents({ requestId }); document.querySelector('#status-output').textContent = JSON.stringify(events, null, 2); log('Eventos consultados.', 'ok'); } catch (err) { log(err.message, 'err'); } });
document.querySelector('#download-btn').addEventListener('click', async () => { try { const p = payrollParams(); const downloadParams = requestId ? { requestId } : { employeeId: p.employeeId, period: p.period }; const size = await downloadPayrollPdf(downloadParams); log(`PDF baixado com ${size} bytes${generatedPeriod ? ` para ${generatedPeriod}` : ''}.`, 'ok'); } catch (err) { log(err.message, 'err'); } });

log('Portal inicializado.', 'info');
