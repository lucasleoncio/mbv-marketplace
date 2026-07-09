// Edge cases de cupons e teto de desconto (proteção de margem).
// MAX_DISCOUNT_PCT=0.10 é definido ANTES do require para exercitar o cap.
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.MBV_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mbvtest-'));
process.env.MAX_DISCOUNT_PCT = '0.10'; // teto de 10% p/ testar a proteção de margem

const db = require('../db');
const { ensureSeed } = require('../seed');
const { computeTotals } = require('../lib/pricing');

const items = [{ price: 100, quantity: 2 }]; // subtotal 200

test.before(async () => {
  await ensureSeed();
  // Cupons controlados pelos testes (colunas cpf_cnpj/affiliate existem no schema)
  const ins = db.prepare('INSERT INTO coupons (code, type, value, description, min_subtotal, cashback_mbv, cpf_cnpj, active) VALUES (?,?,?,?,?,?,?,1)');
  await ins.run('QAPCT10', 'percent', 10, 'teste 10%', 0, 0, null);
  await ins.run('QAFIXO500', 'fixed', 500, 'teste fixo alto', 0, 0, null);
  await ins.run('QAMIN300', 'percent', 5, 'teste mínimo', 300, 0, null);
  await ins.run('QACPF', 'percent', 15, 'teste cpf', 0, 0, '11122233344');
});

test('cupom inexistente: erro amigável e nenhum desconto', async () => {
  const t = await computeTotals(items, 'NAOEXISTE', 'card', '01001000', '');
  assert.equal(t.couponError, 'Cupom inválido ou expirado.');
  assert.equal(t.discount, 0);
});

test('cupom percentual: aplica sobre o subtotal', async () => {
  const t = await computeTotals(items, 'QAPCT10', 'card', '01001000', '');
  assert.equal(t.couponDiscount, 20); // 10% de 200
  assert.equal(t.coupon.code, 'QAPCT10');
});

test('cupom fixo maior que o subtotal: limitado ao subtotal (total nunca negativo)', async () => {
  const t = await computeTotals(items, 'QAFIXO500', 'card', '01001000', '');
  assert.equal(t.couponDiscount, 200);
  assert.ok(t.total >= 0);
});

test('cupom com subtotal mínimo: rejeita abaixo do piso', async () => {
  const t = await computeTotals(items, 'QAMIN300', 'card', '01001000', '');
  assert.match(t.couponError, /subtotal mínimo/);
  assert.equal(t.couponDiscount, 0);
});

test('cupom restrito a CPF: só vale com o documento certo', async () => {
  const errado = await computeTotals(items, 'QACPF', 'card', '01001000', '99988877766');
  assert.match(errado.couponError, /exclusivo/);
  assert.equal(errado.couponDiscount, 0);

  const certo = await computeTotals(items, 'QACPF', 'card', '01001000', '111.222.333-44'); // aceita máscara
  assert.equal(certo.couponError, null);
  assert.equal(certo.couponDiscount, 30); // 15% de 200
});

test('teto de margem (MAX_DISCOUNT_PCT): corta o desconto NTR quando o cupom já atinge o cap', async () => {
  // cap = 10% de 200 = R$ 20. Cupom de 10% já consome o teto -> desconto NTR zera.
  const t = await computeTotals(items, 'QAPCT10', 'mbv', '01001000', '');
  assert.equal(t.couponDiscount, 20);
  assert.equal(t.cryptoDiscount, 0, 'desconto NTR deve ser cortado pelo teto');
  assert.equal(t.discount, 20);
});

test('sem cupom, NTR respeita o teto: 5% <= 10% aplica integral', async () => {
  const t = await computeTotals(items, null, 'mbv', '01001000', '');
  assert.equal(t.cryptoDiscount, 10); // 5% de 200, abaixo do cap de 20
});
