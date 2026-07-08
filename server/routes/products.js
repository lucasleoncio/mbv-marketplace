const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { DEMO_MODE } = require('../config');
const { normalize } = require('../lib/text');
const email = require('../lib/email');

// Sinônimos/termos agro para a busca encontrar pela intenção (já normalizados, sem acento).
const SYNONYMS = {
  placa: 'painel solar', placas: 'painel solar', solar: 'painel solar energia', energia: 'painel solar',
  adubo: 'fertilizante', aduba: 'fertilizante', adubacao: 'fertilizante',
  veneno: 'defensivo', pesticida: 'defensivo', agrotoxico: 'defensivo', praga: 'defensivo',
  muda: 'mudas', semente: 'sementes',
  npk: 'fertilizante foliar', ureia: 'fertilizante nitrogenio', nitrogenio: 'inoculante nitrogenio',
  calcario: 'calcario correcao', calagem: 'calcario correcao',
  agua: 'irrigacao', irrigacao: 'irrigacao gotejamento bomba', bomba: 'bomba irrigacao',
  organico: 'organico', composto: 'composto organico', humus: 'humus minhoca'
};

const router = express.Router();

// ---------- Upload de imagens (admin) ----------
const UPLOAD_DIR = process.env.MBV_UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_IMG = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // extensão derivada do TIPO declarado (não do nome do arquivo enviado)
    const ext = ALLOWED_IMG[file.mimetype] || '.jpg';
    cb(null, `prod_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMG[file.mimetype]) return cb(null, true);
    cb(Object.assign(new Error('Formato inválido. Envie uma imagem JPG, PNG ou WebP.'), { status: 400 }), false);
  }
});

// ---------- Helpers ----------
function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
function parseJSON(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function serialize(p) {
  if (!p) return p;
  return {
    ...p,
    gallery: parseJSON(p.gallery, []),
    badges: parseJSON(p.badges, []),
    specs: parseJSON(p.specs, []), // ficha técnica: [{k,v},...]
    featured: !!p.featured,
    active: !!p.active
  };
}

// ---------- Categorias ----------
router.get('/meta/categories', (_req, res) => {
  const cats = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
    FROM categories c ORDER BY c.name
  `).all();
  res.json({ categories: cats });
});

// ---------- Listagem com filtros ----------
// GET /api/products?q=&category=slug&min=&max=&sort=&featured=&page=&limit=
router.get('/', (req, res) => {
  const { q, category, min, max, sort, featured } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, parseInt(req.query.limit) || 12));
  const offset = (page - 1) * limit;

  const where = ['p.active = 1'];
  const params = {};
  let relevance = null; // score de relevância quando há busca
  if (q) {
    const terms = new Set();
    normalize(q).split(' ').filter(Boolean).forEach(w => {
      terms.add(w);
      if (SYNONYMS[w]) SYNONYMS[w].split(' ').forEach(t => terms.add(t));
    });
    const list = [...terms];
    const conds = list.map((t, i) => { params['s' + i] = `%${t}%`; return `p.search_text LIKE @s${i}`; });
    params.qraw = `%${q}%`;
    conds.push('p.name LIKE @qraw', 'p.description LIKE @qraw'); // fallback (com acento)
    where.push('(' + conds.join(' OR ') + ')');
    // Relevância: nº de termos casados pesa mais; frase crua no nome dá bônus.
    relevance = `((${list.map((_, i) => `(p.search_text LIKE @s${i})`).join(' + ')}) * 3 + (CASE WHEN p.name LIKE @qraw THEN 5 ELSE 0 END))`;
  }
  if (category) { where.push('c.slug = @cat'); params.cat = category; }
  if (min) { where.push('p.price >= @min'); params.min = Number(min); }
  if (max) { where.push('p.price <= @max'); params.max = Number(max); }
  if (featured === '1') where.push('p.featured = 1');

  // "Mais vendidos" de verdade: soma de itens de pedidos pagos (não cancelados).
  const soldJoin = sort === 'best_sellers'
    ? `LEFT JOIN (SELECT oi.product_id AS pid, SUM(oi.quantity) AS sold FROM order_items oi
        JOIN orders o ON o.id = oi.order_id WHERE o.payment_status = 'paid' AND o.status != 'cancelled'
        GROUP BY oi.product_id) s ON s.pid = p.id`
    : '';

  let order = 'p.featured DESC, p.id DESC';
  if (sort === 'price_asc') order = 'p.price ASC';
  else if (sort === 'price_desc') order = 'p.price DESC';
  else if (sort === 'newest') order = 'p.id DESC';
  else if (sort === 'rating') order = 'p.rating DESC, p.rating_count DESC';
  else if (sort === 'best_sellers') order = 'COALESCE(s.sold, 0) DESC, p.featured DESC, p.id DESC';
  else if (relevance) order = `${relevance} DESC, p.featured DESC, p.rating_count DESC, p.id DESC`; // busca sem sort explícito: mérito

  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) n FROM products p LEFT JOIN categories c ON c.id=p.category_id ${clause}`).get(params).n;
  const items = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id = p.category_id ${soldJoin}
    ${clause} ORDER BY ${order} LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ items: items.map(serialize), total, page, pages: Math.ceil(total / limit) || 1 });
});

// Resumo de produtos por IDs — usado pelo carrinho/favoritos de convidado. (Antes de /:id)
router.get('/by-ids', (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(n => parseInt(n)).filter(Boolean).slice(0, 100);
  if (!ids.length) return res.json({ items: [] });
  const ph = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1 AND p.id IN (${ph})
  `).all(...ids);
  res.json({ items: rows.map(serialize) });
});

