const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES, TOKEN } = require('../config');
const { requireAuth } = require('../middleware/auth');
const wallet = require('../lib/wallet');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    mbv_balance: u.mbv_balance, wallet_address: u.wallet_address, phone: u.phone
  };
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Informe nome, e-mail e senha.' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'A senha deve ter ao menos 6 caracteres.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

  const hash = bcrypt.hashSync(String(password), 10);
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
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password), user.password))
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

  res.json({ token: sign(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

module.exports = router;
