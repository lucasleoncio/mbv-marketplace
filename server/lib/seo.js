// SSR leve / prerender: por rota, injeta título, descrição, canonical, Open Graph,
// dados estruturados (JSON-LD) e um "snapshot" de conteúdo no HTML — para o Google
// e as IAs lerem a página sem executar JavaScript. O app (SPA) re-renderiza por cima.
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { APP_URL } = require('../config');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
const OG_DEFAULT = APP_URL + '/img/og.png';
const SITE_TITLE = 'MBV — Marketplace do Agronegócio Sustentável | Movimento Brasil Verde';
const SITE_DESC = 'Marketplace de insumos sustentáveis do Movimento Brasil Verde: fertilizantes, bioinsumos (COT/PVE), sementes e energia limpa. Pague com Cartão, Pix ou o token Neutrotan (NTR). Regenerar para produzir.';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function money(n) { return 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ','); }
function ld(obj) { return '<script type="application/ld+json">' + JSON.stringify(obj) + '</script>'; }

function fill(d) {
  return TEMPLATE
    .replace('{{TITLE}}', esc(d.title || SITE_TITLE))
    .replace('{{DESCRIPTION}}', esc(d.description || SITE_DESC))
    .replace('{{ROBOTS}}', d.robots || 'index, follow')
    .replace(/\{\{CANONICAL\}\}/g, esc(d.canonical || APP_URL + '/'))
    .replace(/\{\{OG_TITLE\}\}/g, esc(d.ogTitle || d.title || SITE_TITLE))
    .replace(/\{\{OG_DESC\}\}/g, esc(d.ogDesc || d.description || SITE_DESC))
    .replace(/\{\{OG_IMAGE\}\}/g, esc(d.ogImage || OG_DEFAULT))
    .replace('{{JSONLD}}', d.jsonld || '')
    .replace('{{SSR}}', d.ssr || '<div class="container"><div class="loader">Carregando…</div></div>');
}

function productPage(id) {
  const p = db.prepare(`SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.active = 1`).get(id);
  if (!p) return null;
  const url = `${APP_URL}/produto/${p.id}/${p.slug || ''}`.replace(/\/+$/, '');
  const desc = ((p.description || '').slice(0, 158)) || 'Insumo sustentável do MBV.';
  const img = p.image && /^https?:/.test(p.image) ? p.image : OG_DEFAULT;
  let badges = []; try { badges = JSON.parse(p.badges || '[]'); } catch (_) {}
  const cert = badges.length ? badges.join(', ') : 'biotecnologia COT/PVE';
  const faq = [
    { q: `O ${p.name} é sustentável?`, a: `Sim. É produzido com ${cert}, dentro da proposta de agricultura regenerativa do MBV.` },
    { q: 'Quais as formas de pagamento?', a: 'Cartão, Pix ou o token Neutrotan (NTR). Pagando em NTR você ganha 5% de desconto e cashback.' },
    { q: 'Qual o prazo e o valor do frete?', a: 'O frete é calculado pelo seu CEP no checkout. Em compras acima de R$ 500, o frete é grátis.' },
    { q: 'Posso trocar ou devolver?', a: 'Sim. Você tem até 7 dias corridos após o recebimento, conforme o Código de Defesa do Consumidor.' },
    ...(p.co2 ? [{ q: 'Qual o impacto ambiental?', a: `Estimamos uma redução de cerca de ${p.co2} kg de CO₂e por unidade em relação ao manejo convencional (estimativa — ver metodologia).` }] : [])
  ];
  const jsonld = ld({
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, description: p.description || desc, image: img, sku: 'MBV-' + p.id,
    brand: { '@type': 'Brand', name: 'MBV — Movimento Brasil Verde' },
    category: p.category_name || undefined,
    offers: { '@type': 'Offer', priceCurrency: 'BRL', price: Number(p.price).toFixed(2), availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url },
    ...(p.rating_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.rating_count } } : {})
  }) + ld({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: APP_URL + '/' },
      { '@type': 'ListItem', position: 2, name: p.category_name || 'Produtos', item: `${APP_URL}/produtos?cat=${p.category_slug || ''}` },
      { '@type': 'ListItem', position: 3, name: p.name, item: url }
    ]
  }) + ld({
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  });
  const ssr = `<div class="container"><article style="max-width:780px;margin:30px auto">
    <nav style="font-size:13px;color:#5d6f64">Início › ${esc(p.category_name || '')}</nav>
    <h1>${esc(p.name)}</h1>
    <p><strong>${money(p.price)}</strong>${p.unit && p.unit !== 'un' ? ' / ' + esc(p.pack_size || p.unit) : ''} — ${p.stock > 0 ? 'em estoque' : 'esgotado'}</p>
    <p>${esc(p.description || '')}</p>
    <ul><li>Embalagem: ${esc(p.pack_size || '—')}</li><li>Unidade: ${esc(p.unit)}</li>${p.co2 ? `<li>CO₂ evitado (estimativa): ~${p.co2} kg por unidade vs. manejo convencional</li>` : ''}</ul>
    <p>Pague com Cartão, Pix ou o token Neutrotan (NTR) na rede Polygon.</p>
    <h2>Perguntas frequentes</h2>
    <dl>${faq.map(f => `<dt><strong>${esc(f.q)}</strong></dt><dd>${esc(f.a)}</dd>`).join('')}</dl>
  </article></div>`;
  return { title: `${p.name} — MBV`, description: desc, canonical: url, ogTitle: p.name, ogDesc: desc, ogImage: img, jsonld, ssr };
}

