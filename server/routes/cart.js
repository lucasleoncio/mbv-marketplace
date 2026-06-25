const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getCartItems, computeTotals } = require('../lib/pricing');

const router = express.Router();
router.use(requireAuth);

// GET /api/cart  -> itens + totais (aceita ?coupon= e ?payment= para pré-visualizar)
router.get('/', (req, res) => {
  const items = getCartItems(req.user.id);
  const totals = computeTotals(items, req.query.coupon, req.query.payment);
  res.json({ items, totals, count: items.reduce((s, i) => s + i.quantity, 0) });
});

// POST /api/cart  { product_id, quantity }
router.post('/', (req, res) => {
  const productId = parseInt(req.body.product_id);
  const qty = Math.max(1, parseInt(req.body.quantity) || 1);
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
  if (!product) return res.status(404).json({ error: 'Produto indisponível.' });

  const current = db.prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, productId);
  const newQty = Math.min(product.stock, (current ? current.quantity : 0) + qty);
  if (newQty <= 0) return res.status(400).json({ error: 'Produto sem estoque.' });

  db.prepare(`
    INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?,?,?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = ?
  `).run(req.user.id, productId, newQty, newQty);

  const items = getCartItems(req.user.id);
  res.status(201).json({ count: items.reduce((s, i) => s + i.quantity, 0) });
});

// PUT /api/cart/:productId  { quantity }
router.put('/:productId', (req, res) => {
  const qty = parseInt(req.body.quantity);
  const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  if (qty <= 0) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    const finalQty = Math.min(product.stock, qty);
    db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?')
      .run(finalQty, req.user.id, req.params.productId);
  }
  const items = getCartItems(req.user.id);
  res.json({ items, totals: computeTotals(items, req.query.coupon, req.query.payment), count: items.reduce((s, i) => s + i.quantity, 0) });
});

// DELETE /api/cart/:productId
router.delete('/:productId', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  const items = getCartItems(req.user.id);
  res.json({ items, totals: computeTotals(items), count: items.reduce((s, i) => s + i.quantity, 0) });
});

// DELETE /api/cart  -> esvazia
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json({ items: [], count: 0 });
});

// ---------------- Favoritos ----------------
router.get('/favorites/list', (req, res) => {
  const items = db.prepare(`
    SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM favorites f
    JOIN products p ON p.id = f.product_id LEFT JOIN categories c ON c.id = p.category_id
    WHERE f.user_id = ? AND p.active = 1 ORDER BY f.id DESC
  `).all(req.user.id);
  res.json({ items });
});

router.post('/favorites/:productId', (req, res) => {
  const exists = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, req.params.productId);
  if (exists) {
    db.prepare('DELETE FROM favorites WHERE id = ?').run(exists.id);
    return res.json({ favorited: false });
  }
  db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?,?)').run(req.user.id, req.params.productId);
  res.json({ favorited: true });
});

module.exports = router;
