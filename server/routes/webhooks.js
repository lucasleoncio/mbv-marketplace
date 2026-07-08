// Webhook do Mercado Pago: recebe a notificação, confirma o status direto na API
// (fonte da verdade) e marca o pedido como pago.
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const mp = require('../lib/mercadopago');
const wallet = require('../lib/wallet');
const email = require('../lib/email');
const { MP } = require('../config');

const router = express.Router();

// Valida a assinatura do webhook do Mercado Pago (x-signature) quando há secret.
// Sem secret (modo demonstração), não valida — comportamento atual preservado.
function validSignature(req) {
  if (!MP.webhookSecret) return true;
  try {
    const sig = String(req.headers['x-signature'] || '');
    const reqId = String(req.headers['x-request-id'] || '');
    const parts = Object.fromEntries(sig.split(',').map(kv => kv.split('=').map(s => s.trim())));
    const dataId = String(req.query['data.id'] || req.query.id || (req.body && req.body.data && req.body.data.id) || '');
    if (!parts.ts || !parts.v1 || !dataId) return false;
    const manifest = `id:${dataId.toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
    const hmac = crypto.createHmac('sha256', MP.webhookSecret).update(manifest).digest('hex');
    const a = Buffer.from(hmac), b = Buffer.from(String(parts.v1));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_) { return false; }
}

router.post('/mercadopago', async (req, res) => {
  if (!validSignature(req)) return res.sendStatus(401);
  res.sendStatus(200); // responde rápido; processa depois
  try {
    const type = req.query.type || req.query.topic || (req.body && req.body.type);
    const id = req.query['data.id'] || req.query.id || (req.body && req.body.data && req.body.data.id);
    if (type !== 'payment' || !id) return;

    const payment = await mp.getPayment(id);
    if (!payment || payment.status !== 'approved') return;

    const orderId = Number(payment.external_reference);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order || order.payment_status === 'paid') return; // idempotente

    // Confirmação + cashback numa transação; o UPDATE condicional garante idempotência
    // mesmo com notificações duplicadas chegando em paralelo (não credita cashback 2x).
    const confirm = db.transaction(() => {
      const upd = db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ? AND payment_status != 'paid'").run(orderId);
      if (upd.changes !== 1) return false;
      if (order.cashback_mbv > 0) {
        wallet.move(order.user_id, order.cashback_mbv, 'cashback', `Cashback do pedido ${order.code}`, order.code);
      }
      return true;
    });
    if (!confirm()) return; // outro webhook já confirmou
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
    const full = { ...order, payment_status: 'paid', items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) };
    email.sendOrderConfirmation(user, full).catch(() => {});
  } catch (e) {
    console.error('[webhook mercadopago]', e.message);
  }
});

module.exports = router;
module.exports.validSignature = validSignature; // exposto para testes unitários
