// Endpoints de tarefas agendadas (chamados por um cron externo no go-live).
// Protegidos por JOBS_SECRET (?key= ou header x-jobs-key).
const express = require('express');
const db = require('../db');
const email = require('../lib/email');
const { JOBS_SECRET } = require('../config');

const router = express.Router();

function authed(req) {
  return !!JOBS_SECRET && (req.query.key === JOBS_SECRET || req.headers['x-jobs-key'] === JOBS_SECRET);
}

// Carrinho abandonado: notifica clientes com itens parados há mais de N horas (padrão 4).
router.all('/abandoned-cart', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'Não autorizado.' });
  const h = req.query.hours !== undefined ? Math.max(0, Number(req.query.hours) || 0) : 4;
  const rows = db.prepare(
    `SELECT DISTINCT user_id FROM cart_items WHERE notified = 0 AND created_at IS NOT NULL AND created_at <= datetime('now', ?)`
  ).all(`-${h} hours`);
  let sent = 0;
  for (const { user_id } of rows) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user || !user.email) continue;
    const items = db.prepare(
      `SELECT ci.quantity, p.name, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?`
    ).all(user_id);
    if (!items.length) continue;
    await email.sendAbandonedCart(user, items).catch(() => {});
    db.prepare('UPDATE cart_items SET notified = 1 WHERE user_id = ?').run(user_id);
    sent++;
  }
  res.json({ ok: true, notified: sent });
});

module.exports = router;
