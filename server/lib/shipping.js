// Cálculo de frete por CEP (tabela por região). Em produção, troque por uma
// integração real (Correios/Melhor Envio) usando peso e dimensões dos produtos.
const { SHIPPING } = require('../config');

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// afterDiscount = subtotal - descontos. Acima do limite, frete grátis.
function freightForCep(cep, afterDiscount) {
  if (afterDiscount >= SHIPPING.freeAbove) return 0;
  const digits = String(cep || '').replace(/\D/g, '');
  const region = digits[0];
  const value = (region && SHIPPING.byRegion[region] != null) ? SHIPPING.byRegion[region] : SHIPPING.flat;
  return round2(value);
}

module.exports = { freightForCep };
