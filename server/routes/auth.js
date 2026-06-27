const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES, TOKEN, APP_URL } = require('../config');
const { requireAuth } = require('../middleware/auth');
const wallet = require('../lib/wallet');
const email = require('../lib/email');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    mbv_balance: u.mbv_balance, wallet_address: u.wallet_address, phone: u.phone,
    email_verified: !!u.email_verified
  };
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Informe nome, e-mail e senha.' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

  const hash = await bcrypt.hash(String(password), 10);
  const address = wallet.makeWalletAddress();
  const info = db.prepare(
    'INSERT INTO users (name, email, password, role, wallet_address) VALUES (?,?,?,?,?)'
  ).run(String(name).trim(), String(email).toLowerCase().trim(), hash, 'customer', address);

  // Bônus de boas-vindas em MBV Coin
  if (TOKEN.welcomeBonus > 0) {
    wallet.move(info.lastInsertRowid, TOKEN.welcomeBonus, 'welcome',
      `Bônus de boas-vindas ao MBV`, 'welcome');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  sendVerify(user); // envia e-mail de confirmação (não bloqueia o cadastro)
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !(await bcrypt.compare(String(password), user.password)))
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

  res.json({ token: sign(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

// POST /api/auth/forgot { email } -> envia link de redefinição (resposta sempre genérica)
router.post('/forgot', (req, res) => {
  const em = String(req.body.email || '').toLowerCase().trim();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(em);
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600 * 1000).toISOString();
    db.prepare("INSERT INTO auth_tokens (user_id, kind, token, expires_at) VALUES (?, 'reset', ?, ?)").run(user.id, token, expires);
    email.sendPasswordReset(user, `${APP_URL}/redefinir?token=${token}`).catch(() => {});
  }
  res.json({ ok: true });
});

// POST /api/auth/reset { token, password }
router.post('/reset', async (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });
  const row = db.prepare("SELECT * FROM auth_tokens WHERE token = ? AND kind = 'reset' AND used = 0").get(token);
  if (!row || new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(await bcrypt.hash(password, 10), row.user_id);
  db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// Cria token de verificação e envia o e-mail de confirmação.
function sendVerify(user) {
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO auth_tokens (user_id, kind, token, expires_at) VALUES (?, 'verify', ?, ?)").run(user.id, token, expires);
  email.sendVerification(user, `${APP_URL}/verificar?token=${token}`).catch(() => {});
}

// POST /api/auth/verify { token }
router.post('/verify', (req, res) => {
  const token = String(req.body.token || '').trim();
  const row = db.prepare("SELECT * FROM auth_tokens WHERE token = ? AND kind = 'verify' AND used = 0").get(token);
  if (!row || new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Link inválido ou expirado.' });
  db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(row.user_id);
  db.prepare('UPDATE auth_tokens SET used = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

// POST /api/auth/resend-verification
router.post('/resend-verification', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.email_verified) return res.json({ ok: true, already: true });
  sendVerify(user);
  res.json({ ok: true });
});

module.exports = router;
