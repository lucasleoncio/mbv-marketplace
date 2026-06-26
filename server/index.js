const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT, APP_URL } = require('./config');
const { authOptional } = require('./middleware/auth');
const { ensureSeed } = require('./seed');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(authOptional);

// Arquivos enviados pelo admin (imagens de produtos)
app.use('/uploads', express.static(process.env.MBV_UPLOAD_DIR || path.join(__dirname, 'uploads')));

// API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/webhooks', require('./routes/webhooks'));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'MBV Marketplace' }));
app.get('/api/chain', (_req, res) => {
  const cfg = require('./lib/chain').publicConfig();
  cfg.mpEnabled = require('./config').MP.enabled;
  cfg.gaId = require('./config').GA_ID;
  res.json(cfg);
});
// Recebe erros do frontend e os registra (aparecem no log do servidor/Render).
app.post('/api/client-error', (req, res) => {
  console.error('[client-error]', JSON.stringify(req.body || {}).slice(0, 600));
  res.sendStatus(204);
});

// Sitemap dinâmico (produtos + categorias) — antes do static
app.get('/sitemap.xml', (_req, res) => {
  const db = require('./db');
  const cats = db.prepare('SELECT slug FROM categories').all();
  const prods = db.prepare('SELECT id, slug FROM products WHERE active = 1').all();
  const urls = [APP_URL + '/', APP_URL + '/produtos',
    ...cats.map(c => `${APP_URL}/produtos?cat=${c.slug}`),
    ...prods.map(p => `${APP_URL}/produto/${p.id}/${p.slug || ''}`),
    ...['sobre', 'faq', 'contato', 'termos', 'privacidade', 'trocas'].map(s => `${APP_URL}/${s}`)];
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>');
});

// Frontend: estáticos (sem auto-index — o SSR cuida das páginas HTML)
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.set('Cache-Control', 'no-cache');
  res.send(require('./lib/seo').renderHTML(req));
});

// Handler de erros
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Erro interno do servidor.' });
});

// Popula o banco na primeira execução, depois sobe o servidor.
ensureSeed();
app.listen(PORT, () => {
  console.log('\n  🌱  MBV Marketplace no ar!');
  console.log(`     →  http://localhost:${PORT}\n`);
  console.log('  Admin:   admin@mbv.com    / admin123');
  console.log('  Cliente: cliente@mbv.com  / cliente123\n');
});
