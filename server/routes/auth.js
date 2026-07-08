const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET, JWT_EXPIRES, TOKEN, APP_URL } = require('../config');
const { requireAuth } = require('../middleware/auth');
const wallet = require('../lib/wallet');
const email = require('../lib/email');
const { validatePassword } = require('../lib/password');
const { validCpfCnpj } = require('../lib/doc');
const totp = require('../lib/totp');

const router = express.Router();

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    mbv_balance: u.mbv_balance, wallet_address: u.wallet_address, phone: u.phone,
    cpf_cnpj: u.cpf_cnpj || null,
    email_verified: !!u.email_verified,
    totp_enabled: !!u.totp_enabled
  };
}

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// Rate limit específico do 2FA: 5 tentativas de código / 5 min por usuário (além do limite por IP).
const twofaAttempts = new Map();
function tooMany2fa(userId) {
  const now = Date.now();
  const rec = twofaAttempts.get(userId) || { n: 0, ts: now };
  if (now - rec.ts > 5 * 60 * 1000) { rec.n = 0; rec.ts = now; }
  rec.n++;
  twofaAttempts.set(userId, rec);
  return rec.n > 5;
}
const CODE_ERR = 'Código inválido ou expirado.'; // mensagem única — não vaza estado do 2FA

// POST /api/auth/register — senha forte (NIST) + CPF/CNPJ e celular opcionais validados
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Informe nome, e-mail e senha.' });
  if (!/.+@.+\..+/.test(String(email)))
    return res.status(400).json({ error: 'Informe um e-mail válido.' });

  const pw = validatePassword(password, { email, name });
  if (!pw.ok) return res.status(400).json({ error: pw.error });

  // CPF/CNPJ OBRIGATÓRIO no cadastro (decisão do cliente): dígitos verificadores + unicidade.
  const doc = String(req.body.cpf_cnpj || '').replace(/\D/g, '');
  if (!doc) return res.status(400).json({ error: 'Informe seu CPF ou CNPJ.' });
  if (!validCpfCnpj(doc)) return res.status(400).json({ error: 'CPF/CNPJ inválido — confira os números digitados.' });
  if (db.prepare('SELECT id FROM users WHERE cpf_cnpj = ?').get(doc))
    return res.status(409).json({ error: 'Este CPF/CNPJ já está cadastrado. Tente recuperar a senha da sua conta.' });
  const phone = String(req.body.phone || '').replace(/\D/g, '') || null;
  if (phone && (phone.length < 10 || phone.length > 11))
    return res.status(400).json({ error: 'Telefone inválido — use DDD + número.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });

  const hash = await bcrypt.hash(String(password), 10);
  const address = wallet.makeWalletAddress();
  const info = db.prepare(
    'INSERT INTO users (name, email, password, role, wallet_address, cpf_cnpj, phone) VALUES (?,?,?,?,?,?,?)'
  ).run(String(name).trim(), String(email).toLowerCase().trim(), hash, 'customer', address, doc, phone);

  // Bônus de boas-vindas em MBV Coin
  if (TOKEN.welcomeBonus > 0) {
    wallet.move(info.lastInsertRowid, TOKEN.welcomeBonus, 'welcome',
      `Bônus de boas-vindas ao MBV`, 'welcome');
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  sendVerify(user); // envia e-mail de confirmação (não bloqueia o cadastro)
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login — com 2FA ativo, devolve token temporário de escopo restrito
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim());
  if (!user || !(await bcrypt.compare(String(password), user.password)))
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });

  if (user.totp_enabled) {
    // Etapa 2 pendente: tmpToken de 5 min com scope '2fa' — o middleware NUNCA o aceita como sessão.
    const tmpToken = jwt.sign({ id: user.id, scope: '2fa' }, JWT_SECRET, { expiresIn: '5m' });
    return res.json({ twofa: true, tmpToken });
  }

  res.json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login/2fa { tmpToken, code } — conclui o login em 2 etapas
router.post('/login/2fa', (req, res) => {
  let payload;
  try { payload = jwt.verify(String(req.body.tmpToken || ''), JWT_SECRET); }
  catch (_) { return res.status(401).json({ error: CODE_ERR }); }
  if (payload.scope !== '2fa') return res.status(401).json({ error: CODE_ERR });
  if (tooMany2fa(payload.id)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
  if (!user || !user.totp_enabled) return res.status(401).json({ error: CODE_ERR });

  const v = totp.verify(user.totp_secret, req.body.code, { lastStep: user.totp_last_step });
  if (!v.ok) return res.status(401).json({ error: CODE_ERR });
  db.prepare('UPDATE users SET totp_last_step = ? WHERE id = ?').run(v.step, user.id); // anti-replay
  res.json({ token: sign(user), user: publicUser(user) });
});

// ---------------- 2FA (TOTP) — ativação opcional pelo próprio usuário ----------------
// POST /api/auth/2fa/setup — gera secret PENDENTE (só ativa após confirmar um código)
router.post('/2fa/setup', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.totp_enabled) return res.status(409).json({ error: 'O 2FA já está ativo. Desative-o antes de reconfigurar.' });
  const secret = totp.generateSecret();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET totp_pending_secret = ?, totp_pending_expires = ? WHERE id = ?').run(secret, expires, user.id);
  res.json({ secret, otpauth: totp.otpauthURI(secret, user.email) });
});

// POST /api/auth/2fa/enable { code } — confirma o código do app e ativa
router.post('/2fa/enable', requireAuth, (req, res) => {
  if (tooMany2fa(req.user.id)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.totp_pending_secret || !user.totp_pending_expires || new Date(user.totp_pending_expires) < new Date())
    return res.status(400).json({ error: CODE_ERR });
  const v = totp.verify(user.totp_pending_secret, req.body.code, { lastStep: 0 });
  if (!v.ok) return res.status(400).json({ error: CODE_ERR });
  db.prepare(`UPDATE users SET totp_secret = totp_pending_secret, totp_enabled = 1, totp_last_step = ?,
    totp_pending_secret = NULL, totp_pending_expires = NULL WHERE id = ?`).run(v.step, user.id);
  res.json({ ok: true });
});

// POST /api/auth/2fa/disable { code } — exige um código válido do app para desativar
router.post('/2fa/disable', requireAuth, (req, res) => {
  if (tooMany2fa(req.user.id)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user.totp_enabled) return res.status(400).json({ error: CODE_ERR });
  const v = totp.verify(user.totp_secret, req.body.code, { lastStep: user.totp_last_step });
  if (!v.ok) return res.status(400).json({ error: CODE_ERR });
  db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_last_step = 0 WHERE id = ?').run(user.id);
  res.json({ ok: true });
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
  const row = db.prepare("SELECT * FROM auth_tokens WHERE token = ? AND kind = 'reset' AND used = 0").get(token);
  if (!row || new Date(row.expires_at) < new Date())
    return res.status(400).json({ error: 'Link inválido ou expirado. Solicite um novo.' });
  const owner = db.prepare('SELECT name, email FROM users WHERE id = ?').get(row.user_id) || {};
  const pw = validatePassword(password, { email: owner.email, name: owner.name });
  if (!pw.ok) return res.status(400).json({ error: pw.error });
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
