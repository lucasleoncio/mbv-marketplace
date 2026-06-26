const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getCartItems, computeTotals } = require('../lib/pricing');

const router = express.Router();

// POST /api/coupons/validate  { code }  -> aplica sobre o carrinho do usuário
router.post('/validate', requireAuth, (req, res) => {
  const items = getCartItems(req.user.id);
  if (!items.length) return res.status(400).json({ error: 'Seu carrinho está vazio.' });
  const totals = computeTotals(items, req.body.code, req.body.payment, req.body.cep);
  if (totals.couponError) return res.status(400).json({ error: totals.couponError });
  if (!totals.coupon) return res.status(400).json({ error: 'Cupom inválido.' });
  res.json({ totals });
});

// GET /api/coupons (admin)
router.get('/', requireAdmin, (_req, res) => {
  res.json({ coupons: db.prepare('SELECT * FROM coupons ORDER BY id DESC').all() });
});

// POST /api/coupons (admin)
router.post('/', requireAdmin, (req, res) => {
  const code = String(req.body.code || '').toUpperCase().trim();
  if (!code) return res.status(400).json({ error: 'Informe o código do cupom.' });
  const exists = db.prepare('SELECT id FROM coupons WHERE code = ?').get(code);
  if (exists) return res.status(409).json({ error: 'Já existe um cupom com este código.' });
  const info = db.prepare(`
    INSERT INTO coupons (code, type, value, description, min_subtotal, cashback_mbv, active)
    VALUES (?,?,?,?,?,?,1)
  `).run(code, req.body.type === 'fixed' ? 'fixed' : 'percent', Number(req.body.value) || 0,
    String(req.body.description || ''), Number(req.body.min_subtotal) || 0, Number(req.body.cashback_mbv) || 0);
  res.status(201).json({ coupon: db.prepare('SELECT * FROM coupons WHERE id = ?').get(info.lastInsertRowid) });
});

// PUT /api/coupons/:id (admin) - alterna ativo / edita
router.put('/:id', requireAdmin, (req, res) => {
  const c = db.prepare('SELECT * FROM coupons WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cupom não encontrado.' });
  db.prepare(`UPDATE coupons SET type=?, value=?, description=?, min_subtotal=?, cashback_mbv=?, active=? WHERE id=?`)
    .run(req.body.type === 'fixed' ? 'fixed' : 'percent',
      req.body.value !== undefined ? Number(req.body.value) : c.value,
      req.body.description !== undefined ? String(req.body.description) : c.description,
      req.body.min_subtotal !== undefined ? Number(req.body.min_subtotal) : c.min_subtotal,
      req.body.cashback_mbv !== undefined ? Number(req.body.cashback_mbv) : c.cashback_mbv,
      req.body.active !== undefined ? (req.body.active ? 1 : 0) : c.active, c.id);
  res.json({ coupon: db.prepare('SELECT * FROM coupons WHERE id = ?').get(c.id) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
