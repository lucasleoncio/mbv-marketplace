const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config');

// Lê o token (se houver) e popula req.user. Não bloqueia.
async function authOptional(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      // Tokens de escopo restrito (ex.: etapa intermediária do 2FA) NUNCA viram sessão.
      if (payload.scope) return next();
      const user = await db.prepare('SELECT id, name, email, role, mbv_balance, wallet_address, phone FROM users WHERE id = ?').get(payload.id);
      if (user) req.user = user;
    } catch (_) { /* token inválido => segue como visitante */ }
  }
  next();
}

// Exige usuário autenticado.
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.' });
  next();
}

// Exige papel de administrador.
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  next();
}

module.exports = { authOptional, requireAuth, requireAdmin };
