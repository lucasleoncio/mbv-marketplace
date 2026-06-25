// Razão (ledger) do token Neutrotan (NTR) — credita/debita saldo e registra transação.
const db = require('../db');

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Gera um endereço de carteira simulado (estilo 0x...) só para visual/demonstração.
function makeWalletAddress() {
  const hex = '0123456789abcdef';
  let a = '0x';
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

// Movimenta o saldo. amount > 0 credita, < 0 debita. Retorna o novo saldo.
function move(userId, amount, type, description, ref) {
  amount = round2(amount);
  const user = db.prepare('SELECT mbv_balance FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('Usuário não encontrado');
  const newBalance = round2(user.mbv_balance + amount);
  if (newBalance < -0.000001) {
    const err = new Error('Saldo de NTR insuficiente');
    err.code = 'INSUFFICIENT_FUNDS';
    throw err;
  }
  db.prepare('UPDATE users SET mbv_balance = ? WHERE id = ?').run(newBalance, userId);
  db.prepare(
    'INSERT INTO transactions (user_id, type, amount, balance_after, description, ref) VALUES (?,?,?,?,?,?)'
  ).run(userId, type, amount, newBalance, description || '', ref || '');
  return newBalance;
}

function history(userId, limit = 50) {
  return db.prepare(
    'SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).all(userId, limit);
}

module.exports = { move, history, makeWalletAddress, round2 };
