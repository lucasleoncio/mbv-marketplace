// Cálculo de totais do carrinho/checkout — centraliza cupom, frete e desconto cripto.
const db = require('../db');
const { SHIPPING, TOKEN } = require('../config');
const { freightForCep } = require('./shipping');

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

// Carrega os itens do carrinho do usuário com dados do produto.
function getCartItems(userId) {
  return db.prepare(`
    SELECT ci.product_id, ci.quantity, p.name, p.price, p.unit, p.image, p.stock, p.active
    FROM cart_items ci JOIN products p ON p.id = ci.product_id
    WHERE ci.user_id = ? ORDER BY ci.id
  `).all(userId);
}

// Valida e retorna um cupom ativo (ou null).
function getCoupon(code) {
  if (!code) return null;
  return db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(String(code).toUpperCase().trim()) || null;
}

// Calcula todos os valores. paymentMethod: 'card' | 'pix' | 'mbv'. cep: frete por região. cpf: valida cupom restrito.
function computeTotals(items, couponCode, paymentMethod, cep, cpf) {
  const subtotal = round2(items.reduce((s, it) => s + it.price * it.quantity, 0));

  let couponDiscount = 0;
  let coupon = getCoupon(couponCode);
  let couponError = null;
  if (couponCode && !coupon) couponError = 'Cupom inválido ou expirado.';
  if (coupon) {
    const doc = String(cpf || '').replace(/\D/g, '');
    if (coupon.cpf_cnpj && String(coupon.cpf_cnpj).replace(/\D/g, '') !== doc) {
      couponError = 'Cupom exclusivo para um CPF/CNPJ específico.';
      coupon = null;
    } else if (subtotal < coupon.min_subtotal) {
      couponError = `Este cupom exige um subtotal mínimo de R$ ${coupon.min_subtotal.toFixed(2)}.`;
      coupon = null;
    } else if (coupon.type === 'percent') {
      couponDiscount = round2(subtotal * (coupon.value / 100));
    } else {
      couponDiscount = Math.min(subtotal, round2(coupon.value));
    }
  }

  // Desconto adicional ao pagar com MBV Coin (cripto própria)
  const cryptoDiscount = paymentMethod === 'mbv'
    ? round2((subtotal - couponDiscount) * TOKEN.cryptoDiscountPct) : 0;

  const discount = round2(couponDiscount + cryptoDiscount);
  const afterDiscount = round2(subtotal - discount);
  const shipping = items.length === 0 ? 0 : freightForCep(cep, afterDiscount);
  const total = round2(afterDiscount + shipping);

  // Equivalente em MBV e cashback (em MBV Coin)
  const mbvAmount = round2(total / TOKEN.brlPerToken);
  const cashbackMbv = round2(total * TOKEN.cashbackPct + (coupon ? coupon.cashback_mbv : 0));

  return {
    subtotal, couponDiscount, cryptoDiscount, discount, shipping, total,
    mbvAmount, cashbackMbv,
    coupon: coupon ? { code: coupon.code, description: coupon.description } : null,
    couponError,
    rate: TOKEN.brlPerToken
  };
}

module.exports = { getCartItems, getCoupon, computeTotals, round2 };