// ---------- Detalhe ----------
// POST /api/products/:id/notify — "avise-me quando chegar" (captura demanda de esgotado)
router.post('/:id/notify', (req, res) => {
  const p = db.prepare('SELECT id, name, stock FROM products WHERE id = ? AND active = 1').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const mail = String(req.body.email || (req.user && req.user.email) || '').trim().toLowerCase();
  if (!/.+@.+\..+/.test(mail)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (p.stock > 0) return res.status(400).json({ error: 'Este produto está disponível — adicione ao carrinho.' });
  db.prepare(`
    INSERT INTO stock_alerts (product_id, email) VALUES (?,?)
    ON CONFLICT(product_id, email) DO UPDATE SET notified = 0
  `).run(p.id, mail);
  res.status(201).json({ ok: true });
});

// Reposição de estoque: avisa quem pediu (fire-and-forget; e-mail em dev-log sem chave).
function notifyBackInStock(p) {
  try {
    const rows = db.prepare('SELECT email FROM stock_alerts WHERE product_id = ? AND notified = 0').all(p.id);
    if (!rows.length) return;
    db.prepare('UPDATE stock_alerts SET notified = 1 WHERE product_id = ? AND notified = 0').run(p.id);
    for (const r of rows) email.sendBackInStock(r.email, p).catch(() => {});
  } catch (e) { console.error('[back-in-stock]', e.message); }
}

router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });

  const reviews = db.prepare('SELECT * FROM reviews WHERE product_id = ? ORDER BY id DESC').all(p.id);
  const related = db.prepare(`
    SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
    LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.category_id = ? AND p.id != ? AND p.active = 1 ORDER BY RANDOM() LIMIT 4
  `).all(p.category_id, p.id);

  res.json({ product: serialize(p), reviews, related: related.map(serialize) });
});

// ---------- Avaliações (cliente autenticado) ----------
router.post('/:id/reviews', requireAuth, (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  const rating = Math.min(5, Math.max(1, parseInt(req.body.rating) || 0));
  if (!rating) return res.status(400).json({ error: 'Informe uma nota de 1 a 5.' });

  // Compra verificada: o usuário tem um pedido PAGO com este produto.
  const bought = db.prepare(`SELECT 1 FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.user_id = ? AND oi.product_id = ? AND o.payment_status = 'paid' LIMIT 1`).get(req.user.id, product.id);
  if (!bought && !DEMO_MODE) return res.status(403).json({ error: 'Apenas quem comprou este produto pode avaliá-lo.' });

  db.prepare(`
    INSERT INTO reviews (product_id, user_id, user_name, rating, comment, verified) VALUES (?,?,?,?,?,?)
    ON CONFLICT(product_id, user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, verified=excluded.verified, created_at=datetime('now')
  `).run(product.id, req.user.id, req.user.name, rating, String(req.body.comment || '').slice(0, 600), bought ? 1 : 0);

  // Recalcula média do produto
  const agg = db.prepare('SELECT AVG(rating) avg, COUNT(*) n FROM reviews WHERE product_id = ?').get(product.id);
  db.prepare('UPDATE products SET rating = ?, rating_count = ? WHERE id = ?')
    .run(Math.round(agg.avg * 10) / 10, agg.n, product.id);

  res.status(201).json({ ok: true, rating: Math.round(agg.avg * 10) / 10, rating_count: agg.n });
});

