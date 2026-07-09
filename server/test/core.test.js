// Testes do núcleo financeiro do MBV (frete, conversão NTR e totais do checkout).
// Rode com:  npm test
const test = require('node:test');
const assert = require('node:assert');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Isola o banco num diretório temporário (pricing carrega o db ao ser importado).
process.env.MBV_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mbvtest-'));

const { freightForCep } = require('../lib/shipping');
const chain = require('../lib/chain');
const { computeTotals } = require('../lib/pricing');
const { ethers } = require('ethers');

test('frete: grátis acima de R$ 500', () => {
  assert.equal(freightForCep('01001000', 500), 0);
  assert.equal(freightForCep('01001000', 750), 0);
});

test('frete: por região e fallback sem CEP', () => {
  assert.equal(freightForCep('01001000', 100), 24.9); // região 0 (SP capital)
  assert.equal(freightForCep('88010000', 100), 27.9); // região 8 (SC)
  assert.equal(freightForCep('', 100), 29.9);          // sem CEP → frete padrão
});

test('NTR: toBaseUnits usa 18 casas decimais', () => {
  assert.equal(chain.toBaseUnits(1).toString(), '1000000000000000000');
  assert.equal(chain.toBaseUnits(2.5).toString(), '2500000000000000000');
});

test('NTR: extractTransferToStore soma só as transferências para a loja', () => {
  const token = '0x' + '1'.repeat(40);
  const store = '0x' + '2'.repeat(40);
  const outro = '0x' + '3'.repeat(40);
  const from = '0x' + '4'.repeat(40);
  const sig = ethers.id('Transfer(address,address,uint256)');
  const mk = (to, value) => ({
    address: token,
    topics: [sig, ethers.zeroPadValue(from, 32), ethers.zeroPadValue(to, 32)],
    data: ethers.toBeHex(value, 32)
  });
  const logs = [mk(store, 1000n), mk(outro, 500n), mk(store, 234n)];
  const { total } = chain.extractTransferToStore(logs, token, store);
  assert.equal(total, 1234n); // ignora a transferência para "outro"
});

test('totais: subtotal, frete por região e cashback', async () => {
  const t = await computeTotals([{ price: 100, quantity: 2 }], null, 'card', '88010000', '');
  assert.equal(t.subtotal, 200);
  assert.equal(t.shipping, 27.9);
  assert.equal(t.discount, 0);
  assert.ok(t.cashbackMbv > 0);
});

test('totais: 5% de desconto pagando em NTR', async () => {
  const t = await computeTotals([{ price: 100, quantity: 2 }], null, 'mbv', '88010000', '');
  assert.equal(t.cryptoDiscount, 10); // 5% de 200
});

test('totais: frete grátis acima de R$ 500', async () => {
  const t = await computeTotals([{ price: 600, quantity: 1 }], null, 'card', '88010000', '');
  assert.equal(t.shipping, 0);
});