function categoryPage(slug) {
  const cat = slug ? db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug) : null;
  const items = db.prepare(`SELECT id, name, price, slug FROM products p WHERE active = 1 ${cat ? 'AND category_id = ?' : ''} ORDER BY featured DESC, id DESC LIMIT 24`).all(...(cat ? [cat.id] : []));
  const name = cat ? cat.name : 'Todos os produtos';
  const desc = (cat && cat.description) ? cat.description : `${name} sustentáveis no marketplace do Movimento Brasil Verde.`;
  const url = APP_URL + '/produtos' + (cat ? `?cat=${slug}` : '');
  const list = items.map(p => `<li><a href="/produto/${p.id}/${p.slug || ''}">${esc(p.name)}</a> — ${money(p.price)}</li>`).join('');
  const jsonld = ld({ '@context': 'https://schema.org', '@type': 'ItemList', name, itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${APP_URL}/produto/${p.id}/${p.slug || ''}`, name: p.name })) });
  const ssr = `<div class="container"><section style="max-width:820px;margin:30px auto"><h1>${esc(name)}</h1><p>${esc(desc)}</p><ul>${list}</ul></section></div>`;
  return { title: `${name} — MBV`, description: desc.slice(0, 158), canonical: url, ogTitle: name, ogDesc: desc.slice(0, 158), jsonld, ssr };
}

const STATIC = {
  sobre: { t: 'Sobre o MBV', d: 'Desde 1992, o Movimento Brasil Verde une pesquisa científica e atuação no campo para regenerar ambientes com biotecnologia COT/PVE, reflorestamento e soluções ESG.' },
  contato: { t: 'Contato', d: 'Fale com o Movimento Brasil Verde: WhatsApp +55 48 9174-1610 e contato@movimentobrasilverde.com.' },
  faq: { t: 'Perguntas frequentes', d: 'Dúvidas sobre pagamento (Cartão, Pix, token NTR), frete, trocas e segurança no marketplace MBV.' },
  privacidade: { t: 'Política de Privacidade', d: 'Como o MBV trata seus dados pessoais conforme a LGPD (Lei 13.709/2018).' },
  termos: { t: 'Termos de Uso', d: 'Termos de uso do marketplace do Movimento Brasil Verde.' },
  trocas: { t: 'Trocas e Devoluções', d: 'Política de trocas e devoluções do MBV conforme o Código de Defesa do Consumidor.' }
};
function staticPage(slug) {
  const s = STATIC[slug];
  const url = APP_URL + '/' + slug;
  const ssr = `<div class="container"><article style="max-width:780px;margin:30px auto"><h1>${esc(s.t)}</h1><p>${esc(s.d)}</p></article></div>`;
  return { title: `${s.t} — MBV`, description: s.d, canonical: url, ssr };
}

function homePage() {
  const featured = db.prepare('SELECT id, name, price, slug FROM products WHERE active = 1 AND featured = 1 LIMIT 8').all();
  const list = featured.map(p => `<li><a href="/produto/${p.id}/${p.slug || ''}">${esc(p.name)}</a> — ${money(p.price)}</li>`).join('');
  const jsonld = ld({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'MBV — Movimento Brasil Verde', url: APP_URL + '/', potentialAction: { '@type': 'SearchAction', target: APP_URL + '/produtos?q={search_term_string}', 'query-input': 'required name=search_term_string' } });
  const ssr = `<div class="container"><section style="max-width:820px;margin:30px auto">
    <p style="color:#2f8f5b;font-weight:600">Desde 1992 · Regenerar para produzir</p>
    <h1>Insumos que regeneram o solo — e fazem o planeta prosperar</h1>
    <p>Biotecnologia COT/PVE, fertilizantes ecológicos, reflorestamento e energia limpa. Compre com Cartão, Pix ou o token Neutrotan (NTR).</p>
    <h2>Destaques</h2><ul>${list}</ul></section></div>`;
  return { title: SITE_TITLE, description: SITE_DESC, canonical: APP_URL + '/', jsonld, ssr };
}

const PRIVATE = ['carrinho', 'checkout', 'conta', 'pedidos', 'pedido', 'carteira', 'favoritos', 'entrar', 'recuperar', 'redefinir', 'verificar', 'admin'];

function renderHTML(req) {
  const parts = req.path.split('/').filter(Boolean);
  let d;
  try {
    if (parts.length === 0) d = homePage();
    else if (parts[0] === 'produto' && parts[1]) d = productPage(Number(parts[1]));
    else if (parts[0] === 'produtos') d = categoryPage(req.query.cat);
    else if (STATIC[parts[0]]) d = staticPage(parts[0]);
  } catch (e) { console.error('[seo]', e.message); }
  if (!d) {
    d = { title: SITE_TITLE, description: SITE_DESC, canonical: APP_URL + req.path, robots: PRIVATE.includes(parts[0]) ? 'noindex, nofollow' : 'index, follow' };
  }
  return fill(d);
}

module.exports = { renderHTML };
