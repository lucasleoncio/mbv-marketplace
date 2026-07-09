// Ledger interno do NTR (lib/wallet): crédito, débito, saldo insuficiente e extrato.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.MBV_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mbvtest-'));

const db = require('../db');
const { ensureSeed } = require('../seed');
const wallet = require('../lib/wallet');

let user;
const balance = async () => (await db.prepare('SELECT mbv_balance FROM users WHERE id = ?').get(user.id)).mbv_balance;

test.before(async () => {
  await ensureSeed();
  user = await db.prepare("SELECT id, mbv_balance FROM users WHERE email = 'cliente@mbv.com'").get();
});

test('crédito e débito atualizam o saldo com arredondamento de 2 casas', async () => {
  const b0 = await balance();
  const b1 = await wallet.move(user.id, 10.555, 'topup', 'teste crédito', 't1'); // arredonda p/ 10.56
  assert.equal(b1, Math.round((b0 + 10.56) * 100) / 100);
  const b2 = await wallet.move(user.id, -0.56, 'purchase', 'teste débito', 't2');
  assert.equal(b2, Math.round((b1 - 0.56) * 100) / 100);
});

test('débito maior que o saldo: INSUFFICIENT_FUNDS e saldo intacto', async () => {
  const antes = await balance();
  await assert.rejects(
    () => wallet.move(user.id, -(antes + 1000), 'purchase', 'não pode', 't3'),
    (e) => e.code === 'INSUFFICIENT_FUNDS'
  );
  assert.equal(await balance(), antes, 'saldo não pode mudar quando o débito falha');
});

test('extrato: registra transações na ordem inversa com balance_after coerente', async () => {
  const h = await wallet.history(user.id, 5);
  assert.ok(h.length >= 2);
  assert.equal(h[0].balance_after, await balance());
});

test('usuário inexistente: erro claro', async () => {
  await assert.rejects(() => wallet.move(999999, 1, 'topup', 'x', 'x'), /Usuário não encontrado/);
});

test('makeWalletAddress: formato 0x + 40 hex', () => {
  assert.match(wallet.makeWalletAddress(), /^0x[0-9a-f]{40}$/);
});
