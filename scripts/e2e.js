#!/usr/bin/env node
/**
 * E2E de fumaça do MBV Marketplace — cobre ADMIN e CLIENTE de ponta a ponta:
 * health, login, CRUD de produto, carrinho, checkout card/pix/mbv, cupons.
 *
 * Uso:
 *   npm run e2e                     # sobe um servidor próprio (porta livre, banco temporário) e testa
 *   BASE_URL=http://localhost:4000 npm run e2e   # testa um servidor já em execução
 *
 * Sai com código 0 se tudo passar; 1 se qualquer passo falhar.
 */
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const EXTERNAL = !!process.env.BASE_URL;
const PORT = Number(process.env.E2E_PORT || 3100);
const BASE = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;

let serverProc = null;
const results = [];

function ok(name, extra = '') { results.push({ pass: true, name }); console.log(`PASS  ${name}${extra ? '  ' + extra : ''}`); }
function fail(name, extra = '') { results.push({ pass: false, name }); console.error(`FAIL  ${name}${extra ? '  ' + extra : ''}`); }
function check(cond, name, extra = '') { (cond ? ok : fail)(name, extra); return !!cond; }

async function api(method, route, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await res.json(); } catch (_) {}
  return { status: res.status, data };
}

async function waitHealth(timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(BASE + '/api/health');
      if (r.ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

function startServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mbv-e2e-'));
  // Node < 23 precisa da flag p/ node:sqlite (Node 24+ é nativo; better-sqlite3 dispensa ambos)
  const needFlag = Number(process.versions.node.split('.')[0]) < 23;
  const args = [...(needFlag ? ['--experimental-sqlite'] : []), path.join(__dirname, '..', 'server', 'index.js')];
  serverProc = spawn(process.execPath, args, {
    env: { ...process.env, PORT: String(PORT), MBV_DATA_DIR: dataDir },
    stdio: 'ignore'
  });
}

const SHIP = { name: 'Cliente E2E', cep: '01001000', address: 'Rua E2E, 42', city: 'São Paulo', state: 'SP', phone: '11999990000' };
const CARD = { number: '4111111111111111', cvv: '123', expiry: '12/30', name: 'CLIENTE E2E' };

async function run() {
  // 1. Health
  const h = await api('GET', '/health');
  check(h.status === 200 && h.data.db === 'up', 'GET /health', `db=${h.data && h.data.db}`);

  // 2-4. Logins
  const la = await api('POST', '/auth/login', { body: { email: 'admin@mbv.com', password: 'admin123' } });
  if (!check(la.status === 200 && la.data.user.role === 'admin', 'login admin')) return;
  const admin = la.data.token;
  const lc = await api('POST', '/auth/login', { body: { email: 'cliente@mbv.com', password: 'cliente123' } });
  if (!check(lc.status === 200, 'login cliente')) return;
  const cliente = lc.data.token;
  const lw = await api('POST', '/auth/login', { body: { email: 'cliente@mbv.com', password: 'errada' } });
  check(lw.status === 401, 'login senha errada -> 401');

  // 5. Catálogo
  const prods = await api('GET', '/products');
  check(prods.status === 200 && prods.data.items.length > 0, 'GET /products', `produtos=${prods.data.items.length}`);

  // 6-10. CRUD admin + autorização
  const body = { name: 'Produto E2E', price: 99.9, stock: 5, unit: 'un' };
  const created = await api('POST', '/products', { token: admin, body });
  check(created.status === 201, 'POST /products (admin cria)', `id=${created.data.product && created.data.product.id}`);
  const pid = created.data.product.id;
  const upd = await api('PUT', '/products/' + pid, { token: admin, body: { ...body, price: 89.9 } });
  check(upd.status === 200 && upd.data.product.price === 89.9, 'PUT /products (admin edita)');
  check((await api('POST', '/products', { body })).status === 401, 'POST /products sem token -> 401');
  check((await api('POST', '/products', { token: cliente, body })).status === 403, 'POST /products como cliente -> 403');
  check((await api('DELETE', '/products/' + pid, { token: admin })).status === 200, 'DELETE /products (admin remove)');

  // 11-12. Carrinho (+ regressão do 500)
  const add = await api('POST', '/cart', { token: cliente, body: { product_id: 1, quantity: 2 } });
  check(add.status === 201, 'POST /cart (adicionar)');
  check((await api('PUT', '/cart/1', { token: cliente, body: {} })).status === 400, 'PUT /cart sem quantity -> 400 (não 500)');
  const cart = await api('GET', '/cart', { token: cliente });
  check(cart.status === 200 && cart.data.items.length === 1, 'GET /cart', `total=R$${cart.data.totals && cart.data.totals.total}`);

  // 13. Checkout CARD
  const oc = await api('POST', '/orders', { token: cliente, body: { payment_method: 'card', shipping: SHIP, card: CARD } });
  check(oc.status === 201 && oc.data.order.payment_status === 'paid', 'checkout CARD -> paid', oc.data.order && oc.data.order.code);

  // 14-15. Checkout PIX + confirmação (demo)
  await api('POST', '/cart', { token: cliente, body: { product_id: 2, quantity: 1 } });
  const op = await api('POST', '/orders', { token: cliente, body: { payment_method: 'pix', shipping: SHIP } });
  check(op.status === 201 && op.data.order.payment_status === 'pending' && !!op.data.order.pix_code, 'checkout PIX -> pending + pix_code');
  const conf = await api('POST', `/orders/${op.data.order.id}/confirm-pix`, { token: cliente });
  check(conf.status === 200 && conf.data.order.payment_status === 'paid', 'confirm-pix (demo) -> paid');

  // 16. Checkout MBV/NTR (saldo interno)
  const w0 = (await api('GET', '/wallet', { token: cliente })).data.balance;
  await api('POST', '/cart', { token: cliente, body: { product_id: 3, quantity: 1 } });
  const om = await api('POST', '/orders', { token: cliente, body: { payment_method: 'mbv', shipping: SHIP } });
  const w1 = (await api('GET', '/wallet', { token: cliente })).data.balance;
  check(om.status === 201 && om.data.order.payment_status === 'paid' && w1 < w0 + om.data.order.cashback_mbv,
    'checkout MBV/NTR -> paid (saldo debitado)', `NTR ${w0} -> ${w1}`);

  // 17-18. Cupons (admin) + autorização
  const rep = await api('GET', '/coupons/report', { token: admin });
  check(rep.status === 200, 'GET /coupons/report (admin)', `cupons=${rep.data.report && rep.data.report.length}`);
  check((await api('GET', '/coupons/report', { token: cliente })).status === 403, 'coupons/report como cliente -> 403');

  // 19. Pedidos do cliente
  const ords = await api('GET', '/orders', { token: cliente });
  check(ords.status === 200 && ords.data.orders.length >= 3, 'GET /orders (cliente)', `pedidos=${ords.data.orders.length}`);
}

(async () => {
  try {
    if (!EXTERNAL) {
      console.log(`Subindo servidor e2e em ${BASE} (banco temporário)…`);
      startServer();
    }
    if (!(await waitHealth())) { console.error('Servidor não respondeu ao /api/health a tempo.'); process.exitCode = 1; return; }
    await run();
  } catch (e) {
    fail('exceção não tratada', e.message);
  } finally {
    if (serverProc) serverProc.kill('SIGTERM');
    const pass = results.filter(r => r.pass).length;
    const failed = results.length - pass;
    console.log(`\n== RESULTADO E2E: ${pass} pass / ${failed} fail ==`);
    process.exitCode = failed === 0 ? 0 : 1;
  }
})();
