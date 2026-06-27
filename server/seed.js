// Popula o banco com dados de demonstração do MBV (catálogo eco-agro, cupons, admin e cliente).
const bcrypt = require('bcryptjs');
const db = require('./db');
const wallet = require('./lib/wallet');

const CATEGORIES = [
  { name: 'Fertilizantes & Condicionadores', slug: 'fertilizantes', icon: 'leaf', description: 'Nutrição orgânica que regenera o solo.' },
  { name: 'Defensivos Biológicos', slug: 'defensivos', icon: 'shield', description: 'Controle de pragas sem agrotóxicos.' },
  { name: 'Bioestimulantes & Inoculantes', slug: 'bioestimulantes', icon: 'sprout', description: 'Mais produtividade com biologia do solo.' },
  { name: 'Sementes & Mudas', slug: 'sementes', icon: 'seed', description: 'Sementes de cobertura e mudas nativas.' },
  { name: 'Manejo de Solo & Água', slug: 'solo-agua', icon: 'drop', description: 'Compostos, irrigação e correção de solo.' },
  { name: 'Energia & Sustentabilidade', slug: 'sustentabilidade', icon: 'sun', description: 'Energia limpa e agricultura de precisão.' }
];

const PRODUCTS = [
  { name: 'Eutroterra — Condicionador de Solo Orgânico', cat: 'fertilizantes', price: 1290, compare: 1490, stock: 120, unit: 'L', pack: 'Bombona 16 litros', co2: 12, featured: 1,
    badges: ['Orgânico', 'Carbono Neutro', 'Biodegradável'],
    desc: 'Condicionador líquido que recupera a estrutura e a vida microbiológica do solo. Produto-núcleo da linha MBV, indicado para grandes culturas e recuperação de áreas degradadas.' },
  { name: 'Neutrotan — Neutralizador de Acidez Biológico', cat: 'defensivos', price: 740, compare: 0, stock: 90, unit: 'L', pack: 'Bombona 20 litros', co2: 8, featured: 1,
    badges: ['Biológico', 'Sem Resíduos'],
    desc: 'Solução biológica para neutralização de acidez e equilíbrio do solo, sem deixar resíduos químicos. Compatível com manejo orgânico e regenerativo.' },
  { name: 'Biofertilizante Líquido Premium', cat: 'fertilizantes', price: 320, compare: 380, stock: 200, unit: 'L', pack: 'Galão 5 litros', co2: 4, featured: 0,
    badges: ['Orgânico', 'Concentrado'], desc: 'Fonte completa de nutrientes e ácidos húmicos para pulverização foliar e fertirrigação.' },
  { name: 'Fertilizante Foliar NPK Orgânico', cat: 'fertilizantes', price: 189.9, compare: 0, stock: 150, unit: 'L', pack: 'Galão 5 litros', co2: 3, featured: 0,
    badges: ['Vegano', 'Orgânico'], desc: 'Equilíbrio de macro e micronutrientes de origem vegetal para todas as fases da cultura.' },
  { name: 'Inoculante de Nitrogênio (Rhizobium)', cat: 'bioestimulantes', price: 145, compare: 0, stock: 80, unit: 'un', pack: 'Dose para 1 hectare', co2: 6, featured: 0,
    badges: ['Fixação de N₂'], desc: 'Bactérias fixadoras de nitrogênio que reduzem a necessidade de adubo nitrogenado.' },
  { name: 'Bioestimulante de Enraizamento', cat: 'bioestimulantes', price: 215, compare: 250, stock: 110, unit: 'L', pack: 'Frasco 1 litro', co2: 2, featured: 0,
    badges: ['Concentrado'], desc: 'Promove enraizamento vigoroso e maior tolerância a estresses hídricos.' },
  { name: 'Defensivo Biológico — Controle de Pragas', cat: 'defensivos', price: 410, compare: 0, stock: 70, unit: 'L', pack: 'Galão 5 litros', co2: 5, featured: 0,
    badges: ['Biológico', 'Seletivo'], desc: 'Microorganismos benéficos para controle seletivo de pragas, preservando polinizadores.' },
  { name: 'Composto Orgânico Premium', cat: 'solo-agua', price: 89.9, compare: 0, stock: 300, unit: 'kg', pack: 'Saco 25 kg', co2: 7, featured: 0,
    badges: ['Compostagem', 'Orgânico'], desc: 'Matéria orgânica estabilizada que melhora retenção de água e fertilidade.' },
  { name: 'Húmus de Minhoca Peneirado', cat: 'solo-agua', price: 59.9, compare: 75, stock: 250, unit: 'kg', pack: 'Saco 20 kg', co2: 4, featured: 0,
    badges: ['Orgânico'], desc: 'Adubo natural rico em nutrientes e microbiologia, pronto para uso.' },
  { name: 'Sementes de Adubo Verde (Crotalária)', cat: 'sementes', price: 129, compare: 0, stock: 180, unit: 'kg', pack: 'Saco 10 kg', co2: 9, featured: 0,
    badges: ['Recuperação de Solo'], desc: 'Fixa nitrogênio, descompacta o solo e quebra ciclos de pragas e doenças.' },
  { name: 'Mix de Sementes de Cobertura', cat: 'sementes', price: 99.9, compare: 0, stock: 160, unit: 'kg', pack: 'Saco 5 kg', co2: 6, featured: 0,
    badges: ['Cobertura', 'Biodiversidade'], desc: 'Combinação de espécies para proteção do solo e aumento de biodiversidade.' },
  { name: 'Mudas Nativas para Reflorestamento', cat: 'sementes', price: 349, compare: 0, stock: 60, unit: 'un', pack: 'Caixa com 50 mudas', co2: 50, featured: 0,
    badges: ['Reflorestamento', 'Carbono Neutro'], desc: 'Mudas de espécies nativas para recomposição de reserva legal e APPs.' },
  { name: 'Painel Solar Agrícola 550W', cat: 'sustentabilidade', price: 1180, compare: 1350, stock: 40, unit: 'un', pack: '1 painel', co2: 120, featured: 1,
    badges: ['Energia Limpa'], desc: 'Painel fotovoltaico de alta eficiência para eletrificação rural e bombeamento.' },
  { name: 'Bomba de Irrigação Solar', cat: 'sustentabilidade', price: 2390, compare: 0, stock: 25, unit: 'un', pack: 'Kit completo', co2: 200, featured: 0,
    badges: ['Energia Limpa', 'Economia de Água'], desc: 'Bombeamento movido a energia solar, zero custo de combustível e emissões.' },
  { name: 'Kit Irrigação por Gotejamento (500 m)', cat: 'solo-agua', price: 459, compare: 520, stock: 90, unit: 'un', pack: 'Rolo 500 m', co2: 10, featured: 0,
    badges: ['Economia de Água'], desc: 'Sistema de gotejamento que reduz o consumo de água em até 60%.' },
  { name: 'Adjuvante Agrícola Biodegradável', cat: 'defensivos', price: 134.9, compare: 0, stock: 140, unit: 'L', pack: 'Galão 5 litros', co2: 2, featured: 0,
    badges: ['Biodegradável'], desc: 'Melhora a aderência e a eficiência das pulverizações, sem toxicidade.' },
  { name: 'Sensor de Umidade do Solo (IoT)', cat: 'sustentabilidade', price: 289, compare: 0, stock: 75, unit: 'un', pack: '1 sensor + app', co2: 15, featured: 1,
    badges: ['Agricultura de Precisão'], desc: 'Monitore a umidade em tempo real e irrigue apenas o necessário.' },
  { name: 'Calcário Agrícola Dolomítico', cat: 'solo-agua', price: 45, compare: 0, stock: 400, unit: 'kg', pack: 'Saco 25 kg', co2: 1, featured: 0,
    badges: ['Correção de Solo'], desc: 'Correção de acidez e fornecimento de cálcio e magnésio.' },
  { name: 'Coin Max — Fertilizante Foliar Organomineral', cat: 'fertilizantes', price: 159.9, compare: 0, stock: 120, unit: 'L', pack: 'Frasco 1 litro', co2: 5, featured: 1,
    img: 'https://agroeda.com.br/images/produto.png',
    badges: ['Organomineral', 'Via Foliar', 'Registro MAPA'],
    desc: 'Fertilizante foliar organomineral de alta performance da Agroeda, parceira do MBV. Seu diferencial é o bioestimulante genético — uma fórmula ultraconcentrada de extratos vegetais orgânicos que estimula a fotossíntese e a absorção de nutrientes, elevando a produção em no mínimo 7% nas culturas foliares. Composto por extratos de algas e aminoácidos, favorece plantas mais vigorosas e tolerantes a estresses. Indicado para soja, milho, feijão, tomate, manga, morango, uva e outras. Garantias: N 4%, P₂O₅ 1%, B 1,5%, Mn 0,25%, Mo 0,5%, Zn 1,5% e COT 6%. Suspensão fluida homogênea (densidade 1,20 g/mL), Classe A, via foliar. Dose: 5 a 6 L/ha, aplicação única entre os estádios V4 e V6. Registro no MAPA RS-003872-5.000067. Também disponível em balde de 18 kg.' }
];

