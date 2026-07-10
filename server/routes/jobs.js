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
  // Corte calculado em JS — portável entre SQLite e Postgres
  const cutoff = db.utcNow(-h * 3600 * 1000);
  const rows = await db.prepare(
    'SELECT DISTINCT user_id FROM cart_items WHERE notified = 0 AND created_at IS NOT NULL AND created_at <= ?'
  ).all(cutoff);
  let sent = 0;
  for (const { user_id } of rows) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
    if (!user || !user.email) continue;
    const items = await db.prepare(
      'SELECT ci.quantity, p.name, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?'
    ).all(user_id);
    if (!items.length) continue;
    await email.sendAbandonedCart(user, items).catch(() => {});
    await db.prepare('UPDATE cart_items SET notified = 1 WHERE user_id = ?').run(user_id);
    sent++;
  }
  res.json({ ok: true, notified: sent });
});

// Reposição por safra: encontra clientes cujo último pedido PAGO de um produto está
// dentro da "janela de reposição" (ciclo em dias, padrão 75) e envia um lembrete.
// Deduplicado por transactions (ref 'replenish:<produto>:<userAno>') para não repetir.
router.all('/replenishment', async (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'Não autorizado.' });
  const cycle = req.query.cycle !== undefined ? Math.max(15, Number(req.query.cycle) || 75) : 75; // dias
  const graceEnd = cycle + 21; // janela de ~3 semanas a partir do ciclo
  const nowMs = Date.now();
  const from = db.utcNow(-graceEnd * 24 * 3600 * 1000);
  const to = db.utcNow(-cycle * 24 * 3600 * 1000);

  // Última compra paga de cada (usuário, produto) dentro da janela.
  const rows = await db.prepare(`
    SELECT o.user_id, oi.product_id, oi.name, MAX(o.created_at) AS last_at
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.payment_status = 'paid' AND o.status != 'cancelled' AND oi.product_id IS NOT NULL
    GROUP BY o.user_id, oi.product_id, oi.name
    HAVING MAX(o.created_at) >= ? AND MAX(o.created_at) <= ?
  `).all(from, to);

  const byUser = new Map();
  for (const r of rows) {
    const key = `replenish:${r.product_id}:${new Date().getUTCFullYear()}`;
    const already = await db.prepare("SELECT 1 FROM transactions WHERE user_id = ? AND ref = ? LIMIT 1").get(r.user_id, key);
    if (already) continue;
    const days = Math.round((nowMs - new Date(r.last_at.replace(' ', 'T') + 'Z').getTime()) / (24 * 3600 * 1000));
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id).push({ product_id: r.product_id, name: r.name, days, key });
  }

  let sent = 0;
  for (const [userId, items] of byUser) {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user || !user.email) continue;
    await email.sendReplenishment(user, items).catch(() => {});
    // Marca cada item como notificado (amount 0 — é só um marcador anti-duplicidade no ledger).
    for (const it of items) {
      await db.prepare('INSERT INTO transactions (user_id, type, amount, balance_after, description, ref) VALUES (?,?,?,?,?,?)')
        .run(userId, 'replenish_notice', 0, user.mbv_balance, `Lembrete de reposição: ${it.name}`, it.key).catch(() => {});
    }
    sent++;
  }
  res.json({ ok: true, notified: sent });
});

module.exports = router;
