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
    // Cotação SIMULADA usada no app. Em produção, busque a cotação on-chain / DEX.
    brlPerToken: 1.0, // 1 NTR = R$ 1,00 (cotação simulada)
    // Desconto de incentivo ao pagar com NTR
    cryptoDiscountPct: 0.05, // 5%
    // Bônus de boas-vindas creditado a novos clientes
    welcomeBonus: 150, // 150 NTR
    // Cashback padrão (em NTR) sobre o valor pago — fidelização
    cashbackPct: 0.02 // 2% do total vira NTR
  },

  // --- Frete ---
  SHIPPING: {
    flat: 29.9, // frete padrão
    freeAbove: 500 // frete grátis acima de R$ 500
  }
};
