// Assinatura HMAC do webhook Mercado Pago — a porta de entrada de dinheiro real.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');

process.env.MBV_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mbvtest-'));

const { MP } = require('../config');
const { validSignature } = require('../routes/webhooks');

function makeReq(secret, { tamper = false, missing = false } = {}) {
  const ts = '1700000000', dataId = '12345', reqId = 'req-abc';
  const manifest = `id:${dataId};request-id:${reqId};ts:${ts};`;
  let v1 = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  if (tamper) v1 = v1.replace(/^./, v1[0] === 'a' ? 'b' : 'a');
  return {
    headers: missing ? {} : { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId },
    query: { type: 'payment', 'data.id': dataId },
    body: {}
  };
}

test('sem secret configurado (demo): aceita — comportamento preservado', () => {
  MP.webhookSecret = '';
  assert.equal(validSignature(makeReq('qualquer')), true);
});

test('com secret: assinatura válida passa', () => {
  MP.webhookSecret = 'segredo-mp-teste';
  assert.equal(validSignature(makeReq('segredo-mp-teste')), true);
});

test('com secret: assinatura adulterada é recusada', () => {
  MP.webhookSecret = 'segredo-mp-teste';
  assert.equal(validSignature(makeReq('segredo-mp-teste', { tamper: true })), false);
});

test('com secret: assinada com outro segredo é recusada', () => {
  MP.webhookSecret = 'segredo-mp-teste';
  assert.equal(validSignature(makeReq('segredo-errado')), false);
});

test('com secret: headers ausentes são recusados', () => {
  MP.webhookSecret = 'segredo-mp-teste';
  assert.equal(validSignature(makeReq('segredo-mp-teste', { missing: true })), false);
});
