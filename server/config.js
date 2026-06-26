// Configurações centrais do MBV Marketplace
// Em produção, mova segredos para variáveis de ambiente (.env).
module.exports = {
  PORT: process.env.PORT || 4000,

  // Segredo do JWT. TROQUE em produção (use uma string longa e aleatória).
  JWT_SECRET: process.env.JWT_SECRET || 'mbv-troque-este-segredo-em-producao-2026',
  JWT_EXPIRES: '7d',

  // --- Economia do token Neutrotan (NTR) — utility token do MBV ---
  // Token: "Neutrotan" (NTR) — ERC-20 na rede Polygon, com lastro real no "cote".
  TOKEN: {
    name: 'Neutrotan',
    symbol: 'NTR',
    network: 'Polygon (ERC-20)',
    backing: 'Lastro real em cote (composto orgânico)',
    platform: 'neutrotan.com',
    // Cotação FIXA do NTR (valor de referência do whitepaper). Ajustável por env.
    brlPerToken: Number(process.env.RATE_BRL_PER_NTR || 9.36), // 1 NTR = R$ 9,36
    // Desconto de incentivo ao pagar com NTR
    cryptoDiscountPct: 0.05, // 5%
    // Bônus de boas-vindas creditado a novos clientes
    welcomeBonus: 150, // 150 NTR
    // Cashback padrão (em NTR) sobre o valor pago — fidelização
    cashbackPct: 0.02 // 2% do total vira NTR
  },

  // --- Frete ---
  SHIPPING: {
    flat: 29.9, // frete padrão (fallback quando não há CEP)
    freeAbove: 500, // frete grátis acima de R$ 500
    // Frete por região, pelo 1º dígito do CEP (ajustável). Origem aprox. Sul/Sudeste.
    byRegion: { '0': 24.9, '1': 24.9, '8': 27.9, '9': 29.9, '2': 32.9, '3': 34.9, '4': 39.9, '5': 42.9, '6': 49.9, '7': 46.9 }
  },

  // URL pública do app (usada em links de e-mail e retornos de pagamento)
  APP_URL: process.env.APP_URL || 'https://mbv-marketplace.onrender.com',

  // --- E-mail (Resend) — ativa automaticamente quando RESEND_API_KEY existir ---
  EMAIL: {
    resendKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'MBV — Movimento Brasil Verde <onboarding@resend.dev>'
  },

  // --- Pagamento on-chain do NTR (rede Polygon) ---
  // Sem NTR_CONTRACT + STORE_WALLET o app fica em modo SIMULADO (saldo interno).
  // Preenchendo essas variáveis, o checkout em NTR vira pagamento real on-chain.
  // Padrão = testnet Polygon Amoy (sem dinheiro real). Mainnet: CHAIN_ID=137 etc.
  CHAIN: {
    chainId: Number(process.env.CHAIN_ID || 80002),                 // 80002 = Amoy (testnet) · 137 = Polygon mainnet
    name: process.env.CHAIN_NAME || 'Polygon Amoy (testnet)',
    rpcUrl: process.env.RPC_URL || 'https://rpc-amoy.polygon.technology',
    explorer: process.env.EXPLORER_URL || 'https://amoy.polygonscan.com',
    nativeSymbol: process.env.NATIVE_SYMBOL || 'POL',
    ntrContract: (process.env.NTR_CONTRACT || '').trim(),            // endereço 0x... do token NTR
    ntrDecimals: Number(process.env.NTR_DECIMALS || 18),
    storeWallet: (process.env.STORE_WALLET || '').trim(),            // carteira da loja que recebe o NTR
    minConfirmations: Number(process.env.MIN_CONFIRMATIONS || 2),
    feeToleranceNtr: Number(process.env.FEE_TOLERANCE_NTR || 0.02),  // tolera tarifa de 0,01 NTR/transação
    get onchainEnabled() { return !!(this.ntrContract && this.storeWallet); }
  }
};
