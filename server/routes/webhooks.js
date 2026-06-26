// Webhook do Mercado Pago: recebe a notificação, confirma o status direto na API
// (fonte da verdade) e marca o pedido como pago.
const express = require('express');
const db = require('../db');
const mp = require('../lib/mercadopago');
const wallet = require('../lib/wallet');
const email = require('../lib/email');

const router = express.Router();

router.post('/mercadopago', async (req, res) => {
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

    db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(orderId);
    if (order.cashback_mbv > 0) {
      wallet.move(order.user_id, order.cashback_mbv, 'cashback', `Cashback do pedido ${order.code}`, order.code);
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
    const full = { ...order, payment_status: 'paid', items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) };
    email.sendOrderConfirmation(user, full).catch(() => {});
  } catch (e) {
    console.error('[webhook mercadopago]', e.message);
  }
});

module.exports = router;
