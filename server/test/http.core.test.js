// Testes de integração HTTP (modo demonstração): auth, CRUD de produto,
// carrinho, checkout card/pix/mbv, cancelamento com estorno e cupons.
const test = require('node:test');
const assert = require('node:assert');
const { startApp, SHIP } = require('./helpers');

let ctx, admin, cliente;

test.before(async () => {
  ctx = await startApp(); // DEMO_MODE=true (padrão)
  admin = await ctx.login('admin@mbv.com', 'admin123');
  cliente = await ctx.login('cliente@mbv.com', 'cliente123');
});
test.after(async () => { await ctx.close(); });

test('health: banco de pé e modo demo', async () => {
  const r = await ctx.api('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.db, 'up');
  assert.equal(r.data.demo, true);
});

test('auth: senha errada -> 401', async () => {
  const r = await ctx.api('POST', '/auth/login', { body: { email: 'cliente@mbv.com', password: 'errada' } });
  assert.equal(r.status, 401);
});

test('catálogo: lista produtos do seed', async () => {
  const r = await ctx.api('GET', '/products');
  assert.equal(r.status, 200);
  assert.ok(r.data.items.length > 0, 'a página deve trazer itens');
  assert.ok(r.data.total >= 19, `esperava total>=19 produtos no seed, veio ${r.data.total}`);
});

test('produtos: CRUD exige admin (401 sem token, 403 cliente)', async () => {
  const body = { name: 'Produto QA', price: 99.9, stock: 5, unit: 'un' };
  assert.equal((await ctx.api('POST', '/products', { body })).status, 401);
  assert.equal((await ctx.api('POST', '/products', { token: cliente, body })).status, 403);

  const created = await ctx.api('POST', '/products', { token: admin, body });
  assert.equal(created.status, 201);
  const id = created.data.product.id;

  const upd = await ctx.api('PUT', '/products/' + id, { token: admin, body: { ...body, price: 89.9 } });
  assert.equal(upd.status, 200);
  assert.equal(upd.data.product.price, 89.9);

  assert.equal((await ctx.api('DELETE', '/products/' + id, { token: admin })).status, 200);
});

test('carrinho: PUT sem quantity -> 400 (regressão do 500)', async () => {
  const add = await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 1, quantity: 2 } });
  assert.equal(add.status, 201);
  const r = await ctx.api('PUT', '/cart/1', { token: cliente, body: {} });
  assert.equal(r.status, 400); // antes: 500 (parseInt(undefined) = NaN)
  const ok = await ctx.api('PUT', '/cart/1', { token: cliente, body: { quantity: 3 } });
  assert.equal(ok.status, 200);
  await ctx.api('DELETE', '/cart', { token: cliente });
});

test('checkout CARD: paga, baixa estoque e credita cashback', async () => {
  const before = (await ctx.api('GET', '/products/2')).data.product.stock;
  await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 2, quantity: 2 } });
  const r = await ctx.api('POST', '/orders', {
    token: cliente,
    body: { payment_method: 'card', shipping: SHIP, card: { number: '4111111111111111', cvv: '123', expiry: '12/30', name: 'CLIENTE TESTE' } }
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.payment_status, 'paid');
  assert.ok(r.data.order.code.startsWith('MBV-'));
  assert.ok(r.data.order.ship_prazo, 'pedido deve gravar o prazo estimado por região do CEP');
  const after = (await ctx.api('GET', '/products/2')).data.product.stock;
  assert.equal(after, before - 2, 'estoque deve baixar exatamente a quantidade comprada');
});

test('checkout PIX: pending com pix_code; confirm-pix funciona no demo', async () => {
  await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 3, quantity: 1 } });
  const r = await ctx.api('POST', '/orders', { token: cliente, body: { payment_method: 'pix', shipping: SHIP } });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.payment_status, 'pending');
  assert.ok(r.data.order.pix_code, 'pedido pix simulado deve ter pix_code');

  const conf = await ctx.api('POST', `/orders/${r.data.order.id}/confirm-pix`, { token: cliente });
  assert.equal(conf.status, 200);
  assert.equal(conf.data.order.payment_status, 'paid');
});

test('confirm-pix: recusa pedido que não é pix', async () => {
  await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 4, quantity: 1 } });
  const card = await ctx.api('POST', '/orders', {
    token: cliente,
    body: { payment_method: 'card', shipping: SHIP, card: { number: '4111111111111111', cvv: '123', expiry: '12/30', name: 'CLIENTE TESTE' } }
  });
  const r = await ctx.api('POST', `/orders/${card.data.order.id}/confirm-pix`, { token: cliente });
  assert.equal(r.status, 400);
});

test('checkout MBV: debita saldo interno e credita cashback', async () => {
  const w0 = (await ctx.api('GET', '/wallet', { token: cliente })).data.balance;
  await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 5, quantity: 1 } });
  const r = await ctx.api('POST', '/orders', { token: cliente, body: { payment_method: 'mbv', shipping: SHIP } });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.payment_status, 'paid');
  const mbv = r.data.order.mbv_amount;
  assert.ok(mbv > 0);
  const w1 = (await ctx.api('GET', '/wallet', { token: cliente })).data.balance;
  // saldo final = inicial - pagamento + cashback (ambos em NTR, arredondados a 2 casas)
  const esperado = Math.round((w0 - mbv + r.data.order.cashback_mbv) * 100) / 100;
  assert.equal(w1, esperado);
});

test('cancelamento (admin): repõe estoque e estorna NTR', async () => {
  const stock0 = (await ctx.api('GET', '/products/6')).data.product.stock;
  await ctx.api('POST', '/cart', { token: cliente, body: { product_id: 6, quantity: 2 } });
  const ord = await ctx.api('POST', '/orders', { token: cliente, body: { payment_method: 'mbv', shipping: SHIP } });
  assert.equal(ord.status, 201);
  const wPago = (await ctx.api('GET', '/wallet', { token: cliente })).data.balance;

  const cancel = await ctx.api('PATCH', `/orders/${ord.data.order.id}/status`, { token: admin, body: { status: 'cancelled' } });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.order.status, 'cancelled');

  const stock1 = (await ctx.api('GET', '/products/6')).data.product.stock;
  assert.equal(stock1, stock0, 'estoque deve voltar ao valor original');
  const wFinal = (await ctx.api('GET', '/wallet', { token: cliente })).data.balance;
  const esperado = Math.round((wPago + ord.data.order.mbv_amount) * 100) / 100;
  assert.equal(wFinal, esperado, 'estorno deve devolver o NTR pago');
});

test('cupons: relatório é só do admin', async () => {
  assert.equal((await ctx.api('GET', '/coupons/report', { token: admin })).status, 200);
  assert.equal((await ctx.api('GET', '/coupons/report', { token: cliente })).status, 403);
});

test('pedidos: cliente lista os próprios pedidos', async () => {
  const r = await ctx.api('GET', '/orders', { token: cliente });
  assert.equal(r.status, 200);
  assert.ok(r.data.orders.length >= 4);
});
