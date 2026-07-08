// Gates de GO-LIVE (MBV_DEMO_MODE=false): pagamentos simulados devem ser
// BLOQUEADOS quando o modo demonstração está desligado e não há chaves reais.
// Estes testes protegem as correções ARQ-1 (confirm-pix) e ARQ-2 (topup).
const test = require('node:test');
const assert = require('node:assert');
const { startApp, SHIP } = require('./helpers');

let ctx, cliente;

test.before(async () => {
  ctx = await startApp({
    MBV_DEMO_MODE: 'false',
    JWT_SECRET: 'segredo-forte-somente-para-testes-0123456789abcdef' // preflight exige no go-live
  });
  cliente = await ctx.login('cliente@mbv.com', 'cliente123');
});
test.after(async () => { await ctx.close(); });

test('go-live: health reporta demo=false', async () => {
  const r = await ctx.api('GET', '/health');
  assert.equal(r.data.demo, false);
});

test('go-live: checkout card/pix simulados -> 503 (sem Mercado Pago)', async () => {
  await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 1, quantity: 1 } });
  for (const method of ['card', 'pix']) {
    const r = await ctx.api('POST', '/orders', {
      token: cliente,
      body: { payment_method: method, shipping: SHIP, card: { number: '4111111111111111', cvv: '123', expiry: '12/30', name: 'X' } }
    });
    assert.equal(r.status, 503, `${method} simulado deveria ser bloqueado no go-live`);
  }
});

test('go-live: checkout mbv simulado -> 503 (sem on-chain configurado)', async () => {
  const r = await ctx.api('POST', '/orders', { token: cliente, body: { payment_method: 'mbv', shipping: SHIP } });
  assert.equal(r.status, 503);
});

test('go-live: topup simulado -> 503 (ARQ-2: não credita NTR grátis)', async () => {
  const r = await ctx.api('POST', '/wallet/topup', { token: cliente, body: { amount_brl: 100 } });
  assert.equal(r.status, 503);
});

test('go-live: confirm-pix -> 409 (ARQ-1: cliente não confirma o próprio pagamento)', async () => {
  const r = await ctx.api('POST', '/orders/999999/confirm-pix', { token: cliente });
  assert.equal(r.status, 409);
});