const COUPONS = [
  { code: 'COINMAX', type: 'percent', value: 10, description: 'Cupom Coinmax: 10% OFF + 20 MBV de cashback', min_subtotal: 0, cashback_mbv: 20 },
  { code: 'SAFRA15', type: 'percent', value: 15, description: '15% OFF em compras acima de R$ 500', min_subtotal: 500, cashback_mbv: 0 },
  { code: 'PLANTAR50', type: 'fixed', value: 50, description: 'R$ 50 OFF em compras acima de R$ 300', min_subtotal: 300, cashback_mbv: 0 }
];

function seed() {
  const insCat = db.prepare('INSERT INTO categories (name, slug, icon, description) VALUES (?,?,?,?)');
  const catId = {};
  for (const c of CATEGORIES) catId[c.slug] = insCat.run(c.name, c.slug, c.icon, c.description).lastInsertRowid;

  const insProd = db.prepare(`
    INSERT INTO products (name, slug, description, price, compare_at_price, category_id, stock, unit, pack_size, badges, featured, co2, image, rating, rating_count, active)
    VALUES (@name,@slug,@desc,@price,@compare,@cat,@stock,@unit,@pack,@badges,@featured,@co2,@image,@rating,@rc,1)
  `);
  for (const p of PRODUCTS) {
    insProd.run({
      name: p.name,
      slug: p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      desc: p.desc, price: p.price, compare: p.compare || null, cat: catId[p.cat], stock: p.stock,
      unit: p.unit, pack: p.pack, badges: JSON.stringify(p.badges || []), featured: p.featured || 0,
      co2: p.co2 || 0, image: p.img || null, rating: Math.round((4.2 + Math.random() * 0.7) * 10) / 10, rc: 8 + Math.floor(Math.random() * 90)
    });
  }

  const insCoupon = db.prepare('INSERT INTO coupons (code, type, value, description, min_subtotal, cashback_mbv, active) VALUES (?,?,?,?,?,?,1)');
  for (const c of COUPONS) insCoupon.run(c.code, c.type, c.value, c.description, c.min_subtotal, c.cashback_mbv);

  // Usuários
  const insUser = db.prepare('INSERT INTO users (name, email, password, role, wallet_address) VALUES (?,?,?,?,?)');
  insUser.run('Administrador MBV', 'admin@mbv.com', bcrypt.hashSync('admin123', 10), 'admin', wallet.makeWalletAddress());

  const cust = insUser.run('Cliente Teste', 'cliente@mbv.com', bcrypt.hashSync('cliente123', 10), 'customer', wallet.makeWalletAddress());
  // Bônus de boas-vindas + saldo para testar pagamento em MBV Coin
  wallet.move(cust.lastInsertRowid, 150, 'welcome', 'Bônus de boas-vindas ao MBV', 'welcome');
  wallet.move(cust.lastInsertRowid, 2000, 'topup', 'Recarga inicial de demonstração', 'demo');
  db.prepare('UPDATE users SET email_verified = 1').run(); // contas de demonstração já verificadas

  console.log('  ✓ Seed concluído:', PRODUCTS.length, 'produtos,', CATEGORIES.length, 'categorias,', COUPONS.length, 'cupons.');
}

// Só popula se ainda não houver dados.
function ensureSeed() {
  const n = db.prepare('SELECT COUNT(*) n FROM users').get().n;
  if (n === 0) seed();
}

// Execução direta: `node server/seed.js --reset` recria tudo.
if (require.main === module) {
  if (process.argv.includes('--reset')) {
    for (const t of ['transactions', 'reviews', 'favorites', 'order_items', 'orders', 'cart_items', 'coupons', 'products', 'categories', 'users']) {
      db.prepare(`DELETE FROM ${t}`).run();
      db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(t);
    }
    console.log('  Banco limpo. Recriando dados...');
  }
  ensureSeed();
  console.log('  Pronto.');
}

module.exports = { ensureSeed, seed };
