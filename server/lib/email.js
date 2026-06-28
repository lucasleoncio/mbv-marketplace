// Envio de e-mails via Resend. Sem RESEND_API_KEY, roda em "modo dev"
// (apenas registra no console), então o app funciona sem a chave.
const { EMAIL, APP_URL } = require('../config');

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (n) => BRL.format(Number(n) || 0);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function send(to, subject, html) {
  if (!EMAIL.resendKey) {
    console.log(`\n[email:dev] (sem RESEND_API_KEY) -> ${to}\n  Assunto: ${subject}\n`);
    return { dev: true };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + EMAIL.resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL.from, to: [to], subject, html })
    });
    if (!r.ok) { console.error('[email] Resend respondeu', r.status, await r.text()); return { ok: false }; }
    return await r.json();
  } catch (e) {
    console.error('[email] falha ao enviar:', e.message);
    return { ok: false };
  }
}

function layout(title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#f3f7f1;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e3e1d6">
      <div style="background:#0f3d2e;padding:20px 24px;color:#fff;font-size:18px;font-weight:700">🌱 MBV — Movimento Brasil Verde</div>
      <div style="padding:24px;color:#152019;font-size:15px;line-height:1.6">
        <h2 style="margin:0 0 12px;color:#0f3d2e">${esc(title)}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;background:#f3f7f1;color:#5d6f64;font-size:12px">Regenerar para produzir · <a href="${APP_URL}" style="color:#2f8f5b">${APP_URL.replace(/^https?:\/\//, '')}</a></div>
    </div>
  </div>`;
}

async function sendOrderConfirmation(user, order) {
  const items = (order.items || []).map(it =>
    `<tr><td style="padding:6px 0">${esc(it.name)} <span style="color:#5d6f64">× ${it.quantity}</span></td><td style="padding:6px 0;text-align:right">${money(it.price * it.quantity)}</td></tr>`
  ).join('');
  const body = `
    <p>Olá, ${esc((user.name || '').split(' ')[0])}! Recebemos o seu pedido <b>${esc(order.code)}</b>. 🎉</p>
    <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">${items}
      <tr><td style="padding:8px 0;border-top:1px solid #e3e1d6"><b>Total</b></td><td style="padding:8px 0;border-top:1px solid #e3e1d6;text-align:right"><b>${money(order.total)}</b></td></tr>
    </table>
    <p>Entrega para: ${esc(order.ship_name)} — ${esc(order.ship_city)}/${esc(order.ship_state)}.</p>
    <p style="margin-top:18px"><a href="${APP_URL}/pedido/${order.id}" style="background:#1f6e47;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">Ver meu pedido</a></p>`;
  return send(user.email, `Pedido ${order.code} confirmado — MBV`, layout('Pedido confirmado!', body));
}

async function sendPasswordReset(user, link) {
  const body = `<p>Olá, ${esc((user.name || '').split(' ')[0])}. Recebemos um pedido para redefinir sua senha.</p>
    <p style="margin:18px 0"><a href="${esc(link)}" style="background:#1f6e47;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">Redefinir senha</a></p>
    <p style="color:#5d6f64;font-size:13px">Se não foi você, ignore este e-mail. O link expira em 1 hora.</p>`;
  return send(user.email, 'Redefinir senha — MBV', layout('Redefinição de senha', body));
}

async function sendVerification(user, link) {
  const body = `<p>Olá, ${esc((user.name || '').split(' ')[0])}! Confirme seu e-mail para ativar sua conta no MBV.</p>
    <p style="margin:18px 0"><a href="${esc(link)}" style="background:#1f6e47;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">Confirmar e-mail</a></p>
    <p style="color:#5d6f64;font-size:13px">Se não foi você, ignore este e-mail.</p>`;
  return send(user.email, 'Confirme seu e-mail — MBV', layout('Bem-vindo ao MBV 🌱', body));
}

async function sendOrderShipped(user, order) {
  const body = `<p>Olá, ${esc((user.name || '').split(' ')[0])}! Boas notícias: o seu pedido <b>${esc(order.code)}</b> foi <b>enviado</b> e está a caminho de ${esc(order.ship_city)}/${esc(order.ship_state)}. 🚚</p>
    <p style="margin-top:18px"><a href="${APP_URL}/pedido/${order.id}" style="background:#1f6e47;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">Acompanhar pedido</a></p>`;
  return send(user.email, `Seu pedido ${order.code} foi enviado — MBV`, layout('Pedido a caminho 🚚', body));
}

async function sendOrderDelivered(user, order) {
  const first = (order.items && order.items[0]) ? order.items[0].product_id : '';
  const body = `<p>Olá, ${esc((user.name || '').split(' ')[0])}! Seu pedido <b>${esc(order.code)}</b> foi marcado como <b>entregue</b>. Esperamos que goste! 🌱</p>
    <p>Que tal avaliar o que você recebeu? Sua opinião ajuda outros produtores — e quem comprou ganha o selo de <b>compra verificada</b>.</p>
    <p style="margin-top:18px"><a href="${APP_URL}/produto/${first}" style="background:#1f6e47;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">Avaliar produto</a></p>`;
  return send(user.email, `Seu pedido ${order.code} foi entregue — avalie e ajude 🌱`, layout('Pedido entregue!', body));
}

async function sendAbandonedCart(user, items) {
  const list = (items || []).map(it =>
    `<tr><td style="padding:6px 0">${esc(it.name)} <span style="color:#5d6f64">× ${it.quantity}</span></td><td style="padding:6px 0;text-align:right">${money(it.price * it.quantity)}</td></tr>`
  ).join('');
  const body = `<p>Olá, ${esc((user.name || '').split(' ')[0])}! Você deixou itens no carrinho do MBV — guardamos para você. 🌱</p>
    <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px">${list}</table>
    <p>Pagando com <b>Neutrotan (NTR)</b> você ganha <b>5% de desconto + cashback</b>.</p>
    <p style="margin-top:18px"><a href="${APP_URL}/carrinho" style="background:#1f6e47;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600">Voltar ao carrinho</a></p>`;
  return send(user.email, 'Seu carrinho está esperando 🌱 — MBV', layout('Você esqueceu algo no carrinho', body));
}

module.exports = { send, sendOrderConfirmation, sendPasswordReset, sendVerification, sendOrderShipped, sendOrderDelivered, sendAbandonedCart };
