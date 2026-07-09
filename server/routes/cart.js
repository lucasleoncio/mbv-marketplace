const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { getCartItems, computeTotals } = require('../lib/pricing');

const router = express.Router();
router.use(requireAuth);

// GET /api/cart  -> itens + totais (aceita ?coupon= e ?payment= para pré-visualizar)
router.get('/', async (req, res) => {
  const items = await getCartItems(req.user.id);
  const totals = await computeTotals(items, req.query.coupon, req.query.payment, req.query.cep, req.query.cpf);
  res.json({ items, totals, count: items.reduce((s, i) => s + i.quantity, 0) });
});

// POST /api/cart  { product_id, quantity }
router.post('/', async (req, res) => {
  const productId = parseInt(req.body.product_id);
  const qty = Math.max(1, parseInt(req.body.quantity) || 1);
  const product = await db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
  if (!product) return res.status(404).json({ error: 'Produto indisponível.' });

  const current = await db.prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, productId);
  const newQty = Math.min(product.stock, (current ? current.quantity : 0) + qty);
  if (newQty <= 0) return res.status(400).json({ error: 'Produto sem estoque.' });

  await db.prepare(`
    INSERT INTO cart_items (user_id, product_id, quantity, created_at, notified) VALUES (?,?,?,?,0)
    ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = ?, notified = 0
  `).run(req.user.id, productId, newQty, db.utcNow(), newQty);

  const items = await getCartItems(req.user.id);
  res.status(201).json({ count: items.reduce((s, i) => s + i.quantity, 0) });
});

// PUT /api/cart/:productId  { quantity }
router.put('/:productId', async (req, res) => {
  const qty = parseInt(req.body.quantity);
  if (!Number.isInteger(qty)) return res.status(400).json({ error: 'Informe uma quantidade válida.' }); // NaN causava 500
  const product = await db.prepare('SELECT stock FROM products WHERE id = ?').get(req.params.productId);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  if (qty <= 0) {
    await db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  } else {
    const finalQty = Math.min(product.stock, qty);
    await db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?')
      .run(finalQty, req.user.id, req.params.productId);
  }
  const items = await getCartItems(req.user.id);
  res.json({ items, totals: await computeTotals(items, req.query.coupon, req.query.payment), count: items.reduce((s, i) => s + i.quantity, 0) });
});

// DELETE /api/cart/:productId
router.delete('/:productId', async (req, res) => {
  await db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.user.id, req.params.productId);
  const items = await getCartItems(req.user.id);
  res.json({ items, totals: await computeTotals(items), count: items.reduce((s, i) => s + i.quantity, 0) });
});

// DELETE /api/cart  -> esvazia
router.delete('/', async (req, res) => {
  await db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
  res.json({ items: [], count: 0 });
});

// ---------------- Favoritos ----------------
router.get('/favorites/list', async (req, res) => {
  const items = await db.prepare(`
    SELECT p.*, c.slug AS category_slug, c.name AS category_name FROM favorites f
    JOIN products p ON p.id = f.product_id LEFT JOIN categories c ON c.id = p.category_id
    WHERE f.user_id = ? AND p.active = 1 ORDER BY f.id DESC
  `).all(req.user.id);
  // BUG corrigido: sem serialize, badges/gallery/specs iam como string JSON e o
  // productCard quebrava — a página de favoritos ficava vazia para usuário logado.
  const { serialize } = require('./products');
  res.json({ items: items.map(serialize) });
});

router.post('/favorites/:productId', async (req, res) => {
  const exists = await db.prepare('SELECT id FROM favorites WHERE user_id = ? AND product_id = ?')
    .get(req.user.id, req.params.productId);
  if (exists) {
    await db.prepare('DELETE FROM favorites WHERE id = ?').run(exists.id);
    return res.json({ favorited: false });
  }
  await db.prepare('INSERT INTO favorites (user_id, product_id) VALUES (?,?)').run(req.user.id, req.params.productId);
  res.json({ favorited: true });
});

module.exports = router;