// =================== ADMIN ===================
router.post('/upload', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  // Validação por conteúdo (magic bytes): garante que é mesmo uma imagem.
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const buf = Buffer.alloc(12); fs.readSync(fd, buf, 0, 12, 0); fs.closeSync(fd);
    const isJpg = buf[0] === 0xFF && buf[1] === 0xD8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    if (!isJpg && !isPng && !isWebp) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Arquivo não é uma imagem válida.' });
    }
  } catch (_) { /* se não conseguir ler, segue (não bloqueia o admin) */ }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

function readProductBody(b) {
  return {
    name: String(b.name || '').trim(),
    description: String(b.description || '').trim(),
    price: Number(b.price) || 0,
    compare_at_price: b.compare_at_price ? Number(b.compare_at_price) : null,
    category_id: b.category_id ? Number(b.category_id) : null,
    stock: parseInt(b.stock) || 0,
    unit: String(b.unit || 'un'),
    pack_size: String(b.pack_size || '').trim() || null,
    image: String(b.image || '').trim() || null,
    gallery: JSON.stringify(Array.isArray(b.gallery) ? b.gallery.map(u => String(u).trim()).filter(Boolean).slice(0, 8) : []),
    badges: JSON.stringify(Array.isArray(b.badges) ? b.badges : (b.badges ? String(b.badges).split(',').map(s => s.trim()).filter(Boolean) : [])),
    // Ficha técnica: aceita [{k,v}] e valida/normaliza (máx. 20 linhas)
    specs: JSON.stringify(Array.isArray(b.specs)
      ? b.specs.map(s => ({ k: String((s && s.k) || '').trim().slice(0, 60), v: String((s && s.v) || '').trim().slice(0, 200) })).filter(s => s.k && s.v).slice(0, 20)
      : []),
    mapa_reg: String(b.mapa_reg || '').trim().slice(0, 60) || null,
    featured: b.featured ? 1 : 0,
    co2: Number(b.co2) || 0,
    active: b.active === undefined ? 1 : (b.active ? 1 : 0)
  };
}

router.post('/', requireAdmin, (req, res) => {
  const d = readProductBody(req.body);
  if (!d.name) return res.status(400).json({ error: 'Informe o nome do produto.' });
  if (d.price <= 0) return res.status(400).json({ error: 'Informe um preço válido.' });
  const info = db.prepare(`
    INSERT INTO products (name, slug, description, price, compare_at_price, category_id, stock, unit, pack_size, image, gallery, badges, specs, mapa_reg, featured, co2, active)
    VALUES (@name,@slug,@description,@price,@compare_at_price,@category_id,@stock,@unit,@pack_size,@image,@gallery,@badges,@specs,@mapa_reg,@featured,@co2,@active)
  `).run({ ...d, slug: slugify(d.name) });
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ product: serialize(p) });
});

router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });
  const d = readProductBody({
    ...existing, ...req.body,
    badges: req.body.badges ?? parseJSON(existing.badges, []),
    gallery: req.body.gallery ?? parseJSON(existing.gallery, []),
    specs: req.body.specs ?? parseJSON(existing.specs, [])
  });
  db.prepare(`
    UPDATE products SET name=@name, slug=@slug, description=@description, price=@price, compare_at_price=@compare_at_price,
      category_id=@category_id, stock=@stock, unit=@unit, pack_size=@pack_size, image=@image, gallery=@gallery,
      badges=@badges, specs=@specs, mapa_reg=@mapa_reg, featured=@featured, co2=@co2, active=@active WHERE id=@id
  `).run({ ...d, slug: slugify(d.name), id: existing.id });
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  // Produto voltou ao estoque? Dispara o "avise-me quando chegar".
  if (existing.stock <= 0 && p.stock > 0) notifyBackInStock(p);
  res.json({ product: serialize(p) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });
  // Soft delete para preservar histórico de pedidos
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

module.exports = router;
