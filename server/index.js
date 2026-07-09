const express = require('express');

// Express 4 NÃO captura rejeição de handler async (a requisição ficaria pendurada e o
// erro viraria unhandledRejection). Este shim — o mesmo padrão do pacote
// express-async-errors, embutido para não somar dependência — encaminha qualquer
// rejeição ao error handler central. Essencial agora que TODOS os handlers são async.
{
  const Layer = require('express/lib/router/layer');
  Object.defineProperty(Layer.prototype, 'handle', {
    configurable: true,
    get() { return this.__asyncWrapped; },
    set(fn) {
      this.__asyncWrapped = (fn.length > 3) ? fn : function wrapped(req, res, next) {
        const out = fn.call(this, req, res, next);
        if (out && typeof out.catch === 'function') out.catch(next);
        return out;
      };
    }
  });
}

const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cfg = require('./config');
const { PORT, APP_URL, DEMO_MODE, ALLOWED_ORIGINS } = cfg;
const db = require('./db');
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
      'connect-src': ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://cdnjs.cloudflare.com', 'https://viacep.com.br'],
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
// Garante que o schema do banco está pronto antes de atender (importante no Postgres,
// onde a criação é assíncrona; no SQLite resolve na hora).
app.use(async (_req, _res, next) => { try { await db.ready; } catch (_) {} next(); });
app.use(authOptional);

// --- Rate limiting (store em memória; em multi-instância, use store compartilhado) ---
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas requisições. Aguarde um instante.' } });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: Number(process.env.AUTH_RATE_MAX || 12), standardHeaders: true, legacyHeaders: false, message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' } });
app.use('/api/', apiLimiter);
app.use(['/api/auth/login', '/api/auth/login/2fa', '/api/auth/register', '/api/auth/forgot', '/api/auth/resend-verification'], authLimiter);

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

app.get('/api/health', async (_req, res) => {
  let dbUp = true;
  try { await db.prepare('SELECT 1 AS ok').get(); } catch (_) { dbUp = false; }
  res.status(dbUp ? 200 : 503).json({ ok: dbUp, db: dbUp ? 'up' : 'down', driver: db.__driver, service: 'MBV Marketplace', demo: DEMO_MODE });
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
app.get('/sitemap.xml', async (_req, res) => {
  const cats = await db.prepare('SELECT slug FROM categories').all();
  const prods = await db.prepare('SELECT id, slug FROM products WHERE active = 1').all();
  const urls = [APP_URL + '/', APP_URL + '/produtos',
    ...cats.map(c => `${APP_URL}/produtos?cat=${c.slug}`),
    ...prods.map(p => `${APP_URL}/produto/${p.id}/${p.slug || ''}`),
    ...['sobre', 'faq', 'contato', 'termos', 'privacidade', 'trocas', 'transparencia', 'afiliados', 'metodologia-co2'].map(s => `${APP_URL}/${s}`)];
  res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>');
});

// Frontend: estáticos (sem auto-index — o SSR cuida das páginas HTML)
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false, maxAge: '7d', etag: true }));
app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  try {
    res.set('Cache-Control', 'no-cache');
    res.send(await require('./lib/seo').renderHTML(req));
  } catch (e) { next(e); }
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
  if (cfg.MP.enabled && !cfg.MP.webhookSecret) warn.push('Mercado Pago ativo SEM MP_WEBHOOK_SECRET: o webhook aceitará notificações não autenticadas — configure o secret no painel do MP.');
  if (!cfg.EMAIL.resendKey) warn.push('Resend sem chave (RESEND_API_KEY): e-mails não serão enviados.');
  if (!process.env.MBV_DATA_DIR && !process.env.DATABASE_URL) warn.push('Armazenamento possivelmente efêmero: defina MBV_DATA_DIR (disco persistente) ou migre para Postgres — os dados podem zerar.');
  warn.forEach(w => console.warn('  ⚠️  GO-LIVE:', w));
}
preflight();

// Prepara os dados (schema + seed na primeira execução + índice de busca), com log de
// fase e tolerância a falha: um problema aqui NÃO pode impedir o servidor de subir.
async function bootstrapData() {
  try { await db.ready; } catch (e) { console.error('  [boot] ⚠️ banco indisponível:', e && e.message ? e.message : e); }
  let t = Date.now();
  try { await ensureSeed(); console.log(`  [boot] seed verificado em ${Date.now() - t}ms (driver: ${db.__driver})`); }
  catch (e) { console.error('  [boot] ⚠️ seed falhou:', e && e.message ? e.message : e); }
  t = Date.now();
  try { await db.reindexSearch(); console.log(`  [boot] índice de busca em ${Date.now() - t}ms`); }
  catch (e) { console.error('  [boot] ⚠️ reindex falhou:', e && e.message ? e.message : e); }
}

// Exporta o app + promessa de prontidão (testes: `await app.ready` antes do listen(0)).
module.exports = app;
module.exports.ready = bootstrapData();

if (require.main === module) {
  // Execução direta (npm start): abre a porta PRIMEIRO — o Render detecta o serviço
  // imediatamente (sem "no open ports detected") — o seed roda em paralelo e as
  // requisições aguardam o middleware de prontidão.
  const server = app.listen(PORT, () => {
    console.log('\n  🌱  MBV Marketplace no ar!');
    console.log(`     →  http://localhost:${PORT}\n`);
    console.log('  Admin:   admin@mbv.com    / admin123');
    console.log('  Cliente: cliente@mbv.com  / cliente123\n');
  });
  // Desligamento gracioso (o Render envia SIGTERM a cada deploy): fecha conexões e o pool.
  process.on('SIGTERM', () => {
    server.close(() => {
      Promise.resolve(db.end && db.end()).finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 8000).unref();
  });
}
