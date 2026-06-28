const express = require('express');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cfg = require('./config');
const { PORT, APP_URL, DEMO_MODE, ALLOWED_ORIGINS } = cfg;
const { authOptional } = require('./middleware/auth');
const { ensureSeed } = require('./seed');

const app = express();
app.set('trust proxy', 1); // atrás do proxy do Render — necessário p/ rate-limit por IP real
app.use(compression()); // gzip em HTML/CSS/JS

// --- Segurança: cabeçalhos (Helmet) + CSP compatível com os assets do app ---
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://www.googletagmanager.com', 'https://www.google-analytics.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://cdnjs.cloudflare.com'],
      'frame-ancestors': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': []
    }
  },
  crossOriginEmbedderPolicy: false
}));

// --- CORS restrito às origens do MBV (sem Origin = server-to-server: permitido) ---
app.use(cors({ origin: (origin, cb) => cb(null, !origin || ALLOWED_ORIGINS.includes(origin)), credentials: false }));

app.use(express.json({ limit: '512kb' }));
app.use(authOptional);

// --- Rate limiting (store em memória; em multi-instância, use store compartilhado) ---
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas requisições. Aguarde um instante.' } });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' } });
app.use('/api/', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/resend-verification'], authLimiter);

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
app.use('/api/jobs', require('./routes/jobs'));

app.get('/api/health', (_req, res) => {
  let dbUp = true;
  try { require('./db').prepare('SELECT 1 AS ok').get(); } catch (_) { dbUp = false; }
  res.status(dbUp ? 200 : 503).json({ ok: dbUp, db: dbUp ? 'up' : 'down', service: 'MBV Marketplace', demo: DEMO_MODE });
});
app.get('/api/chain', (_req, res) => {
  const pub = require('./lib/chain').publicConfig();
  const C = require('./config');
  pub.mpEnabled = C.MP.enabled;
  pub.gaId = C.GA_ID;
  // Flags de prontidão para go-live (apenas booleanos — nenhum segredo é exposto).
  pub.demo = C.DEMO_MODE;
  pub.emailEnabled = !!C.EMAIL.resendKey;
  pub.persistent = !!(process.env.MBV_DATA_DIR || process.env.DATABASE_URL);
  pub.jobsReady = !!C.JOBS_SECRET;
  res.json(pub);
});
// Estimativa de frete e prazo por CEP (usado na página do produto e no carrinho).
app.get('/api/shipping', (req, res) => {
  const { freightForCep } = require('./lib/shipping');
  const S = cfg.SHIPPING;
  const digits = String(req.query.cep || '').replace(/\D/g, '');
  if (digits.length !== 8) return res.status(400).json({ error: 'Informe um CEP válido (8 dígitos).' });
  const value = Number(req.query.value) || 0;
  const shipping = freightForCep(digits, value);
  const prazo = (S.prazoByRegion && S.prazoByRegion[digits[0]]) || S.prazoDefault || '5 a 10';
  res.json({ shipping, free: shipping === 0, freeAbove: S.freeAbove, prazo });
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
    ...['sobre', 'faq', 'contato', 'termos', 'privacidade', 'trocas', 'transparencia', 'afiliados', 'metodologia-co2'].map(s => `${APP_URL}/${s}`)];
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>');
});

// Frontend: estáticos (sem auto-index — o SSR cuida das páginas HTML)
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '7d', etag: true }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.set('Cache-Control', 'no-cache');
  res.send(require('./lib/seo').renderHTML(req));
});

// Handler de erros — não vaza detalhes internos ao cliente (só mensagens de erros 4xx).
app.use((err, _req, res, _next) => {
  console.error('[erro]', err && err.stack ? err.stack : err);
  const expose = !!err.status && err.status < 500;
  res.status(err.status || 500).json({ error: expose ? err.message : 'Erro interno do servidor.' });
});

// --- Verificações de go-live (ativam quando MBV_DEMO_MODE=false) ---
function preflight() {
  if (DEMO_MODE) {
    console.log('  ⚙️  Modo DEMONSTRAÇÃO ativo — pagamentos podem ser simulados. (Go-live: defina MBV_DEMO_MODE=false)');
    if (cfg.JWT_USING_DEFAULT_SECRET) console.warn('  ⚠️  JWT_SECRET padrão em uso — defina um segredo forte antes do go-live.');
    return;
  }
  // GO-LIVE: exigências mínimas
  if (cfg.JWT_USING_DEFAULT_SECRET) throw new Error('GO-LIVE bloqueado: defina um JWT_SECRET forte (variável de ambiente).');
  const warn = [];
  if (!cfg.MP.enabled) warn.push('Mercado Pago sem chave (MP_ACCESS_TOKEN): Cartão/Pix ficarão indisponíveis.');
  if (!cfg.EMAIL.resendKey) warn.push('Resend sem chave (RESEND_API_KEY): e-mails não serão enviados.');
  if (!process.env.MBV_DATA_DIR && !process.env.DATABASE_URL) warn.push('Armazenamento possivelmente efêmero: defina MBV_DATA_DIR (disco persistente) ou migre para Postgres — os dados podem zerar.');
  warn.forEach(w => console.warn('  ⚠️  GO-LIVE:', w));
}
preflight();

// Popula o banco na primeira execução, depois sobe o servidor.
ensureSeed();
require('./db').reindexSearch(); // índice de busca (sem acento) atualizado no boot
app.listen(PORT, () => {
  console.log('\n  🌱  MBV Marketplace no ar!');
  console.log(`     →  http://localhost:${PORT}\n`);
  console.log('  Admin:   admin@mbv.com    / admin123');
  console.log('  Cliente: cliente@mbv.com  / cliente123\n');
});
