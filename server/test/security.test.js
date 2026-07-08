// Segurança: política de senha (NIST), validação de CPF/CNPJ e TOTP (RFC 6238).
const test = require('node:test');
const assert = require('node:assert');

const { validatePassword } = require('../lib/password');
const { validCpfCnpj } = require('../lib/doc');
const totp = require('../lib/totp');

test('senha: curta, comum e contendo nome/e-mail são recusadas', () => {
  assert.equal(validatePassword('abc123').ok, false); // curta
  assert.equal(validatePassword('12345678').ok, false); // comum
  assert.equal(validatePassword('senha123').ok, false); // comum
  assert.equal(validatePassword('cliente123').ok, false); // comum (blocklist)
  assert.equal(validatePassword('lucas2026!', { name: 'Lucas Santos' }).ok, false); // contém nome
  assert.equal(validatePassword('joao.silva99', { email: 'joao.silva@x.com' }).ok, false); // contém e-mail
  assert.equal(validatePassword('a'.repeat(65)).ok, false); // longa demais
});

test('senha: combinações razoáveis passam (sem composição forçada — NIST)', () => {
  assert.equal(validatePassword('trator verde 42').ok, true); // frase-senha
  assert.equal(validatePassword('K7#mQp2vX!').ok, true);
  assert.equal(validatePassword('produtividade-soja-2026').ok, true);
});

test('CPF: dígitos verificadores', () => {
  assert.equal(validCpfCnpj('529.982.247-25'), true); // válido (exemplo clássico)
  assert.equal(validCpfCnpj('52998224726'), false);   // DV errado
  assert.equal(validCpfCnpj('111.111.111-11'), false); // repetido
  assert.equal(validCpfCnpj('123'), false);            // tamanho errado
});

test('CNPJ: dígitos verificadores', () => {
  assert.equal(validCpfCnpj('11.222.333/0001-81'), true); // válido (exemplo clássico)
  assert.equal(validCpfCnpj('11222333000182'), false);    // DV errado
  assert.equal(validCpfCnpj('11111111111111'), false);    // repetido
});

test('TOTP: vetor de teste do RFC 6238 (SHA-1, T=59s → 287082)', () => {
  // Secret ASCII "12345678901234567890" em Base32:
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const counter = Math.floor(59 / 30); // = 1
  assert.equal(totp.hotp(secret, counter), '287082');
});

test('TOTP: verify aceita janela ±1 e bloqueia replay', () => {
  const secret = totp.generateSecret();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const now = Date.now();
  const cur = totp.stepAt(now);

  // código do passo atual é aceito
  const v1 = totp.verify(secret, totp.hotp(secret, cur), { lastStep: 0, now });
  assert.equal(v1.ok, true);
  assert.equal(v1.step, cur);

  // REPLAY do mesmo código: recusado (step não avança)
  const replay = totp.verify(secret, totp.hotp(secret, cur), { lastStep: v1.step, now });
  assert.equal(replay.ok, false);

  // janela +1 (relógio do celular adiantado) é aceita e avança o step
  const v2 = totp.verify(secret, totp.hotp(secret, cur + 1), { lastStep: v1.step, now });
  assert.equal(v2.ok, true);
  assert.equal(v2.step, cur + 1);

  // código de 2 passos atrás: fora da janela
  assert.equal(totp.verify(secret, totp.hotp(secret, cur - 2), { lastStep: 0, now }).ok, false);
  // lixo não passa
  assert.equal(totp.verify(secret, '000000', { lastStep: 0, now }).ok || false, totp.hotp(secret, cur) === '000000' || totp.hotp(secret, cur - 1) === '000000' || totp.hotp(secret, cur + 1) === '000000');
});
