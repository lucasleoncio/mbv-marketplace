const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const wallet = require('../lib/wallet');
const { TOKEN } = require('../config');

const router = express.Router();
router.use(requireAuth);

// GET /api/wallet -> saldo, endereço, cotação e extrato
router.get('/', (req, res) => {
  const u = db.prepare('SELECT mbv_balance, wallet_address FROM users WHERE id = ?').get(req.user.id);
  res.json({
    balance: u.mbv_balance,
    balance_brl: Math.round(u.mbv_balance * TOKEN.brlPerToken * 100) / 100,
    address: u.wallet_address,
    token: TOKEN,
    transactions: wallet.history(req.user.id, 100)
  });
});

// POST /api/wallet/topup { amount_brl }  -> compra de MBV Coin (on-ramp SIMULADO)
// Em produção, este crédito só ocorre após confirmação real de pagamento (cartão/Pix) pelo gateway.
router.post('/topup', (req, res) => {
  const brl = Number(req.body.amount_brl);
  if (!brl || brl < 10) return res.status(400).json({ error: 'Valor mínimo de recarga: R$ 10,00.' });
  if (brl > 100000) return res.status(400).json({ error: 'Valor acima do limite por recarga.' });
  const tokens = Math.round((brl / TOKEN.brlPerToken) * 100) / 100;
  const newBalance = wallet.move(req.user.id, tokens, 'topup',
    `Recarga de R$ ${brl.toFixed(2)} → ${tokens} NTR`, 'topup');
  res.status(201).json({ balance: newBalance, credited: tokens });
});

module.exports = router;
