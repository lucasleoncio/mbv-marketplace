// Integração com Mercado Pago (Checkout Pro). Ativa quando MP_ACCESS_TOKEN existir.
// O cliente é direcionado ao ambiente seguro do MP (cartão, Pix, boleto) e o
// pagamento é confirmado pelo webhook. Não tratamos dados de cartão aqui.
const { MP, APP_URL } = require('../config');
const BASE = 'https://api.mercadopago.com';

// Cria uma preferência de pagamento e devolve a URL para redirecionar o cliente.
async function createPreference(order, user, method) {
  // Restringe os meios conforme a escolha do cliente (cartão x Pix).
  const excluded = method === 'pix'
    ? [{ id: 'credit_card' }, { id: 'debit_card' }, { id: 'ticket' }]
    : method === 'card'
      ? [{ id: 'ticket' }, { id: 'bank_transfer' }]
      : [];

  const body = {
    // Uma linha única com o total garante que o valor cobrado = total do pedido (com descontos/frete).
    items: [{ title: `Pedido ${order.code} — MBV`, quantity: 1, unit_price: Math.round(order.total * 100) / 100, currency_id: 'BRL' }],
    payer: { name: user.name, email: user.email },
    external_reference: String(order.id),
    statement_descriptor: 'MBV',
    back_urls: {
      success: `${APP_URL}/pedido/${order.id}`,
      pending: `${APP_URL}/pedido/${order.id}`,
      failure: `${APP_URL}/pedido/${order.id}`
    },
    auto_return: 'approved',
    notification_url: `${APP_URL}/api/webhooks/mercadopago`,
    payment_methods: { excluded_payment_types: excluded, installments: 12 }
  };

  const r = await fetch(`${BASE}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + MP.accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Mercado Pago: ' + (await r.text()));
  const d = await r.json();
  return { id: d.id, redirect: MP.sandbox ? (d.sandbox_init_point || d.init_point) : d.init_point };
}

// Consulta um pagamento (usado pelo webhook para confirmar o status de forma segura).
async function getPayment(paymentId) {
  const r = await fetch(`${BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: 'Bearer ' + MP.accessToken }
  });
  if (!r.ok) return null;
  return r.json();
}

module.exports = { createPreference, getPayment };
