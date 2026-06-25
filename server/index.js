const express = require('express');
const cors = require('cors');
const path = require('path');
const { PORT } = require('./config');
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

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'MBV Marketplace' }));

// Frontend (SPA)
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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
