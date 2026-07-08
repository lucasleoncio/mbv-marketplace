const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getCartItems, computeTotals, round2 } = require('../lib/pricing');
const wallet = require('../lib/wallet');
const chain = require('../lib/chain');
const email = require('../lib/email');
const mp = require('../lib/mercadopago');
const { TOKEN, CHAIN, MP, DEMO_MODE } = require('../config');

const router = express.Router();

function orderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  return order;
}

// Gera um código Pix "copia e cola" SIMULADO (substitua por integração real: PSP/Banco/Mercado Pago).
function fakePixCode(orderCode, amount) {
  const payload = `MBV*${orderCode}*${amount.toFixed(2)}`;
  return `00020126580014BR.GOV.BCB.PIX0136mbv-${orderCode.toLowerCase()}5204000053039865802BR5909MBV STORE6009SAO PAULO62070503${payload}6304ABCD`;
}

// Credita cashback em MBV Coin quando o pagamento é confirmado.
function payCashback(order) {
  if (order.cashback_mbv > 0) {
    wallet.move(order.user_id, order.cashback_mbv, 'cashback',
      `Cashback do pedido ${order.code}`, order.code);
  }
}

// POST /api/orders  -> checkout
router.post('/', requireAuth, async (req, res) => {
  const items = getCartItems(req.user.id);
  if (!items.length) return res.status(400).json({ error: 'Seu carrinho está vazio.' });

  // Estoque
  for (const it of items) {
    if (!it.active) return res.status(400).json({ error: `O produto "${it.name}" não está mais disponível.` });
    if (it.quantity > it.stock) return res.status(400).json({ error: `Estoque insuficiente para "${it.name}".` });
  }

  const method = ['card', 'pix', 'mbv'].includes(req.body.payment_method) ? req.body.payment_method : null;
  if (!method) return res.status(400).json({ error: 'Selecione uma forma de pagamento.' });

  const ship = req.body.shipping || {};
  const cpf = String(req.body.cpf || ship.cpf || '').trim();
  for (const f of ['name', 'cep', 'address', 'city', 'state']) {
    if (!String(ship[f] || '').trim()) return res.status(400).json({ error: 'Preencha todos os campos de entrega.' });
  }

  const totals = computeTotals(items, req.body.coupon_code, method, ship.cep, cpf);
  if (totals.couponError) return res.status(400).json({ error: totals.couponError });

  // Validação por forma de pagamento
  if (method === 'card' && !MP.enabled) {
    const c = req.body.card || {};
    const number = String(c.number || '').replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(number)) return res.status(400).json({ error: 'Número de cartão inválido.' });
    if (!/^\d{3,4}$/.test(String(c.cvv || ''))) return res.status(400).json({ error: 'CVV inválido.' });
    if (!/^\d{2}\/\d{2}$/.test(String(c.expiry || ''))) return res.status(400).json({ error: 'Validade inválida (MM/AA).' });
    if (!String(c.name || '').trim()) return res.status(400).json({ error: 'Informe o nome impresso no cartão.' });
    // NÃO armazenamos dados do cartão. Aqui entraria a chamada ao gateway (Stripe/Mercado Pago).
  }
  // Modo on-chain: o pagamento em NTR é feito pela carteira do cliente e confirmado depois.
  const onchain = method === 'mbv' && CHAIN.onchainEnabled;
  // Mercado Pago: cartão/Pix reais via Checkout Pro (confirmados por webhook).
  const mpPay = (method === 'card' || method === 'pix') && MP.enabled;

  // GO-LIVE: fora do modo demonstração, não aceitar pagamentos simulados.
  if (!DEMO_MODE) {
    if ((method === 'card' || method === 'pix') && !MP.enabled)
      return res.status(503).json({ error: 'Pagamento por Cartão/Pix temporariamente indisponível. Tente novamente em instantes.' });
    if (method === 'mbv' && !onchain)
      return res.status(503).json({ error: 'Pagamento em NTR on-chain temporariamente indisponível.' });
  }

  // Modo simulado (sem on-chain configurado): debita o saldo interno de demonstração.
  if (method === 'mbv' && !onchain) {
    const u = db.prepare('SELECT mbv_balance FROM users WHERE id = ?').get(req.user.id);
    if (u.mbv_balance < totals.mbvAmount)
      return res.status(400).json({ error: `Saldo NTR insuficiente. Necessário ${totals.mbvAmount} NTR, você tem ${u.mbv_balance} NTR.` });
  }

  const paymentStatus = (method === 'pix' || onchain || mpPay) ? 'pending' : 'paid';

  const run = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO orders (user_id, code, subtotal, discount, shipping, total, coupon_code, payment_method,
        payment_status, status, mbv_amount, cashback_mbv, ship_name, ship_cep, ship_address, ship_city, ship_state, ship_phone)
      VALUES (@user_id,@code,@subtotal,@discount,@shipping,@total,@coupon_code,@payment_method,
        @payment_status,'processing',@mbv_amount,@cashback_mbv,@n,@cep,@addr,@city,@state,@phone)
    `).run({
      user_id: req.user.id, code: 'TMP', subtotal: totals.subtotal, discount: totals.discount,
      shipping: totals.shipping, total: totals.total, coupon_code: totals.coupon ? totals.coupon.code : null,
      payment_method: method, payment_status: paymentStatus,
      mbv_amount: method === 'mbv' ? totals.mbvAmount : 0, cashback_mbv: onchain ? 0 : totals.cashbackMbv,
      n: ship.name, cep: ship.cep, addr: ship.address, city: ship.city, state: ship.state, phone: ship.phone || ''
    });
    const orderId = info.lastInsertRowid;
    const code = 'MBV-' + String(100000 + orderId);
    let pixCode = null;
    if (method === 'pix' && !MP.enabled) pixCode = fakePixCode(code, totals.total);
    db.prepare('UPDATE orders SET code = ?, pix_code = ?, chain_id = ?, cpf_cnpj = ? WHERE id = ?')
      .run(code, pixCode, onchain ? CHAIN.chainId : null, cpf.replace(/\D/g, '') || null, orderId);

    // Itens + baixa de estoque ATÔMICA: o WHERE stock >= ? impede oversell
    // (a checagem no topo do handler é só UX; esta é a garantia real, segura também sob driver async/Postgres).
    const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, price, quantity, unit, image) VALUES (?,?,?,?,?,?,?)');
    const decStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    for (const it of items) {
      insItem.run(orderId, it.product_id, it.name, it.price, it.quantity, it.unit, it.image);
      const dec = decStock.run(it.quantity, it.product_id, it.quantity);
      if (dec.changes !== 1) {
        const err = new Error(`Estoque insuficiente para "${it.name}". Ajuste a quantidade no carrinho.`);
        err.code = 'OUT_OF_STOCK';
        throw err; // aborta a transação inteira (rollback)
      }
    }

    // Pagamento em NTR no modo simulado debita o saldo interno.
    // No modo on-chain, o pagamento real é confirmado depois (verify-onchain).
    if (method === 'mbv' && !onchain) {
      wallet.move(req.user.id, -totals.mbvAmount, 'purchase', `Pagamento do pedido ${code}`, code);
    }
    // Cashback é creditado quando o pagamento está confirmado (card/mbv agora; pix na confirmação)
    const orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (paymentStatus === 'paid') payCashback(orderRow);

    // Esvazia carrinho
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    return orderId;
  });

  try {
    const orderId = run();
    if (mpPay) {
      const ord = orderWithItems(orderId);
      const pref = await mp.createPreference(ord, req.user, method);
      return res.status(201).json({ order: ord, redirect: pref.redirect });
    }
    if (paymentStatus === 'paid') email.sendOrderConfirmation(req.user, orderWithItems(orderId)).catch(() => {});
    res.status(201).json({ order: orderWithItems(orderId), token: TOKEN, onchain });
  } catch (e) {
    if (e.code === 'INSUFFICIENT_FUNDS') return res.status(400).json({ error: 'Saldo de NTR insuficiente.' });
    if (e.code === 'OUT_OF_STOCK') return res.status(400).json({ error: e.message });
    console.error(e);
    res.status(500).json({ error: 'Não foi possível concluir o pedido.' });
  }
});

// POST /api/orders/:id/confirm-pix  -> simula confirmação do Pix (SÓ em modo demonstração)
router.post('/:id/confirm-pix', requireAuth, (req, res) => {
  // GO-LIVE: fora do demo (ou com Mercado Pago ativo), a confirmação real chega pelo webhook.
  // Sem este gate, qualquer cliente autenticado marcaria o próprio pedido como pago.
  if (!DEMO_MODE || MP.enabled)
    return res.status(409).json({ error: 'A confirmação do Pix é automática após o pagamento — aguarde alguns instantes.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (order.payment_method !== 'pix') return res.status(400).json({ error: 'Este pedido não é um pagamento Pix.' });
  if (order.payment_status === 'paid') return res.json({ order: orderWithItems(order.id) });
  db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(order.id);
  payCashback(order);
  email.sendOrderConfirmation(req.user, orderWithItems(order.id)).catch(() => {});
  res.json({ order: orderWithItems(order.id) });
});

// POST /api/orders/:id/verify-onchain  -> confirma na blockchain o pagamento em NTR
router.post('/:id/verify-onchain', requireAuth, async (req, res) => {
  if (!CHAIN.onchainEnabled) return res.status(400).json({ error: 'Pagamento on-chain não está configurado.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (order.payment_method !== 'mbv') return res.status(400).json({ error: 'Este pedido não é pago em NTR.' });
  if (order.payment_status === 'paid') return res.json({ order: orderWithItems(order.id) });

  const txHash = String(req.body.txHash || '').trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return res.status(400).json({ error: 'Hash de transação inválido.' });

  const reused = db.prepare('SELECT id FROM orders WHERE tx_hash = ? AND id != ?').get(txHash, order.id);
  if (reused) return res.status(400).json({ error: 'Esta transação já foi usada em outro pedido.' });

  try {
    const expected = chain.toBaseUnits(order.mbv_amount);
    const result = await chain.verifyPayment(txHash, expected);
    if (!result.ok) return res.status(400).json({ error: result.reason });
    // Atualização condicional (idempotente): só marca pago se ainda não estiver.
    const upd = db.prepare("UPDATE orders SET payment_status = 'paid', tx_hash = ?, chain_id = ? WHERE id = ? AND payment_status != 'paid'")
      .run(txHash, CHAIN.chainId, order.id);
    if (upd.changes !== 1) return res.json({ order: orderWithItems(order.id) }); // já confirmado em paralelo
    email.sendOrderConfirmation(req.user, orderWithItems(order.id)).catch(() => {});
    res.json({ order: orderWithItems(order.id), verified: { amount: result.amount, from: result.from } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Falha ao verificar o pagamento on-chain.' });
  }
});

// GET /api/orders  -> meus pedidos (admin com ?all=1 vê todos)
router.get('/', requireAuth, (req, res) => {
  let rows;
  if (req.query.all === '1' && req.user.role === 'admin') {
    rows = db.prepare(`SELECT o.*, u.name AS customer_name, u.email AS customer_email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`).all();
  } else {
    rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  }
  for (const o of rows) o.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
  res.json({ orders: rows });
});

// GET /api/orders/:id
router.get('/:id', requireAuth, (req, res) => {
  const order = orderWithItems(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Acesso negado.' });
  res.json({ order });
});

// PATCH /api/orders/:id/status  (admin) -> atualiza status logístico
router.patch('/:id/status', requireAdmin, (req, res) => {
  const allowed = ['processing', 'shipped', 'delivered', 'cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Status inválido.' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });

  // Cancelamento: estorna estoque e devolve MBV (se pago em MBV)
  if (req.body.status === 'cancelled' && order.status !== 'cancelled') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const tx = db.transaction(() => {
      for (const it of items) if (it.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(it.quantity, it.product_id);
      if (order.payment_method === 'mbv' && order.payment_status === 'paid' && order.mbv_amount > 0) {
        wallet.move(order.user_id, order.mbv_amount, 'refund', `Estorno do pedido ${order.code}`, order.code);
      }
      db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
    });
    tx();
  } else {
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, order.id);
    // E-mails de ciclo de vida: avisa quando o pedido é enviado/entregue.
    if ((req.body.status === 'shipped' || req.body.status === 'delivered') && order.status !== req.body.status) {
      const u = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
      const full = orderWithItems(order.id);
      if (req.body.status === 'shipped') email.sendOrderShipped(u, full).catch(() => {});
      else email.sendOrderDelivered(u, full).catch(() => {});
    }
  }
  res.json({ order: orderWithItems(order.id) });
});

module.exports = router;
