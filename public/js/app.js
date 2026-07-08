/* ===========================================================
   MBV Marketplace — App (router + páginas)
   =========================================================== */
const { icon, iconFill, money, mbv, ntr, escapeHtml, stars, productImage, productCard, toast, openModal, closeModal, statusPill } = UI;
const app = document.getElementById('app');

/* ---------------- Router ---------------- */
function parseRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  const query = {};
  new URLSearchParams(location.search).forEach((v, k) => { query[k] = v; });
  return { parts, query, path: location.pathname };
}
let pendingFocus = false; // após navegação SPA, a próxima montagem move o foco ao conteúdo (a11y)
function go(to) {
  pendingFocus = true;
  if (to === location.pathname + location.search) { render(); return; }
  history.pushState({}, '', to);
  render();
  if (window.gtag) gtag('event', 'page_view', { page_location: location.href });
}
function buildQuery(obj) {
  const q = Object.entries(obj).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return q ? '?' + q : '';
}
// Título da aba por rota (leitores de tela, histórico e GA enxergam a página certa).
const TITLES = { '': '', produtos: 'Produtos', carrinho: 'Carrinho', checkout: 'Checkout', pedidos: 'Meus pedidos', pedido: 'Pedido', conta: 'Minha conta', carteira: 'Carteira NTR', favoritos: 'Favoritos', entrar: 'Entrar', sobre: 'Sobre', contato: 'Contato', faq: 'Perguntas frequentes', privacidade: 'Privacidade', termos: 'Termos de uso', trocas: 'Trocas e devoluções', 'metodologia-co2': 'Metodologia de CO₂', afiliados: 'Programa de afiliados', transparencia: 'Transparência on-chain', comparar: 'Comparar produtos', recuperar: 'Recuperar senha', redefinir: 'Redefinir senha', verificar: 'Verificação de e-mail', admin: 'Painel Admin' };
function setTitle(t) { document.title = t ? `${t} · MBV Marketplace` : 'MBV — Marketplace de Insumos Sustentáveis'; }
let ssrFirstPaint = app.children.length > 0; // HTML do SSR já visível: não apagar com skeleton
function mount(html, opts = {}) {
  app.innerHTML = html;
  ssrFirstPaint = false;
  window.scrollTo(0, 0);
  if (pendingFocus && !opts.skeleton) {
    pendingFocus = false;
    const h = app.querySelector('h1, h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
}
function recentIds() { try { return JSON.parse(localStorage.getItem('mbv_recent') || '[]'); } catch { return []; } }
function trackRecent(id) { try { id = Number(id); const r = recentIds().filter(x => x !== id); r.unshift(id); localStorage.setItem('mbv_recent', JSON.stringify(r.slice(0, 12))); } catch (_) {} }
async function downloadCsv(path, filename) {
  try {
    const res = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + API.getToken() } });
    if (!res.ok) throw new Error('Falha ao exportar.');
    const blob = await res.blob(); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) { toast('Ops', e.message, 'err'); }
}
function compareIds() { try { return JSON.parse(localStorage.getItem('mbv_compare') || '[]'); } catch { return []; } }
function toggleCompare(id) {
  id = Number(id); const cur = compareIds();
  const a = cur.includes(id) ? cur.filter(x => x !== id) : [id, ...cur].slice(0, 4);
  try { localStorage.setItem('mbv_compare', JSON.stringify(a)); } catch (_) {}
  return a.includes(id);
}
function loading() {
  // No primeiro carregamento o SSR já pintou conteúdo real — não o troque por skeleton
  // (evita o flash conteúdo→skeleton→conteúdo e preserva o LCP).
  if (ssrFirstPaint) { ssrFirstPaint = false; return; }
  const cards = Array.from({ length: 8 }).map(() => `<div class="skel-card"><div class="skel skel-img"></div><div class="skel skel-line"></div><div class="skel skel-line short"></div></div>`).join('');
  mount(`<div class="container"><div class="skel skel-hero"></div><div class="product-grid" style="margin-top:24px">${cards}</div><p class="muted center" id="coldHint" style="margin-top:18px;opacity:0;transition:opacity .4s">Preparando a loja… na primeira visita pode levar alguns segundos.</p></div>`, { skeleton: true });
  setTimeout(() => { const h = document.getElementById('coldHint'); if (h) h.style.opacity = '1'; }, 2500);
}

async function render() {
  const { parts, query } = parseRoute();
  const r = parts[0] || '';
  setTitle(TITLES[r] || ''); // páginas dinâmicas (produto/pedido) refinam depois
  // Marca o link ativo do menu de categorias (a11y + orientação visual)
  document.querySelectorAll('.navrow a').forEach(a => {
    if (a.getAttribute('href') === location.pathname + location.search) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  try {
    if (r === '') return await Pages.home();
    if (r === 'produtos') return await Pages.catalog(query);
    if (r === 'produto') return await Pages.product(parts[1]);
    if (r === 'carrinho') return await Pages.cart();
    if (r === 'checkout') return await Pages.checkout();
    if (r === 'pedido') return await Pages.orderDetail(parts[1]);
    if (r === 'pedidos') return await Pages.orders();
    if (r === 'conta') return await Pages.account();
    if (r === 'carteira') return await Pages.wallet();
    if (r === 'favoritos') return await Pages.favorites();
    if (r === 'entrar') return await Pages.auth(query);
    if (['sobre', 'contato', 'faq', 'privacidade', 'termos', 'trocas', 'metodologia-co2', 'afiliados'].includes(r)) return Pages.page(r);
    if (r === 'transparencia') return Pages.transparencia();
    if (r === 'comparar') return await Pages.compare();
    if (r === 'recuperar') return Pages.forgot();
    if (r === 'redefinir') return Pages.reset(query);
    if (r === 'verificar') return await Pages.verify(query);
    if (r === 'admin') return await Pages.admin(parts.slice(1), query);
    return Pages.notFound();
  } catch (e) {
    console.error(e);
    if (e && e.status === 404) return Pages.notFound();
    return Pages.error(e);
  }
}

/* ---------------- Header & Footer ---------------- */
function renderHeader() {
  const h = document.getElementById('site-header');
  const u = Store.user;
  const cats = Store.categories.map(c => `<a href="/produtos${buildQuery({ cat: c.slug })}">${escapeHtml(c.name)}</a>`).join('');
  h.innerHTML = `
  ${Store.chain && Store.chain.demo ? `<div class="demo-strip" role="note">Ambiente de demonstração — produtos, preços e avaliações são ilustrativos.</div>` : ''}
  <div class="topbar"><div class="container">
    <span class="topbar-tag">🌱 Regenerar para produzir · Desde 1992 · Frete grátis acima de R$ 500</span>
    <span class="topbar-right">
      <a class="topbar-inst" href="https://mbv-site.onrender.com/pt/index.html" target="_blank" rel="noopener" title="Abrir o site institucional do MBV">Site institucional <span aria-hidden="true">↗</span></a>
      <span class="topbar-greet">${u ? 'Olá, ' + escapeHtml(u.name.split(' ')[0]) : 'Insumos sustentáveis para o seu cultivo'}</span>
    </span>
  </div></div>
  <div class="header"><div class="container">
    <div class="header-main">
      <a href="/" class="logo"><img class="mark" src="https://movimentobrasilverde.com/wp-content/uploads/2026/04/cropped-Icone-MBV-270x270.png" alt="MBV — Movimento Brasil Verde" width="40" height="40" onerror="this.onerror=null;this.src='/img/logo.svg'"><span>MBV<small>MOVIMENTO BRASIL VERDE</small></span></a>
      <form class="search" id="searchForm" role="search">
        <input id="searchInput" placeholder="Buscar fertilizantes, sementes, energia solar…" aria-label="Buscar produtos" />
        <button type="submit" aria-label="Buscar">${icon('search', 18)}</button>
      </form>
      <div class="header-actions">
        ${u ? `<a href="/carteira" class="wallet-chip" title="Carteira Neutrotan (NTR)"><span class="tk">${iconFill('coin', 12)}</span><span>${mbv(Store.balance)}</span></a>` : ''}
        <a href="/carrinho" class="icon-btn" title="Carrinho">${icon('cart', 19)}<span class="lbl">Carrinho</span>${Store.cartCount ? `<span class="count">${Store.cartCount}</span>` : ''}</a>
        <div class="menu" id="acctMenu">
          <button class="icon-btn" id="acctBtn" aria-haspopup="true" aria-expanded="false">${icon('user', 19)}<span class="lbl">${u ? 'Conta' : 'Entrar'}</span></button>
          <div class="menu-pop hide" id="acctPop">
            ${u ? `
              <a href="/conta">${icon('user', 17)} Minha conta</a>
              <a href="/pedidos">${icon('box', 17)} Meus pedidos</a>
              <a href="/carteira">${icon('wallet', 17)} Carteira NTR</a>
              <a href="/favoritos">${iconFill('heart', 17)} Favoritos</a>
              ${Store.isAdmin() ? `<div class="sep"></div><a href="/admin">${icon('grid', 17)} Painel Admin</a>` : ''}
              <div class="sep"></div><button id="logoutBtn">${icon('logout', 17)} Sair</button>
            ` : `
              <a href="/entrar">${icon('user', 17)} Entrar</a>
              <a href="/entrar?tab=register">${icon('plus', 17)} Criar conta</a>
            `}
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="navrow"><div class="container">
    <a href="/produtos">${icon('grid', 15)} Todos</a>${cats}
    <a href="/produtos${buildQuery({ sort: 'price_asc' })}" style="margin-left:auto;color:var(--gold)">${iconFill('tag', 14)} Ofertas</a>
  </div></div>
  </div>`;

  document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault(); go('/produtos' + buildQuery({ q: document.getElementById('searchInput').value.trim() }));
  });
  const pop = document.getElementById('acctPop');
  const acctBtn = document.getElementById('acctBtn');
  acctBtn.addEventListener('click', e => {
    e.stopPropagation();
    pop.classList.toggle('hide');
    acctBtn.setAttribute('aria-expanded', String(!pop.classList.contains('hide')));
  });
  // (o fechamento do menu ao clicar fora/Esc é feito pelos listeners globais delegados — 1 registro só, sem vazamento)
  const lo = document.getElementById('logoutBtn');
  if (lo) lo.addEventListener('click', () => { Store.logout(); renderHeader(); go('/'); toast('Até logo!', 'Você saiu da sua conta.'); });
}

function socialIcon(n) {
  const p = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/>',
    facebook: '<path d="M14.2 8.9h2V6.2h-2c-1.9 0-3.2 1.3-3.2 3.1V11H9v2.7h2V21h2.8v-7.3h2.1l.3-2.7h-2.4V9.3c0-.3.3-.4.6-.4Z" fill="currentColor" stroke="none"/>',
    linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 10.5V17M7 7.3v.01M11 17v-3.6a2 2 0 0 1 4 0V17M11 17v-6.5"/>',
    youtube: '<rect x="2.5" y="6" width="19" height="12" rx="3.5"/><path d="M10.5 9.4l4.4 2.6-4.4 2.6Z" fill="currentColor" stroke="none"/>'
  };
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p[n] || ''}</svg>`;
}
function renderFooter() {
  document.getElementById('site-footer').innerHTML = `<div class="footer"><div class="container">
    <div class="footer-grid">
      <div>
        <a href="/" class="logo" style="color:#fff;gap:0" aria-label="MBV — Movimento Brasil Verde"><img src="https://movimentobrasilverde.com/wp-content/uploads/2026/01/logo_branca.webp" alt="Movimento Brasil Verde" style="height:46px;width:auto;max-width:240px" onerror="this.style.display='none';var l=document.getElementById('footLock');if(l)l.style.display='flex'"><span id="footLock" style="display:none;align-items:center;gap:10px"><img class="mark" src="/img/logo.svg" width="40" height="40"><span>MBV<small style="color:#8fbf9e">MOVIMENTO BRASIL VERDE</small></span></span></a>
        <p style="margin-top:14px;max-width:300px;font-size:13.5px;line-height:1.6">Marketplace de insumos que regeneram o solo e protegem o meio ambiente. Pague com Cartão, Pix ou o token <b style="color:var(--lime)">Neutrotan (NTR)</b>.</p>
        <div class="social">
          <a href="https://www.instagram.com/mbv.oficial/" target="_blank" rel="noopener" aria-label="Instagram">${socialIcon('instagram')}</a>
          <a href="https://www.facebook.com/movimentobrasilverde/" target="_blank" rel="noopener" aria-label="Facebook">${socialIcon('facebook')}</a>
          <a href="https://www.linkedin.com/company/mbvoficial/" target="_blank" rel="noopener" aria-label="LinkedIn">${socialIcon('linkedin')}</a>
          <a href="https://www.youtube.com/@MovimentoBrasilVerde" target="_blank" rel="noopener" aria-label="YouTube">${socialIcon('youtube')}</a>
        </div>
      </div>
      <div><h5>Categorias</h5>${Store.categories.map(c => `<a href="/produtos${buildQuery({ cat: c.slug })}">${escapeHtml(c.name)}</a>`).join('')}</div>
      <div><h5>Conta</h5><a href="/conta">Minha conta</a><a href="/pedidos">Meus pedidos</a><a href="/carteira">Carteira Neutrotan (NTR)</a><a href="/favoritos">Favoritos</a></div>
      <div><h5>Institucional</h5><a href="/sobre">Sobre</a><a href="/contato">Contato</a><a href="/faq">FAQ</a><a href="/termos">Termos de uso</a><a href="/privacidade">Privacidade</a><a href="/trocas">Trocas e devoluções</a><a href="#" id="cookiePrefs">Preferências de cookies</a></div>
      <div><h5>Neutrotan (NTR)</h5><a href="/carteira">Saldo & extrato</a><a href="/checkout">Pagar com cripto</a><a href="/transparencia">Transparência on-chain</a><span style="font-size:12.5px;display:block;margin-top:8px;color:#8fbf9e">Utility token ERC-20 na rede Polygon.<br>Lastro em Carbono Orgânico Total (COT) · Valor de referência: 1 NTR = ${money(Store.rate)}.</span></div>
    </div>
    <div class="footer-bottom"><span>© 2026 Grupo Movimento Brasil Verde · CNPJ 54.224.102/0001-10</span><span style="display:inline-flex;align-items:center;gap:16px;flex-wrap:wrap"><span>Cartão · Pix · Neutrotan (NTR) 🌱</span><span class="demo"><a class="petrus-credit" href="https://www.petrus-software.com" target="_blank" rel="noopener" aria-label="Petrus — petrus-software.com">Desenvolvido por <span class="petrus-chip"><img src="/img/petrus-logo.svg" alt="Petrus" height="15" loading="lazy"></span></a></span></span></div>
  </div></div>`;
  const ck = document.getElementById('cookiePrefs');
  if (ck) ck.addEventListener('click', e => { e.preventDefault(); cookieBanner(true); });
}

/* ---------------- Ações globais (carrinho/favoritos) ---------------- */
async function addToCart(id, qty = 1) {
  id = Number(id); qty = Math.max(1, qty);
  if (!Store.isAuthed()) {
    Store.guestAddToCart(id, qty); renderHeader();
    toast('Adicionado ao carrinho', 'Você finaliza ao entrar — seu carrinho fica salvo.', 'ok');
    return;
  }
  try {
    const r = await API.post('/cart', { product_id: id, quantity: qty });
    Store.cartCount = r.count; renderHeader(); toast('Adicionado ao carrinho', '', 'ok');
  } catch (e) { toast('Ops', e.message, 'err'); }
}
function paintFav(id, on) {
  document.querySelectorAll(`[data-fav="${id}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
async function toggleFav(id) {
  id = Number(id);
  if (!Store.isAuthed()) {
    paintFav(id, Store.guestToggleFav(id));
    return;
  }
  try {
    const r = await API.post('/cart/favorites/' + id);
    if (r.favorited) Store.favorites.add(id); else Store.favorites.delete(id);
    paintFav(id, r.favorited);
  } catch (e) { toast('Ops', e.message, 'err'); }
}
function closeAcctMenu() {
  const acctPop = document.getElementById('acctPop');
  const acctBtn = document.getElementById('acctBtn');
  if (acctPop) acctPop.classList.add('hide');
  if (acctBtn) acctBtn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAcctMenu(); });
document.addEventListener('click', e => {
  // Fecha o menu da conta ao clicar em qualquer lugar (o botão usa stopPropagation para alternar).
  closeAcctMenu();
  const add = e.target.closest('[data-add]'); if (add) { e.preventDefault(); addToCart(add.dataset.add); return; }
  const fav = e.target.closest('[data-fav]'); if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav); return; }
  const a = e.target.closest('a');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    const href = a.getAttribute('href');
    if (href && href.charAt(0) === '/' && a.target !== '_blank' && !a.hasAttribute('download')) { e.preventDefault(); go(href); }
  }
});

/* ---------------- Páginas ---------------- */
const Pages = {};

Pages.notFound = () => mount(`<div class="container"><div class="empty" style="margin:60px 0"><div class="ic">${icon('search', 30)}</div><h2>Página não encontrada</h2><p class="muted">O endereço acessado não existe.</p><a href="/" class="btn btn-primary" style="margin-top:14px">Voltar à loja</a></div></div>`);
Pages.error = (e) => mount(`<div class="container"><div class="empty" style="margin:60px 0"><div class="ic">${icon('shield', 30)}</div><h2>Algo deu errado</h2><p class="muted">${escapeHtml((e && e.message) || 'Não foi possível carregar esta página.')}</p><button class="btn btn-primary" style="margin-top:14px" onclick="location.reload()">Tentar novamente</button></div></div>`);

Pages.compare = async function () {
  loading();
  const ids = compareIds();
  if (!ids.length) return mount(`<div class="container"><div class="empty" style="margin:50px 0"><div class="ic">${icon('grid', 30)}</div><h2>Nada para comparar</h2><p class="muted">Adicione produtos ao comparador pela página do produto.</p><a href="/produtos" class="btn btn-primary" style="margin-top:14px">Ver produtos</a></div></div>`);
  const { items } = await API.get('/products/by-ids?ids=' + ids.join(','));
  const prods = ids.map(i => items.find(p => p.id === i)).filter(Boolean);
  if (!prods.length) return mount(`<div class="container"><div class="empty" style="margin:50px 0"><div class="ic">${icon('grid', 30)}</div><h2>Nada para comparar</h2><a href="/produtos" class="btn btn-primary" style="margin-top:14px">Ver produtos</a></div></div>`);
  const rows = [
    ['Preço', p => money(p.price)],
    ['Em NTR (−5%)', p => money(p.price * 0.95)],
    ['Embalagem', p => escapeHtml(p.pack_size || '—')],
    ['Dose por hectare', p => p.dose_per_ha ? p.dose_per_ha + ' ' + escapeHtml(p.unit) + '/ha' : '—'],
    ['CO₂ evitado (est.)', p => p.co2 ? '~' + p.co2 + ' kg/un' : '—'],
    ['Avaliação', p => (p.rating || 0) + '★ (' + (p.rating_count || 0) + ')'],
    ['Selos', p => (p.badges || []).join(', ') || '—']
  ];
  mount(`<div class="container">
    <div class="breadcrumb"><a href="/">Início</a> ${icon('arrow', 13)} <span>Comparar</span></div>
    <h1 style="margin:10px 0 18px;font-size:27px">Comparar produtos</h1>
    <div class="table-wrap"><table class="cmp-table"><thead><tr><th></th>${prods.map(p => `<th><a href="/produto/${p.id}/${p.slug || ''}"><img src="${productImage(p)}" onerror="${UI.imgFallback(p)}" style="width:84px;height:84px;object-fit:cover;border-radius:10px"><div style="font-size:13px;font-weight:600;margin-top:6px">${escapeHtml(p.name)}</div></a><br><button class="btn btn-ghost btn-sm" data-cmprm="${p.id}" style="margin-top:6px;color:var(--danger)">Remover</button></th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, fn]) => `<tr><td><b>${label}</b></td>${prods.map(p => `<td>${fn(p)}</td>`).join('')}</tr>`).join('')}
    <tr><td></td>${prods.map(p => `<td><button class="btn btn-primary btn-sm" data-add="${p.id}">Adicionar</button></td>`).join('')}</tr>
    </tbody></table></div>
  </div>`);
  app.querySelectorAll('[data-cmprm]').forEach(b => b.addEventListener('click', () => { toggleCompare(Number(b.dataset.cmprm)); Pages.compare(); }));
};

Pages.transparencia = function () {
  const c = Store.chain || {}; const tok = c.token || {};
  const ex = c.explorer || 'https://polygonscan.com';
  const row = (label, val, kind) => `<div class="sum-row"><span>${label}</span>${val
    ? (kind ? `<a href="${ex}/${kind}/${val}" target="_blank" rel="noopener" style="font-family:monospace;font-size:12px;color:var(--green-700);word-break:break-all;text-align:right;max-width:60%">${escapeHtml(val)}</a>` : `<b style="text-align:right">${escapeHtml(val)}</b>`)
    : '<span class="muted">em configuração</span>'}</div>`;
  mount(`<div class="container"><div class="breadcrumb"><a href="/">Início</a> ${icon('arrow', 13)} <span>Transparência</span></div>
    <div class="prose" style="max-width:820px">
      <span class="eyebrow">Do campo à blockchain</span>
      <h1>Transparência on-chain</h1>
      <p>O <b>Neutrotan (NTR)</b> é um <b>utility token</b> (ERC-20) na rede <b>Polygon</b>, usado para pagar pedidos com desconto e cashback. Abaixo estão os endereços públicos para você auditar as transações na própria blockchain.</p>
      <div class="panel" style="background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px 22px;margin:18px 0">
        <h3 style="margin:0 0 10px">Dados da rede</h3>
        ${row('Rede', c.name || 'Polygon', null)}
        ${row('Contrato do token (NTR)', tok.address, 'token')}
        ${row('Carteira da loja', c.store, 'address')}
        <div class="sum-row"><span>Confirmações exigidas</span><b>${c.minConfirmations || 2}</b></div>
        <div class="sum-row"><span>Valor de referência</span><b>1 NTR = ${money(c.brlPerToken || Store.rate)}</b></div>
      </div>
      <p class="muted" style="font-size:13px">${c.enabled
        ? 'Pagamentos em NTR são não-custodiais: o cliente assina a transferência na própria carteira e o servidor apenas lê a blockchain para confirmar o recebimento.'
        : 'O pagamento on-chain está em configuração nesta fase. Os endereços de produção (mainnet) serão publicados aqui no go-live.'}</p>
      <h2>Glossário</h2>
      <div class="faq">
        <details><summary>COT — Carbono Orgânico Total</summary><div>Indicador da matéria orgânica/carbono dos insumos e do solo; base técnica da linha MBV e referência de lastro do token.</div></details>
        <details><summary>COT/PVE</summary><div>Protocolos biotecnológicos do MBV aplicados à nutrição das plantas e à regeneração de solos.</div></details>
        <details><summary>Utility token</summary><div>Token de utilidade: serve para usar e pagar dentro da plataforma. Não constitui valor mobiliário nem promessa de rentabilidade (ver Termos de Uso).</div></details>
        <details><summary>Organomineral</summary><div>Fertilizante que combina matéria orgânica e minerais, registrado no MAPA.</div></details>
      </div>
    </div></div>`);
};

/* ---------- PÁGINAS INSTITUCIONAIS / LEGAIS ---------- */
const STATIC_PAGES = {
  sobre: { crumb: 'Sobre', html: `<div class="prose">
    <span class="eyebrow">Desde 1992</span>
    <h1>Sobre o MBV</h1>
    <p>O <b>Movimento Brasil Verde (MBV)</b> une, desde 1992, pesquisa científica e atuação no campo para regenerar ambientes e elevar resultados no agronegócio. Hoje, como empresa formalizada, entregamos reflorestamento biossustentável, saneamento e soluções ESG com transparência em blockchain.</p>
    <h2>Ciência que gera resultado</h2>
    <p>Nossos protocolos biotecnológicos <b>COT/PVE</b> aceleram o metabolismo das plantas, recuperam solos e ampliam a produtividade — em ensaio de campo do MBV, observamos <b>+70% na soja</b> em área antes degradada (resultados variam conforme solo, clima e manejo).</p>
    <h2>Compromisso</h2>
    <p>Somos signatários do <b>Pacto Global da ONU</b> e alinhados aos <b>ODS</b>. Cada projeto une lastro real e auditoria, conectando produtores, investidores e sociedade a um impacto mensurável.</p>
    <p>Este marketplace é a vitrine dos nossos insumos sustentáveis, com pagamento por Cartão, Pix e pelo token <b>Neutrotan (NTR)</b>.</p>
  </div>` },
  contato: { crumb: 'Contato', html: `<div class="prose">
    <h1>Fale com a gente</h1>
    <p>Conte seu cenário (área degradada, conformidade ou produtividade) que indicamos o melhor caminho.</p>
    <p><b>WhatsApp / Telefone:</b> +55 48 9174-1610<br><b>E-mail:</b> contato@movimentobrasilverde.com</p>
    <p><b>São Paulo/SP:</b> Rua do Rocio, 288 – Conj. 121, Vila Olímpia<br><b>Palhoça/SC:</b> Av. Mario José Mateus, 220 – Galpão 1, Bela Vista</p>
    <div class="panel" style="margin-top:18px">
      <div class="field"><label>Seu nome</label><input id="ct_name"></div>
      <div class="field"><label>Mensagem</label><textarea id="ct_msg" placeholder="Como podemos ajudar?"></textarea></div>
      <button class="btn btn-primary" id="ct_send">Enviar pelo WhatsApp</button>
    </div>
  </div>` },
  faq: { crumb: 'FAQ', html: `<div class="prose">
    <h1>Perguntas frequentes</h1>
    <h2>Como funciona o pagamento?</h2><p>Você pode pagar com Cartão, Pix ou com o token <b>Neutrotan (NTR)</b>, direto pela sua carteira (MetaMask) na rede Polygon.</p>
    <h2>Qual o valor do frete?</h2><p>O frete é calculado pelo seu CEP no checkout. Compras acima de <b>R$ 500</b> têm frete grátis.</p>
    <h2>O que é o token NTR?</h2><p>É o utility token do ecossistema MBV (ERC-20 na Polygon), com lastro em Carbono Orgânico Total (COT). Dá descontos e cashback nas compras. Veja os endereços on-chain em <a href="/transparencia" style="color:var(--green-700);font-weight:600">Transparência</a>.</p>
    <h2>Posso trocar ou devolver?</h2><p>Sim — você tem até 7 dias após o recebimento. Veja a página de Trocas e Devoluções.</p>
    <h2>É seguro?</h2><p>Sim. Pagamentos processados por parceiros e, no caso do NTR, confirmados on-chain. Não guardamos dados de cartão nem chaves de carteira.</p>
  </div>` },
  privacidade: { crumb: 'Privacidade', html: `<div class="prose">
    <h1>Política de Privacidade</h1>
    <p class="muted">Atualizado em julho de 2026 · Versão de demonstração — passará por validação jurídica antes do lançamento oficial.</p>
    <p>O Movimento Brasil Verde (CNPJ 54.224.102/0001-10) cumpre a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).</p>
    <h2>Dados que coletamos</h2><p>Nome, e-mail, telefone, endereço de entrega, CPF/CNPJ (para nota fiscal e cupons) e, se você pagar com NTR, o endereço público da sua carteira. Não armazenamos dados completos de cartão.</p>
    <h2>Como usamos</h2><p>Para processar e entregar pedidos, emitir documentos fiscais, prevenir fraudes, enviar comunicações sobre sua compra e cumprir obrigações legais.</p>
    <h2>Operadores e terceiros</h2><p>Compartilhamos apenas o necessário com: <b>Mercado Pago</b> (pagamentos), <b>Resend</b> (envio de e-mails) e <b>Google Analytics</b> (métricas de uso, somente após seu consentimento de cookies). Pagamentos em NTR ocorrem na rede pública Polygon.</p>
    <h2>Retenção</h2><p>Mantemos os dados pelo tempo necessário às finalidades acima e aos prazos legais (ex.: fiscais).</p>
    <h2>Seus direitos</h2><p>Você pode acessar, corrigir, excluir ou portar seus dados e revogar consentimento pelo e-mail <b>contato@movimentobrasilverde.com</b> (encarregado/DPO).</p>
    <h2>Dados em blockchain</h2><p>Pagamentos com o token NTR são registrados na rede pública <b>Polygon</b>. Registros em blockchain são <b>públicos e imutáveis</b> por natureza: o endereço da carteira e os valores das transações não podem ser apagados nem alterados por nós. O direito de eliminação (LGPD art. 18, VI) aplica-se às bases internas do MBV; não alcança dados já gravados na rede pública. Não vincule sua carteira se não concordar com essa característica — você pode pagar com Cartão ou Pix.</p>
    <h2>Cookies</h2><p>Cookies essenciais mantêm sua sessão e seu carrinho. Cookies de análise (Google Analytics) só são ativados se você aceitar no banner — você pode recusar e usar a loja normalmente. Para rever sua escolha a qualquer momento, use <b>“Preferências de cookies”</b> no rodapé.</p>
  </div>` },
  afiliados: { crumb: 'Programa de Afiliados', html: `<div class="prose">
    <span class="eyebrow">Indique e ganhe</span>
    <h1>Programa de Afiliados MBV</h1>
    <p>Revendas, agrônomos e produtores parceiros podem indicar a loja e receber comissão sobre as vendas geradas pelo seu cupom.</p>
    <h2>Como funciona</h2>
    <p>1) Você recebe um <b>cupom exclusivo</b> da MBV. 2) Compartilhe seu link no formato <code>/produtos?ref=SEUCUPOM</code> — ao abrir, o cupom é aplicado automaticamente no carrinho do cliente. 3) A MBV acompanha as vendas e a comissão atribuídas ao seu cupom.</p>
    <h2>Quero ser afiliado</h2>
    <p>Fale com a gente pelo WhatsApp <b>+55 48 9174-1610</b> ou pelo e-mail <b>contato@movimentobrasilverde.com</b> para receber seu cupom e as condições de comissão.</p>
  </div>` },
  'metodologia-co2': { crumb: 'Metodologia de CO₂', html: `<div class="prose">
    <span class="eyebrow">Transparência ambiental</span>
    <h1>Como estimamos o CO₂ evitado</h1>
    <p>O valor de "CO₂ evitado" exibido em alguns produtos é uma <b>estimativa comparativa</b> — quanto de CO₂ equivalente (CO₂e) o uso do insumo MBV tende a evitar <b>em relação ao manejo convencional</b> de referência. Não é uma medição da sua lavoura específica nem uma garantia de resultado.</p>
    <h2>Base do cálculo</h2><p>As estimativas seguem fatores de emissão reconhecidos (ex.: GHG Protocol Agrícola e diretrizes do IPCC), aplicados por categoria de produto, considerando produção, transporte e uso. Onde não há base suficiente, o produto não exibe número.</p>
    <h2>Premissas</h2><p>Os valores assumem condições típicas de cultura e a dosagem recomendada. Resultados reais variam conforme solo, clima, manejo e calibração de equipamentos.</p>
    <h2>Melhoria contínua</h2><p>Estamos refinando a metodologia com dados de campo e auditoria independente. Dúvidas e sugestões: <b>contato@movimentobrasilverde.com</b>.</p>
  </div>` },
  termos: { crumb: 'Termos', html: `<div class="prose">
    <h1>Termos de Uso</h1>
    <p class="muted">Versão de demonstração — passará por validação jurídica antes do lançamento oficial.</p>
    <p>Este marketplace é operado pelo <b>Grupo Movimento Brasil Verde</b>, CNPJ <b>54.224.102/0001-10</b> — contato: <b>contato@movimentobrasilverde.com</b> · WhatsApp +55 48 9174-1610. Ao usar a plataforma, você concorda com estes termos.</p>
    <h2>Uso da plataforma</h2><p>Você se compromete a fornecer informações verdadeiras e a usar a plataforma de forma lícita.</p>
    <h2>Pedidos e pagamentos</h2><p>Preços e disponibilidade podem mudar. O pedido é confirmado após a aprovação do pagamento (Cartão, Pix ou NTR).</p>
    <h2>Token Neutrotan (NTR)</h2><p>O NTR é um utility token de uso no ecossistema MBV. Não constitui oferta de valor mobiliário nem promessa de rentabilidade.</p>
    <h2>Limitação de responsabilidade</h2><p>Empenhamo-nos pela disponibilidade e exatidão, mas não garantimos operação ininterrupta.</p>
    <h2>Contato</h2><p>contato@movimentobrasilverde.com</p>
  </div>` },
  trocas: { crumb: 'Trocas e devoluções', html: `<div class="prose">
    <h1>Trocas e Devoluções</h1>
    <p class="muted">Versão de demonstração — passará por validação jurídica antes do lançamento oficial.</p>
    <p>Política do <b>Grupo Movimento Brasil Verde</b> (CNPJ 54.224.102/0001-10), conforme o Código de Defesa do Consumidor e o Decreto 7.962/2013 (comércio eletrônico).</p>
    <h2>Direito de arrependimento</h2><p>Conforme o CDC (art. 49), você pode desistir da compra em até <b>7 dias corridos</b> após o recebimento, sem precisar justificar. Nesse caso, <b>o frete de devolução é por conta da loja</b> e você recebe de volta <b>todos os valores pagos, incluindo o frete de envio</b>.</p>
    <h2>Como solicitar</h2><p>Envie um e-mail para contato@movimentobrasilverde.com com o número do pedido. O produto deve estar sem uso e na embalagem original. Enviaremos o código de postagem para a devolução sem custo.</p>
    <h2>Reembolso</h2><p>Após o recebimento e a conferência do produto, o reembolso é processado em até <b>10 dias úteis</b>, pelo mesmo meio de pagamento (estorno no cartão, devolução via Pix ou, em pagamentos com NTR, estorno em NTR pela mesma quantidade paga).</p>
    <h2>Produtos com defeito</h2><p>Em caso de vício/defeito, você tem até <b>30 dias</b> (produtos não duráveis) ou <b>90 dias</b> (duráveis) para reclamar, conforme o CDC art. 26 — sem custo de frete.</p>
  </div>` }
};
Pages.page = function (slug) {
  const p = STATIC_PAGES[slug];
  if (!p) return Pages.notFound();
  mount(`<div class="container"><div class="breadcrumb"><a href="/">Início</a> ${icon('arrow', 13)} <span>${escapeHtml(p.crumb)}</span></div>${p.html}</div>`);
  if (slug === 'contato') {
    const b = app.querySelector('#ct_send');
    if (b) b.addEventListener('click', () => {
      const nome = app.querySelector('#ct_name').value.trim();
      const msg = app.querySelector('#ct_msg').value.trim();
      const text = encodeURIComponent(`Olá! Sou ${nome || 'visitante do site'}. ${msg}`);
      window.open('https://wa.me/554891741610?text=' + text, '_blank');
    });
  }
};

/* ---------- HOME ---------- */
Pages.home = async function () {
  loading();
  const [{ items: featured }, { items: recent }] = await Promise.all([
    API.get('/products?featured=1&limit=8'),
    API.get('/products?sort=newest&limit=4')
  ]);
  const cats = Store.categories;
  mount(`<section class="hero hero--full" style="background:linear-gradient(135deg,rgba(11,44,32,.92),rgba(20,84,59,.5)),url('https://movimentobrasilverde.com/wp-content/uploads/2026/01/DSC06741.webp') center/cover,#0f3d2e"><div class="hero-inner">
      <div>
        <span class="eyebrow" style="color:var(--lime)">Desde 1992 · Regenerar para produzir</span>
        <h1>Insumos que regeneram o solo — e fazem o planeta prosperar</h1>
        <p>Biotecnologia COT/PVE, fertilizantes ecológicos, reflorestamento e energia limpa. Compre com Cartão, Pix ou pague com o token <b>Neutrotan (NTR)</b> e ganhe desconto.</p>
        <div class="cta">
          <a href="/produtos" class="btn btn-lg" style="background:var(--lime);color:#15391f">Explorar produtos ${icon('arrow', 18)}</a>
          <a href="/carteira" class="btn btn-lg btn-ghost">Conhecer o token NTR</a>
        </div>
        <div class="hero-stats"><div><b>30+</b><span>anos regenerando</span></div><div><b>+70%</b><span>na soja em ensaio de campo*</span></div><div><b>5%</b><span>desconto pagando em NTR</span></div></div>
        <p style="font-size:11.5px;opacity:.75;margin:10px 0 0">*Ensaio do MBV em área degradada — resultados variam conforme solo, clima e manejo.</p>
      </div>
      <div class="hero-art"><div class="hero-card">
        <div class="coin">${iconFill('coin', 30)}</div>
        <h3 style="color:#fff;margin:16px 0 4px">Neutrotan (NTR)</h3>
        <p style="color:#cfe9d6;font-size:13.5px;margin:0">Utility token do ecossistema MBV (ERC-20 · Polygon), com lastro em Carbono Orgânico Total (COT). Pague, acumule cashback e ganhe descontos exclusivos.</p>
        <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:13px;color:#eafff0"><span>Cashback</span><b>2% por compra</b></div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:13px;color:#eafff0"><span>Bônus de boas-vindas</span><b>150 NTR</b></div>
      </div></div>
    </div></section>

    <div class="container">
    <div class="banner-eco">
      <div class="benefit"><div class="ic">${icon('truck', 22)}</div><div><b>Frete grátis</b><span>Em compras acima de R$ 500</span></div></div>
      <div class="benefit"><div class="ic">${iconFill('coin', 22)}</div><div><b>Pague com Neutrotan (NTR)</b><span>5% de desconto + cashback</span></div></div>
      <div class="benefit"><div class="ic">${icon('leaf', 22)}</div><div><b>Tecnologia COT/PVE</b><span>Mais produtividade, solo vivo</span></div></div>
    </div>

    <section class="section" style="margin-top:34px">
      <div style="text-align:center;margin-bottom:18px">
        <span class="eyebrow">Registros, pactos e parceiros</span>
        <h2 style="font-size:22px">Nosso ecossistema</h2>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">
        ${['IBAMA*', 'Pacto Global ONU', 'Future Roots', 'ICP', 'KMA Law', 'Agroeda'].map(n => `<span style="background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 20px;font-family:var(--display);font-weight:700;color:var(--green-800);box-shadow:var(--shadow-sm)">${n}</span>`).join('')}
      </div>
      <p class="muted center" style="margin-top:14px;font-size:13px">*O IBAMA é órgão regulador — a menção indica atuação em conformidade ambiental, não parceria ou endosso. Participamos do Pacto Global da ONU e mantemos projetos auditáveis em blockchain. <a href="/transparencia" style="color:var(--green-700);font-weight:600">Ver transparência on-chain</a></p>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="eyebrow">Navegue por</span><h2>Categorias</h2></div><a href="/produtos" class="btn btn-ghost btn-sm">Ver tudo ${icon('arrow', 15)}</a></div>
      <div class="cat-grid">${cats.map(c => `<a href="/produtos${buildQuery({ cat: c.slug })}" class="cat-tile"><div class="ic">${icon(c.icon || 'leaf', 24)}</div><b>${escapeHtml(c.name.split(' ')[0])}</b><span>${c.product_count} itens</span></a>`).join('')}</div>
    </section>

    <section class="section">
      <div class="section-head"><div><span class="eyebrow">Seleção MBV</span><h2>Destaques</h2><p>Os queridinhos de quem produz com responsabilidade.</p></div><a href="/produtos${buildQuery({ sort: 'rating' })}" class="btn btn-ghost btn-sm">Mais vendidos</a></div>
      <div class="product-grid">${featured.map(productCard).join('')}</div>
    </section>

    <section class="section"><div class="hero" style="margin:0;background:linear-gradient(135deg,rgba(11,44,32,.92),rgba(15,61,46,.8)),url('https://movimentobrasilverde.com/wp-content/uploads/2026/01/top-view-of-hands-holding-young-plant-2023-03-01-01-26-51-utc-1.jpg') center/cover,#0f3d2e"><div class="hero-inner" style="grid-template-columns:1fr;padding:40px 44px;text-align:center">
      <div style="max-width:680px;margin:0 auto">
        <span class="eyebrow" style="color:var(--lime)">Sustentabilidade que dá lucro</span>
        <h1 style="font-size:32px">Do solo à energia: tudo para um agro mais limpo</h1>
        <p style="margin:14px auto 22px">Junte-se a produtores que já reduzem custos e emissões com a linha MBV.</p>
        <a href="/produtos" class="btn btn-lg" style="background:var(--lime);color:#15391f">Começar a comprar</a>
      </div>
    </div></div></section>

    <section class="section">
      <div class="section-head"><div><span class="eyebrow">Acabou de chegar</span><h2>Novidades</h2></div></div>
      <div class="product-grid">${recent.map(productCard).join('')}</div>
    </section>
    <section class="section" id="recentlyViewed"></section>
  </div>`);
  try {
    const ids = recentIds();
    if (ids.length) {
      const { items } = await API.get('/products/by-ids?ids=' + ids.join(','));
      const byId = {}; items.forEach(p => { byId[p.id] = p; });
      const ordered = ids.map(i => byId[i]).filter(Boolean).slice(0, 4);
      const el = document.getElementById('recentlyViewed');
      if (el && ordered.length) el.innerHTML = `<div class="section-head"><div><span class="eyebrow">Você viu</span><h2>Vistos recentemente</h2></div></div><div class="product-grid">${ordered.map(productCard).join('')}</div>`;
    }
  } catch (_) {}
};

/* ---------- CATALOG ---------- */
Pages.catalog = async function (query) {
  loading();
  const params = { q: query.q || '', cat: query.cat || '', min: query.min || '', max: query.max || '', sort: query.sort || '', page: query.page || 1 };
  const apiQ = buildQuery({ q: params.q, category: params.cat, min: params.min, max: params.max, sort: params.sort, page: params.page, limit: 12 });
  const data = await API.get('/products' + apiQ);
  const cats = Store.categories;
  const curCat = cats.find(c => c.slug === params.cat);
  const chips = [];
  if (params.cat && curCat) chips.push(`<button class="fchip" data-clear="cat">${escapeHtml(curCat.name)} ✕</button>`);
  if (params.q) chips.push(`<button class="fchip" data-clear="q">"${escapeHtml(params.q)}" ✕</button>`);
  if (params.min || params.max) chips.push(`<button class="fchip" data-clear="price">Preço ✕</button>`);
  if (params.sort) chips.push(`<button class="fchip" data-clear="sort">Ordenação ✕</button>`);
  const chipsHtml = chips.length ? `<div class="fchips">${chips.join('')}<button class="fchip clear" data-clear="all">Limpar tudo</button></div>` : '';

  mount(`<div class="container">
    <div class="breadcrumb"><a href="/">Início</a> ${icon('arrow', 13)} <span>${curCat ? escapeHtml(curCat.name) : params.q ? 'Busca: ' + escapeHtml(params.q) : 'Todos os produtos'}</span></div>
    <div class="catalog">
      <aside class="filters">
        <h4>Categorias</h4>
        <label><input type="radio" name="cat" value="" ${!params.cat ? 'checked' : ''}> Todas</label>
        ${cats.map(c => `<label><input type="radio" name="cat" value="${c.slug}" ${params.cat === c.slug ? 'checked' : ''}> ${escapeHtml(c.name)}</label>`).join('')}
        <h4>Faixa de preço</h4>
        <div class="range-row"><input id="fMin" type="number" placeholder="Mín" value="${params.min}"><span>—</span><input id="fMax" type="number" placeholder="Máx" value="${params.max}"></div>
        <button class="btn btn-light btn-block btn-sm" id="applyPrice" style="margin-top:10px">Aplicar</button>
        <h4>Ordenar</h4>
        ${[['', 'Relevância'], ['price_asc', 'Menor preço'], ['price_desc', 'Maior preço'], ['rating', 'Melhor avaliados'], ['newest', 'Novidades']].map(([v, l]) => `<label><input type="radio" name="sort" value="${v}" ${params.sort === v ? 'checked' : ''}> ${l}</label>`).join('')}
      </aside>
      <div>
        <div class="toolbar">
          <span class="count"><b>${data.total}</b> produto(s) encontrado(s)</span>
          <button class="btn btn-light btn-sm filters-toggle" id="filtersToggle">${icon('grid', 15)} Filtros</button>
        </div>
        ${chipsHtml}
        ${data.items.length ? `<div class="product-grid cols-3">${data.items.map(productCard).join('')}</div>` : `<div class="empty"><div class="ic">${icon('search', 28)}</div><h3>Nada encontrado${params.q ? ` para "${escapeHtml(params.q)}"` : ''}</h3><p class="muted">Tente outro termo ou navegue pelas categorias.</p>
          <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:14px 0">${Store.categories.map(c => `<a href="/produtos${buildQuery({ cat: c.slug })}" class="chip" style="text-decoration:none">${escapeHtml(c.name.split(' ')[0])}</a>`).join('')}</div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><a href="/produtos" class="btn btn-ghost btn-sm">Ver todos</a><a href="https://wa.me/554891741610?text=${encodeURIComponent('Olá! Não achei no site: ' + (params.q || ''))}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Não achou? Fale no WhatsApp</a></div>
        </div>`}
        ${data.pages > 1 ? `<div class="pagination">${Array.from({ length: data.pages }, (_, i) => i + 1).map(n => `<button class="${n == params.page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}</div>` : ''}
      </div>
    </div>
  </div>`);

  const update = (patch) => go('/produtos' + buildQuery({ ...params, cat: params.cat, ...patch }));
  app.querySelectorAll('input[name=cat]').forEach(r => r.addEventListener('change', () => update({ cat: r.value, page: 1 })));
  app.querySelectorAll('input[name=sort]').forEach(r => r.addEventListener('change', () => update({ sort: r.value, page: 1 })));
  app.querySelector('#applyPrice').addEventListener('click', () => update({ min: app.querySelector('#fMin').value, max: app.querySelector('#fMax').value, page: 1 }));
  const ft = app.querySelector('#filtersToggle');
  if (ft) ft.addEventListener('click', () => app.querySelector('.filters').classList.toggle('open'));
  app.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
    const k = b.dataset.clear;
    if (k === 'all') return go('/produtos');
    if (k === 'price') return update({ min: '', max: '', page: 1 });
    update({ [k]: '', page: 1 });
  }));
  app.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => update({ page: b.dataset.page })));
};

/* ---------- PRODUCT DETAIL ---------- */
Pages.product = async function (id) {
  loading();
  const { product: p, reviews, related } = await API.get('/products/' + id);
  setTitle(p.name);
  const off = p.compare_at_price && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
  const fav = Store.favorites.has(p.id);
  trackRecent(p.id);
  // Galeria: imagem principal + fotos extras do campo `gallery` (sem duplicar a principal).
  const gallery = [productImage(p), ...((Array.isArray(p.gallery) ? p.gallery : []).filter(u => u && u !== p.image))];
  mount(`<div class="container">
    <div class="breadcrumb"><a href="/">Início</a> ${icon('arrow', 13)} <a href="/produtos${buildQuery({ cat: p.category_slug })}">${escapeHtml(p.category_name)}</a> ${icon('arrow', 13)} <span>${escapeHtml(p.name)}</span></div>
    <div class="pdp">
      <div class="pdp-media">
        <div class="main"><img id="pdpMain" src="${gallery[0]}" onerror="${UI.imgFallback(p)}" alt="${escapeHtml(p.name)}" style="cursor:zoom-in"></div>
        ${gallery.length > 1 ? `<div class="pdp-thumbs">${gallery.map((g, i) => `<button class="pdp-thumb${i === 0 ? ' on' : ''}" data-gi="${i}" aria-label="Ver imagem ${i + 1} de ${gallery.length}" aria-pressed="${i === 0}"><img src="${g}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
      </div>
      <div>
        <span class="cat" style="color:var(--green-700);font-weight:600">${escapeHtml(p.category_name)}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <div class="rating">${p.rating_count > 0 ? stars(p.rating, p.rating_count) : `<span class="muted" style="font-size:13px">Sem avaliações ainda — seja o primeiro</span>`} ${p.stock <= 0 ? `<span class="pill pill-cancelled">Esgotado</span>` : p.stock <= 8 ? `<span class="chip" style="margin-left:8px;background:#fbe7e1;color:#c0492f">${icon('spark', 13)} Últimas ${p.stock} unidades</span>` : `<span class="chip" style="margin-left:8px">${icon('check', 13)} Em estoque</span>`}</div>
        <div class="badges" style="display:flex;gap:6px;flex-wrap:wrap;margin:14px 0">${(p.badges || []).map(b => `<span class="badge-soft">${icon('leaf', 12)} ${escapeHtml(b)}</span>`).join('')}</div>
        <div class="price-block">
          ${off ? `<span class="price-old" style="font-size:17px">${money(p.compare_at_price)}</span>` : ''}
          <span class="price">${money(p.price)}</span>${p.unit !== 'un' ? `<span class="muted">/ ${escapeHtml(p.pack_size || p.unit)}</span>` : ''}
          ${off ? `<span class="chip" style="background:var(--gold);color:#3a2a00">-${off}%</span>` : ''}
        </div>
        <div class="ntr-compare">
          <div class="opt"><span>Cartão ou Pix</span><b>${money(p.price)}</b></div>
          <div class="opt best"><span>${iconFill('coin', 13)} Pagando em NTR <em>−5%</em></span><b>${money(p.price * 0.95)}</b><small>${ntr(p.price)} · você economiza ${money(p.price * 0.05)}</small></div>
        </div>
        ${UI.installment(p.price) ? `<div class="muted" style="font-size:13px;margin-top:8px">${iconFill('card', 13)} ou até <b>${UI.installment(p.price)}</b> no cartão</div>` : ''}

        <div class="spec">
          <div class="item"><span>Embalagem</span><b>${escapeHtml(p.pack_size || '—')}</b></div>
          <div class="item"><span>Unidade</span><b>${escapeHtml(p.unit)}</b></div>
          <div class="item"><span>Disponível</span><b>${p.stock} ${escapeHtml(p.unit)}</b></div>
          <div class="item"><span>CO₂ evitado (est.)</span><b>${p.co2 ? '~' + p.co2 + ' kg/un' : '—'}</b></div>
        </div>

        <div class="buy-row">
          <div class="qty"><button data-q="-1" aria-label="Diminuir quantidade">−</button><input id="qty" value="1" inputmode="numeric" aria-label="Quantidade"><button data-q="1" aria-label="Aumentar quantidade">+</button></div>
          <button class="btn btn-primary btn-lg" id="addBtn" ${p.stock <= 0 ? 'disabled' : ''}>${icon('cart', 18)} Adicionar</button>
          <button class="btn btn-dark btn-lg" id="buyBtn" ${p.stock <= 0 ? 'disabled' : ''}>Comprar agora</button>
          <button class="btn btn-ghost btn-lg fav ${fav ? 'on' : ''}" data-fav="${p.id}" style="${fav ? 'color:var(--danger)' : ''}" aria-pressed="${fav}" aria-label="Favoritar produto">${iconFill('heart', 18)}</button>
        </div>
        <div class="cmp-row"><button class="btn btn-ghost btn-sm" id="cmpBtn"></button><a href="/comparar" class="btn btn-ghost btn-sm" id="cmpLink" style="display:none"></a></div>
        <div class="trust-row">
          <div><div class="ic">${icon('shield', 18)}</div><span>Compra<br>protegida</span></div>
          <div><div class="ic">${icon('truck', 18)}</div><span>Entrega<br>todo o Brasil</span></div>
          <div><div class="ic">${iconFill('coin', 18)}</div><span>Cartão, Pix<br>ou NTR</span></div>
          <div><div class="ic">${icon('leaf', 18)}</div><span>Tecnologia<br>COT/PVE</span></div>
        </div>
        ${p.dose_per_ha > 0 ? `<div class="dose-calc">
          <label>${icon('sprout', 15)} Calcule para a sua área</label>
          <div class="row"><input id="doseHa" type="number" min="0" step="0.5" inputmode="decimal" placeholder="Área em hectares (ha)"><button class="btn btn-light" id="doseBtn">Calcular</button></div>
          <div id="doseResult" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>` : ''}
        <div class="ship-calc">
          <label>${icon('truck', 15)} Calcular frete e prazo</label>
          <div class="row"><input id="shipCep" inputmode="numeric" maxlength="9" placeholder="Digite seu CEP"><button class="btn btn-light" id="shipBtn">Calcular</button></div>
          <div id="shipResult" class="muted" style="font-size:13px;margin-top:8px"></div>
        </div>
        ${p.co2 ? `<div class="eco-note"><div class="ic">${icon('leaf', 20)}</div><div><b>Impacto positivo (estimado)</b><br><span class="muted" style="font-size:13.5px">Estimativa de redução de ~${p.co2} kg de CO₂e por unidade vs. manejo convencional. <a href="/metodologia-co2" style="color:var(--green-700);font-weight:600">Ver metodologia</a></span></div></div>` : ''}
        <div class="desc">${escapeHtml(p.description || '').split(/\n+/).filter(Boolean).map(s => `<p>${s}</p>`).join('')}</div>
        ${(p.specs && p.specs.length) || p.mapa_reg ? `
        <div class="spec-sheet">
          <h3>${icon('grid', 16)} Ficha técnica</h3>
          ${p.mapa_reg ? `<div class="mapa-box">${icon('shield', 18)}<div><b>Registro MAPA nº ${escapeHtml(p.mapa_reg)}</b><br><a href="https://agrofit.agricultura.gov.br/agrofit_cons/principal_agrofit_cons" target="_blank" rel="noopener">Conferir no sistema público do MAPA ↗</a></div></div>` : ''}
          ${p.specs && p.specs.length ? `<table class="spec-table"><tbody>${p.specs.map(s => `<tr><td>${escapeHtml(s.k)}</td><td>${escapeHtml(s.v)}</td></tr>`).join('')}</tbody></table>` : ''}
        </div>` : ''}
      </div>
    </div>

    <section class="section">
      <div class="section-head"><h2>Avaliações</h2></div>
      <div style="background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:8px 22px 22px">
        <div id="reviewList">${reviews.length ? reviews.map(reviewRow).join('') : `<p class="muted" style="padding:20px 0">Ainda não há avaliações. Seja o primeiro!</p>`}</div>
        ${Store.isAuthed() ? `<div style="border-top:1px solid var(--line);padding-top:18px;margin-top:8px">
          <h4 style="margin-bottom:10px">Avaliar produto</h4>
          <div class="field"><label>Nota</label><select id="rvRating" class="select"><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Bom</option><option value="3">★★★ Regular</option><option value="2">★★ Ruim</option><option value="1">★ Péssimo</option></select></div>
          <div class="field"><label>Comentário</label><textarea id="rvComment" placeholder="Conte como foi sua experiência"></textarea></div>
          <button class="btn btn-primary" id="rvSubmit">Enviar avaliação</button>
        </div>` : `<p class="muted" style="padding-top:14px"><a href="/entrar" style="color:var(--green-700);font-weight:600">Entre na sua conta</a> para avaliar.</p>`}
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Perguntas frequentes</h2></div>
      <div class="faq">${productFAQ(p).map(f => `<details><summary>${escapeHtml(f.q)}</summary><div>${escapeHtml(f.a)}</div></details>`).join('')}</div>
    </section>

    ${related.length ? `<section class="section"><div class="section-head"><h2>Você também pode gostar</h2></div><div class="product-grid">${related.map(productCard).join('')}</div></section>` : ''}

    <div class="buybar" id="buybar" hidden>
      <div class="bb-info"><b>${money(p.price)}</b><small>${escapeHtml(p.name)}</small></div>
      <button class="btn btn-primary" id="bbAdd" ${p.stock <= 0 ? 'disabled' : ''}>${icon('cart', 16)} Adicionar</button>
    </div>
  </div>`);

  const qtyEl = app.querySelector('#qty');
  app.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    qtyEl.value = Math.max(1, Math.min(p.stock, (parseInt(qtyEl.value) || 1) + parseInt(b.dataset.q)));
  }));
  app.querySelector('#addBtn').addEventListener('click', () => addToCart(p.id, parseInt(qtyEl.value) || 1));
  app.querySelector('#buyBtn').addEventListener('click', async () => { await addToCart(p.id, parseInt(qtyEl.value) || 1); go('/checkout'); });

  // Galeria: thumbs, setas do teclado, swipe no mobile e zoom em modal.
  const mainImg = app.querySelector('#pdpMain');
  let gCur = 0;
  const setImg = (i) => {
    gCur = (i + gallery.length) % gallery.length;
    mainImg.src = gallery[gCur];
    app.querySelectorAll('.pdp-thumb').forEach((b, j) => { b.classList.toggle('on', j === gCur); b.setAttribute('aria-pressed', String(j === gCur)); });
  };
  app.querySelectorAll('.pdp-thumb').forEach(b => b.addEventListener('click', () => setImg(Number(b.dataset.gi))));
  if (gallery.length > 1) {
    app.querySelector('.pdp-media').addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); setImg(gCur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setImg(gCur - 1); }
    });
    let tx = null;
    mainImg.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
    mainImg.addEventListener('touchend', e => {
      if (tx == null) return;
      const dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) setImg(gCur + (dx < 0 ? 1 : -1));
      tx = null;
    }, { passive: true });
  }
  mainImg.addEventListener('click', () => {
    UI.openModal(p.name, `<img src="${gallery[gCur]}" alt="${escapeHtml(p.name)}" style="width:100%;border-radius:12px">`, { maxWidth: 720 });
  });

  // Barra de compra fixa no mobile: aparece quando a buy-row original sai da tela.
  const buybar = app.querySelector('#buybar');
  const buyRow = app.querySelector('.buy-row');
  if (buybar && buyRow && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([en]) => { buybar.hidden = en.isIntersecting; });
    io.observe(buyRow);
    app.querySelector('#bbAdd').addEventListener('click', () => addToCart(p.id, parseInt(qtyEl.value) || 1));
  }
  const refreshCmp = () => {
    const ids = compareIds(); const cb = app.querySelector('#cmpBtn'), lk = app.querySelector('#cmpLink');
    if (cb) cb.innerHTML = `${icon('grid', 14)} ${ids.includes(p.id) ? 'No comparador ✓' : 'Comparar'}`;
    if (lk) { lk.style.display = ids.length ? 'inline-flex' : 'none'; lk.innerHTML = `Ver comparador (${ids.length})`; }
  };
  app.querySelector('#cmpBtn').addEventListener('click', () => { toggleCompare(p.id); refreshCmp(); });
  refreshCmp();
  const shipBtn = app.querySelector('#shipBtn');
  if (shipBtn) {
    const cepEl = app.querySelector('#shipCep'); const out = app.querySelector('#shipResult');
    const calc = async () => {
      const cep = (cepEl.value || '').replace(/\D/g, '');
      if (cep.length !== 8) { out.textContent = 'Digite um CEP válido (8 dígitos).'; return; }
      out.textContent = 'Calculando…';
      try {
        const r = await API.get(`/shipping?cep=${cep}&value=${p.price}`);
        out.innerHTML = r.free
          ? `<b class="green">Frete grátis</b> · entrega em ${r.prazo} dias úteis`
          : `Frete: <b>${money(r.shipping)}</b> · entrega em ${r.prazo} dias úteis. <span class="muted">Grátis acima de ${money(r.freeAbove)}.</span>`;
      } catch (e) { out.textContent = e.message; }
    };
    shipBtn.addEventListener('click', calc);
    cepEl.addEventListener('keydown', e => { if (e.key === 'Enter') calc(); });
  }
  const doseBtn = app.querySelector('#doseBtn');
  if (doseBtn) {
    const haEl = app.querySelector('#doseHa'); const out = app.querySelector('#doseResult');
    const calc = () => {
      const ha = parseFloat(haEl.value) || 0;
      if (ha <= 0) { out.textContent = 'Informe a área em hectares.'; return; }
      const total = Math.round(ha * p.dose_per_ha * 10) / 10;
      const units = Math.max(1, Math.ceil(total / (p.pack_qty || 1)));
      out.innerHTML = `Para <b>${ha} ha</b> (~${total} ${escapeHtml(p.unit)}): <b>${units}× ${escapeHtml(p.pack_size || 'un')}</b> · ${money(units * p.price)} <button class="btn btn-primary btn-sm" id="doseAdd" style="margin-left:6px">Adicionar ${units}</button>`;
      const add = app.querySelector('#doseAdd'); if (add) add.addEventListener('click', () => addToCart(p.id, units));
    };
    doseBtn.addEventListener('click', calc);
    haEl.addEventListener('keydown', e => { if (e.key === 'Enter') calc(); });
  }
  const rv = app.querySelector('#rvSubmit');
  if (rv) rv.addEventListener('click', async () => {
    try {
      await API.post('/products/' + p.id + '/reviews', { rating: app.querySelector('#rvRating').value, comment: app.querySelector('#rvComment').value });
      toast('Obrigado!', 'Avaliação registrada.'); Pages.product(id);
    } catch (e) { toast('Ops', e.message, 'err'); }
  });
};
function productFAQ(p) {
  const cert = (p.badges && p.badges.length) ? p.badges.join(', ') : 'biotecnologia COT/PVE';
  return [
    { q: `O ${p.name} é sustentável?`, a: `Sim. É produzido com ${cert}, dentro da proposta de agricultura regenerativa do MBV.` },
    { q: 'Quais as formas de pagamento?', a: 'Cartão, Pix ou o token Neutrotan (NTR). Pagando em NTR você ganha 5% de desconto e cashback.' },
    { q: 'Qual o prazo e o valor do frete?', a: 'O frete é calculado pelo seu CEP no checkout. Em compras acima de R$ 500, o frete é grátis.' },
    { q: 'Posso trocar ou devolver?', a: 'Sim. Você tem até 7 dias corridos após o recebimento para desistir, conforme o Código de Defesa do Consumidor.' },
    ...(p.co2 ? [{ q: 'Qual o impacto ambiental?', a: `Estimamos uma redução de cerca de ${p.co2} kg de CO₂e por unidade em relação ao manejo convencional. Veja a metodologia em /metodologia-co2.` }] : []),
    { q: 'Como descubro a dosagem ideal?', a: 'Nossa equipe técnica orienta dosagem e manejo pelo WhatsApp +55 48 9174-1610.' }
  ];
}
function reviewRow(r) {
  return `<div class="review" style="display:flex;gap:14px"><div class="avatar">${escapeHtml((r.user_name || 'U')[0].toUpperCase())}</div>
    <div style="flex:1"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${escapeHtml(r.user_name || 'Cliente')}${r.verified ? ` <span class="badge-soft" style="font-size:10px;font-weight:700">${icon('check', 10)} Compra verificada</span>` : ''}</b><span class="stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span></div>
    <p class="muted" style="margin:4px 0 0;font-size:14px">${escapeHtml(r.comment || '')}</p></div></div>`;
}

/* Estado que persiste entre carrinho e checkout */
const Flow = { coupon: '', payment: 'card', cep: '', cpf: '' };

/* ---------- CART ---------- */
Pages.cart = async function () {
  loading();
  let data;
  if (Store.isAuthed()) {
    data = await API.get('/cart' + buildQuery({ coupon: Flow.coupon }));
  } else {
    const cart = Store.guestCart();
    if (!cart.length) data = { items: [], count: 0, guest: true };
    else {
      const { items: prods } = await API.get('/products/by-ids?ids=' + cart.map(i => i.product_id).join(','));
      const byId = {}; prods.forEach(p => { byId[p.id] = p; });
      const items = cart.filter(i => byId[i.product_id]).map(i => {
        const p = byId[i.product_id];
        return { product_id: p.id, name: p.name, price: p.price, image: p.image, unit: p.unit, category_slug: p.category_slug, pack_size: p.pack_size, quantity: i.quantity };
      });
      const subtotal = Math.round(items.reduce((s, it) => s + it.price * it.quantity, 0) * 100) / 100;
      data = { items, count: items.reduce((s, i) => s + i.quantity, 0), subtotal, guest: true };
    }
  }
  if (!data.items.length) {
    return mount(`<div class="container"><div class="empty" style="margin:50px 0"><div class="ic">${icon('cart', 32)}</div><h2>Seu carrinho está vazio</h2><p class="muted">Que tal explorar nossos insumos sustentáveis?</p><a href="/produtos" class="btn btn-primary btn-lg" style="margin-top:16px">Ver produtos</a></div></div>`);
  }
  mount(`<div class="container">
    <h1 style="margin:24px 0 4px;font-size:27px">Seu carrinho</h1>
    <p class="muted" style="margin-bottom:18px">${data.count} item(ns)</p>
    <div class="cart-wrap">
      <div id="cartLines">${data.items.map(cartLine).join('')}</div>
      ${data.guest ? guestSummary(data.subtotal) : summaryBox(data.totals, 'carrinho')}
    </div>
    <section class="section" id="crossSell" style="margin-top:30px"></section>
  </div>`);
  wireCartLines();
  if (!data.guest) wireSummary('carrinho');
  try {
    const cartIds = new Set(data.items.map(i => i.product_id));
    const { items: recs } = await API.get('/products?sort=rating&limit=8');
    const list = recs.filter(p => !cartIds.has(p.id)).slice(0, 4);
    const cs = app.querySelector('#crossSell');
    if (cs && list.length) cs.innerHTML = `<div class="section-head"><h2 style="font-size:20px">Complete seu manejo</h2></div><div class="product-grid">${list.map(productCard).join('')}</div>`;
  } catch (_) {}
};
function guestSummary(subtotal) {
  return `<div class="summary" id="summaryBox">
    <h3>Resumo</h3>
    <div class="sum-row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    <div class="sum-row"><span>Frete e cupom</span><span class="muted">no checkout</span></div>
    <div class="sum-row total"><span>Total parcial</span><span>${money(subtotal)}</span></div>
    <div class="price-mbv" style="text-align:right;margin:4px 0 2px">${iconFill('coin', 13)} ${money(subtotal * 0.95)} pagando em NTR · <b>−5%</b></div>
    <a href="/entrar?next=${encodeURIComponent('/checkout')}" class="btn btn-primary btn-block btn-lg" style="margin-top:10px">Entrar para finalizar ${icon('arrow', 17)}</a>
    <p class="muted center" style="font-size:12px;margin-top:12px">${icon('shield', 12)} Seu carrinho fica salvo. Frete, cupom e pagamento na próxima etapa.</p>
  </div>`;
}
function cartLine(it) {
  return `<div class="cart-line" data-line="${it.product_id}">
    <a href="/produto/${it.product_id}" class="ci-thumb"><img src="${productImage(it)}" onerror="${UI.imgFallback(it)}"></a>
    <div>
      <a href="/produto/${it.product_id}" style="font-weight:600;font-family:var(--display)">${escapeHtml(it.name)}</a>
      <div class="muted" style="font-size:13px;margin:3px 0 8px">${money(it.price)} ${it.unit !== 'un' ? '/ ' + escapeHtml(it.unit) : ''}</div>
      <div class="qty"><button data-cq="-1" aria-label="Diminuir quantidade">−</button><input value="${it.quantity}" data-qval readonly aria-label="Quantidade de ${escapeHtml(it.name)}"><button data-cq="1" aria-label="Aumentar quantidade">+</button></div>
    </div>
    <div style="text-align:right">
      <div class="price" style="font-size:17px">${money(it.price * it.quantity)}</div>
      <button class="btn btn-ghost btn-sm" data-rm style="margin-top:10px;color:var(--danger);border-color:#f0d4d4">${icon('trash', 14)} Remover</button>
    </div>
  </div>`;
}
function wireCartLines() {
  const authed = Store.isAuthed();
  app.querySelectorAll('[data-line]').forEach(line => {
    const id = Number(line.dataset.line);
    line.querySelectorAll('[data-cq]').forEach(b => b.addEventListener('click', async () => {
      const cur = parseInt(line.querySelector('[data-qval]').value) || 1;
      const q = Math.max(0, cur + parseInt(b.dataset.cq));
      if (authed) { await API.put('/cart/' + id, { quantity: q }); await Store.refreshCart(); }
      else { Store.guestSetQty(id, q); }
      renderHeader(); Pages.cart();
    }));
    line.querySelector('[data-rm]').addEventListener('click', async () => {
      if (authed) { await API.del('/cart/' + id); await Store.refreshCart(); }
      else { Store.guestSetQty(id, 0); }
      renderHeader(); Pages.cart();
    });
  });
}

/* ---------- Caixa de resumo (compartilhada) ---------- */
function summaryBox(t, mode) {
  const freeShip = t.shipping === 0;
  const freeAbove = 500;
  const base = Math.max(0, t.subtotal - t.discount);
  const remaining = Math.round((freeAbove - base) * 100) / 100;
  return `<div class="summary" id="summaryBox">
    <h3>Resumo</h3>
    <div class="sum-row"><span>Subtotal</span><span>${money(t.subtotal)}</span></div>
    ${t.couponDiscount > 0 ? `<div class="sum-row"><span class="green">Cupom ${escapeHtml(t.coupon ? t.coupon.code : '')}</span><span class="green">− ${money(t.couponDiscount)}</span></div>` : ''}
    ${t.cryptoDiscount > 0 ? `<div class="sum-row"><span class="green">Desconto NTR (5%)</span><span class="green">− ${money(t.cryptoDiscount)}</span></div>` : ''}
    <div class="sum-row"><span>Frete</span><span>${freeShip ? '<b class="green">Grátis</b>' : money(t.shipping)}</span></div>
    ${!freeShip && remaining > 0 ? `<div class="ship-nudge"><div class="bar"><span style="width:${Math.min(100, base / freeAbove * 100)}%"></span></div><small>Faltam <b>${money(remaining)}</b> para o <b class="green">frete grátis</b></small></div>` : ''}
    <div class="sum-row total"><span>Total</span><span>${money(t.total)}</span></div>
    <div class="price-mbv" style="text-align:right;margin:4px 0 2px">${iconFill('coin', 13)} ${mbv(t.mbvAmount)} · cashback de ${mbv(t.cashbackMbv)}</div>
    <div class="coupon-row">
      <input id="couponInput" placeholder="Cupom (ex: COINMAX)" value="${escapeHtml(Flow.coupon)}" aria-label="Código do cupom">
      <button class="btn btn-light" id="applyCoupon">Aplicar</button>
    </div>
    ${t.couponError ? `<div class="field-err" role="alert" style="margin:-6px 0 10px">${escapeHtml(t.couponError)}</div>` : ''}
    ${t.coupon ? `<div class="badge-soft" style="margin-bottom:12px">${icon('check', 12)} ${escapeHtml(t.coupon.description || t.coupon.code)}</div>` : ''}
    ${mode === 'carrinho'
      ? `<a href="/checkout" class="btn btn-primary btn-block btn-lg">Finalizar compra ${icon('arrow', 17)}</a>`
      : `<button class="btn btn-primary btn-block btn-lg" id="placeOrder">Confirmar pedido ${icon('check', 17)}</button>`}
    <p class="muted center" style="font-size:12px;margin-top:12px">${icon('shield', 12)} Compra protegida · Cartão · Pix · Neutrotan (NTR)</p>
  </div>`;
}
function wireSummary(mode) {
  const apply = app.querySelector('#applyCoupon');
  if (apply) apply.addEventListener('click', async () => {
    const code = app.querySelector('#couponInput').value.trim().toUpperCase();
    Flow.coupon = code;
    if (mode === 'carrinho') return Pages.cart();
    refreshCheckoutSummary();
    if (code) {
      try { await API.post('/coupons/validate', { code, payment: Flow.payment }); toast('Cupom aplicado!', '', 'ok'); }
      catch (e) { Flow.coupon = ''; toast('Cupom', e.message, 'err'); refreshCheckoutSummary(); }
    }
  });
}

/* ---------- Máscaras e validação inline (sem lib) ---------- */
const Mask = {
  cep: v => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'),
  cpfCnpj: v => {
    const d = v.replace(/\D/g, '').slice(0, 14);
    return d.length <= 11
      ? d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      : d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  },
  phone: v => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },
  card: v => v.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 '),
  expiry: v => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d; }
};
function applyMask(el, fn) {
  if (!el) return;
  el.addEventListener('input', () => { el.value = fn(el.value); });
}
// Mostra/limpa erro sob o campo (borda vermelha + mensagem + aria-invalid).
function fieldError(el, msg) {
  if (!el) return;
  const field = el.closest('.field') || el.parentElement;
  let err = field.querySelector('.field-err');
  if (msg) {
    el.setAttribute('aria-invalid', 'true'); el.classList.add('invalid');
    if (!err) { err = document.createElement('span'); err.className = 'field-err'; field.appendChild(err); }
    err.textContent = msg;
  } else {
    el.removeAttribute('aria-invalid'); el.classList.remove('invalid');
    if (err) err.remove();
  }
}
// Ao digitar num campo marcado como inválido, o erro some (1 listener global, sem vazamento).
document.addEventListener('input', e => {
  if (e.target && e.target.getAttribute && e.target.getAttribute('aria-invalid') === 'true') fieldError(e.target, '');
});

/* ---------- CHECKOUT ---------- */
Pages.checkout = async function () {
  if (!Store.isAuthed()) return go('/entrar?next=' + encodeURIComponent('/checkout'));
  loading();
  const data = await API.get('/cart' + buildQuery({ coupon: Flow.coupon, payment: Flow.payment, cep: Flow.cep, cpf: Flow.cpf }));
  if (!data.items.length) return go('/carrinho');
  await Store.refreshUser();

  mount(`<div class="container">
    <div class="breadcrumb"><a href="/carrinho">Carrinho</a> ${icon('arrow', 13)} <span>Checkout</span></div>
    <div class="checkout">
      <div>
        <div class="panel">
          <h3>${icon('truck', 18)} Endereço de entrega</h3>
          <div class="field"><label>Nome completo</label><input id="s_name" value="${escapeHtml(Store.user.name)}" autocomplete="name"></div>
          <div class="field"><label>CPF/CNPJ <span class="muted" style="font-weight:400">(para nota fiscal e cupons exclusivos)</span></label><input id="s_cpf" placeholder="000.000.000-00" value="${escapeHtml(Flow.cpf || '')}" inputmode="numeric"></div>
          <div class="grid-2">
            <div class="field"><label>CEP</label><input id="s_cep" placeholder="00000-000" inputmode="numeric" autocomplete="postal-code"><span id="cepHint" class="muted" style="font-size:12.5px" aria-live="polite"></span></div>
            <div class="field"><label>Telefone</label><input id="s_phone" placeholder="(00) 00000-0000" inputmode="tel" autocomplete="tel-national"></div>
          </div>
          <div class="field"><label>Endereço (rua, nº, complemento)</label><input id="s_address" placeholder="Rua, número, bairro" autocomplete="street-address"></div>
          <div class="grid-2">
            <div class="field"><label>Cidade</label><input id="s_city" autocomplete="address-level2"></div>
            <div class="field"><label>Estado (UF)</label><input id="s_state" maxlength="2" placeholder="SP" autocomplete="address-level1" style="text-transform:uppercase"></div>
          </div>
        </div>

        <div class="panel">
          <h3>${iconFill('coin', 18)} Forma de pagamento</h3>
          <div class="pay-methods">
            <div class="pay-opt" data-pay="card"><div class="ic">${icon('card', 20)}</div><b>Cartão</b><span>Crédito/Débito</span></div>
            <div class="pay-opt" data-pay="pix"><div class="ic">${icon('pix', 20)}</div><b>Pix</b><span>Aprovação imediata</span></div>
            <div class="pay-opt" data-pay="mbv"><div class="ic">${iconFill('coin', 20)}</div><b>NTR</b><span>Neutrotan · 5% OFF</span></div>
          </div>
          <div id="payPanel"></div>
        </div>
      </div>
      <div id="summaryWrap">${summaryBox(data.totals, 'checkout')}</div>
    </div>
  </div>`);

  lastTotals = data.totals; // disponível já no primeiro setPayment (nudge NTR)
  setPayment(Flow.payment);
  app.querySelectorAll('[data-pay]').forEach(o => o.addEventListener('click', () => setPayment(o.dataset.pay)));
  wireSummary('checkout');
  app.querySelector('#placeOrder').addEventListener('click', placeOrder);
  applyMask(app.querySelector('#s_cep'), Mask.cep);
  applyMask(app.querySelector('#s_cpf'), Mask.cpfCnpj);
  applyMask(app.querySelector('#s_phone'), Mask.phone);
  const cepEl = app.querySelector('#s_cep');
  if (cepEl) cepEl.addEventListener('blur', async () => {
    const cep = cepEl.value.replace(/\D/g, '');
    Flow.cep = cep;
    const hint = app.querySelector('#cepHint');
    if (cep.length === 8) {
      if (hint) hint.textContent = 'Buscando endereço pelo CEP…';
      try {
        const r = await fetch('https://viacep.com.br/ws/' + cep + '/json/');
        const dd = await r.json();
        if (!dd.erro) {
          if (dd.logradouro && !app.querySelector('#s_address').value) app.querySelector('#s_address').value = dd.logradouro + (dd.bairro ? ', ' + dd.bairro : '');
          if (dd.localidade) app.querySelector('#s_city').value = dd.localidade;
          if (dd.uf) app.querySelector('#s_state').value = dd.uf;
          if (hint) hint.textContent = '';
        } else if (hint) hint.textContent = 'CEP não encontrado — preencha o endereço manualmente.';
      } catch (_) { if (hint) hint.textContent = 'Não foi possível consultar o CEP — preencha manualmente.'; }
    } else if (hint) hint.textContent = '';
    refreshCheckoutSummary();
  });
  const cpfEl = app.querySelector('#s_cpf');
  if (cpfEl) cpfEl.addEventListener('blur', () => { Flow.cpf = cpfEl.value; refreshCheckoutSummary(); });
};

// Banner "pague em NTR e economize" — aparece em Cartão/Pix quando o saldo interno cobre o pedido.
function ntrNudge() {
  if (!lastTotals || (Store.chain && Store.chain.enabled)) return ''; // no modo on-chain o saldo interno não paga
  const econ = Math.round(((lastTotals.subtotal - (lastTotals.couponDiscount || 0)) * 0.05) * 100) / 100;
  const needed = Math.round(((lastTotals.total - econ) / (Store.rate || 9.36)) * 100) / 100;
  if (econ <= 0 || Store.balance < needed) return '';
  return `<button type="button" class="ntr-nudge" id="ntrNudge">${iconFill('coin', 14)} <span>Você tem <b>${mbv(Store.balance)}</b> — pague em NTR e <b>economize ${money(econ)}</b></span></button>`;
}
function setPayment(method) {
  Flow.payment = method;
  app.querySelectorAll('[data-pay]').forEach(o => o.classList.toggle('active', o.dataset.pay === method));
  const panel = app.querySelector('#payPanel');
  const mpOn = Store.chain && Store.chain.mpEnabled;
  if (method === 'card') {
    panel.innerHTML = (mpOn
      ? `<div class="eco-note"><div class="ic">${icon('card', 20)}</div><div><b>Cartão via Mercado Pago</b><br><span class="muted" style="font-size:13.5px">Você será direcionado ao ambiente seguro do Mercado Pago para pagar com cartão. O pedido é confirmado automaticamente.</span></div></div>`
      : `<div class="field"><label>Número do cartão</label><input id="c_number" placeholder="0000 0000 0000 0000" inputmode="numeric" autocomplete="cc-number"></div>
      <div class="field"><label>Nome impresso no cartão</label><input id="c_name" placeholder="Como está no cartão" autocomplete="cc-name"></div>
      <div class="grid-2"><div class="field"><label>Validade</label><input id="c_expiry" placeholder="MM/AA" inputmode="numeric" autocomplete="cc-exp"></div><div class="field"><label>CVV</label><input id="c_cvv" placeholder="123" inputmode="numeric" autocomplete="cc-csc" maxlength="4"></div></div>
      <p class="muted" style="font-size:12px">${icon('shield', 12)} Ambiente de demonstração — não insira dados reais.</p>`) + ntrNudge();
    applyMask(panel.querySelector('#c_number'), Mask.card);
    applyMask(panel.querySelector('#c_expiry'), Mask.expiry);
  } else if (method === 'pix') {
    panel.innerHTML = (mpOn
      ? `<div class="eco-note"><div class="ic">${icon('pix', 20)}</div><div><b>Pix via Mercado Pago</b><br><span class="muted" style="font-size:13.5px">Você será direcionado ao Mercado Pago para pagar com Pix. Aprovação na hora.</span></div></div>`
      : `<div class="eco-note"><div class="ic">${icon('pix', 20)}</div><div><b>Pix</b><br><span class="muted" style="font-size:13.5px">O código copia-e-cola será gerado ao confirmar o pedido. Pagamento com aprovação imediata.</span></div></div>`) + ntrNudge();
  } else if (Store.chain && Store.chain.enabled) {
    // Pagamento on-chain real (carteira do cliente / MetaMask)
    panel.innerHTML = `<div class="mbv-pay">
      <div style="display:flex;justify-content:space-between;align-items:center"><span>Pagar com</span><b>NTR · ${escapeHtml(Store.chain.name)}</b></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:14px;color:#cfe9d6"><span>Total em NTR</span><b id="mbvTotal">${lastTotals ? mbv(lastTotals.mbvAmount) : '—'}</b></div>
      <div style="margin-top:10px;font-size:13px;color:#cfe9d6">${icon('check', 13)} Conecte a MetaMask e confirme o pagamento na próxima etapa. Tenha NTR + um pouco de ${escapeHtml(Store.chain.nativeSymbol)} (taxa de rede) na carteira.</div>
    </div>`;
  } else {
    const enough = Store.balance >= (lastTotals ? lastTotals.mbvAmount : 0);
    panel.innerHTML = `<div class="mbv-pay">
      <div style="display:flex;justify-content:space-between;align-items:center"><span>Seu saldo</span><span class="bal">${mbv(Store.balance)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:14px;color:#cfe9d6"><span>Total em NTR</span><b id="mbvTotal">${lastTotals ? mbv(lastTotals.mbvAmount) : '—'}</b></div>
      ${!enough ? `<div style="background:rgba(255,255,255,.15);border-radius:10px;padding:10px;margin-top:12px;font-size:13px">Saldo insuficiente. <a href="/carteira" style="color:var(--lime);font-weight:700">Recarregar carteira →</a></div>` : `<div style="margin-top:10px;font-size:13px;color:#cfe9d6">${icon('check', 13)} Você ganha 5% de desconto pagando com Neutrotan (NTR).</div>`}
    </div>`;
  }
  const nb = panel.querySelector('#ntrNudge');
  if (nb) nb.addEventListener('click', () => setPayment('mbv'));
  refreshCheckoutSummary();
}

let lastTotals = null;
async function refreshCheckoutSummary() {
  try {
    const data = await API.get('/cart' + buildQuery({ coupon: Flow.coupon, payment: Flow.payment, cep: Flow.cep, cpf: Flow.cpf }));
    lastTotals = data.totals;
    const wrap = app.querySelector('#summaryWrap');
    if (wrap) { wrap.innerHTML = summaryBox(data.totals, 'checkout'); wireSummary('checkout'); app.querySelector('#placeOrder').addEventListener('click', placeOrder); }
    const mt = app.querySelector('#mbvTotal'); if (mt) mt.textContent = mbv(data.totals.mbvAmount);
  } catch (_) {}
}

async function placeOrder() {
  const $ = (sel) => app.querySelector(sel);
  const ship = {
    name: $('#s_name').value.trim(), cep: $('#s_cep').value.trim(),
    address: $('#s_address').value.trim(), city: $('#s_city').value.trim(),
    state: $('#s_state').value.trim().toUpperCase(), phone: $('#s_phone').value.trim()
  };
  // Validação inline: TODOS os campos de uma vez, erro sob cada campo, foco no primeiro.
  const checks = [
    ['#s_name', !!ship.name, 'Informe o nome completo.'],
    ['#s_cep', ship.cep.replace(/\D/g, '').length === 8, 'Informe um CEP válido (8 dígitos).'],
    ['#s_address', !!ship.address, 'Informe rua, número e bairro.'],
    ['#s_city', !!ship.city, 'Informe a cidade.'],
    ['#s_state', /^[A-Z]{2}$/.test(ship.state), 'UF com 2 letras (ex.: SP).']
  ];
  const simCard = Flow.payment === 'card' && !(Store.chain && Store.chain.mpEnabled);
  if (simCard) {
    checks.push(
      ['#c_number', /^\d{13,19}$/.test($('#c_number').value.replace(/\s/g, '')), 'Número de cartão inválido.'],
      ['#c_name', !!$('#c_name').value.trim(), 'Informe o nome impresso no cartão.'],
      ['#c_expiry', /^\d{2}\/\d{2}$/.test($('#c_expiry').value), 'Validade no formato MM/AA.'],
      ['#c_cvv', /^\d{3,4}$/.test($('#c_cvv').value), 'CVV com 3 ou 4 dígitos.']
    );
  }
  let firstBad = null;
  for (const [sel, ok, msg] of checks) {
    const el = $(sel);
    fieldError(el, ok ? '' : msg);
    if (!ok && !firstBad) firstBad = el;
  }
  if (firstBad) {
    firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstBad.focus({ preventScroll: true });
    return toast('Revise os campos destacados', '', 'err');
  }
  const body = { payment_method: Flow.payment, coupon_code: Flow.coupon, shipping: ship, cpf: Flow.cpf };
  if (simCard) {
    body.card = { number: $('#c_number').value, name: $('#c_name').value, expiry: $('#c_expiry').value, cvv: $('#c_cvv').value };
  }
  const btn = app.querySelector('#placeOrder'); btn.disabled = true; btn.textContent = 'Processando…';
  try {
    const resp = await API.post('/orders', body);
    Flow.coupon = ''; await Store.refreshCart(); await Store.refreshUser(); renderHeader();
    if (resp.redirect) { toast('Redirecionando…', 'Você será levado ao Mercado Pago.', 'info'); window.location.href = resp.redirect; return; }
    const order = resp.order;
    if (order.payment_status === 'paid') toast('Pedido confirmado!', 'Pedido ' + order.code, 'ok');
    else toast('Pedido criado', 'Finalize o pagamento na próxima tela.', 'info');
    go('/pedido/' + order.id);
  } catch (e) { toast('Não foi possível finalizar', e.message, 'err'); btn.disabled = false; btn.innerHTML = 'Confirmar pedido'; }
}

/* ---------- ORDER DETAIL / CONFIRMATION ---------- */
Pages.orderDetail = async function (id) {
  if (!Store.isAuthed()) return go('/entrar');
  loading();
  const { order: o } = await API.get('/orders/' + id);
  const paid = o.payment_status === 'paid';
  mount(`<div class="container" style="max-width:860px">
    <div style="text-align:center;margin:30px 0 24px">
      <div style="width:70px;height:70px;border-radius:50%;background:${paid ? 'var(--green-100)' : '#fdf1dc'};color:${paid ? 'var(--green-700)' : 'var(--warn)'};display:grid;place-items:center;margin:0 auto 14px">${icon(paid ? 'check' : (o.payment_method === 'mbv' ? 'coin' : 'card'), 32)}</div>
      <h1>${paid ? 'Pedido confirmado!' : 'Pedido criado — finalize o pagamento'}</h1>
      <p class="muted">Pedido <b>${escapeHtml(o.code)}</b> · ${new Date(o.created_at + 'Z').toLocaleString('pt-BR')}</p>
    </div>

    ${paymentPanel(o, paid)}

    <div class="panel">
      <div class="panel-head"><h3 style="margin:0">Itens</h3>${statusPill(o.status)} ${statusPill(o.payment_status)}</div>
      ${o.items.map(it => `<div style="display:flex;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)">
        <img src="${productImage(it)}" onerror="${UI.imgFallback(it)}" style="width:54px;height:54px;border-radius:10px;object-fit:cover">
        <div style="flex:1"><b style="font-family:var(--display)">${escapeHtml(it.name)}</b><div class="muted" style="font-size:13px">${it.quantity} × ${money(it.price)}</div></div>
        <b>${money(it.price * it.quantity)}</b></div>`).join('')}
      <div style="margin-top:14px">
        <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
        ${o.discount > 0 ? `<div class="sum-row"><span class="green">Descontos</span><span class="green">− ${money(o.discount)}</span></div>` : ''}
        <div class="sum-row"><span>Frete</span><span>${o.shipping === 0 ? 'Grátis' : money(o.shipping)}</span></div>
        <div class="sum-row total"><span>Total</span><span>${money(o.total)}</span></div>
        ${o.payment_method === 'mbv' ? `<div class="price-mbv" style="text-align:right">Pago com ${mbv(o.mbv_amount)}</div>` : ''}
        ${o.cashback_mbv > 0 ? `<div class="price-mbv" style="text-align:right">${iconFill('coin', 12)} Cashback de ${mbv(o.cashback_mbv)} ${paid ? 'creditado' : 'após pagamento'}</div>` : ''}
      </div>
    </div>

    <div class="panel">
      <h3>${icon('truck', 18)} Entrega</h3>
      <p style="margin:0;line-height:1.7">${escapeHtml(o.ship_name)}<br>${escapeHtml(o.ship_address)}<br>${escapeHtml(o.ship_city)} — ${escapeHtml(o.ship_state)} · CEP ${escapeHtml(o.ship_cep)}${o.ship_phone ? '<br>Tel: ' + escapeHtml(o.ship_phone) : ''}</p>
    </div>

    <div style="display:flex;gap:12px;justify-content:center;margin-top:8px">
      <a href="/pedidos" class="btn btn-ghost">Meus pedidos</a>
      <a href="/produtos" class="btn btn-primary">Continuar comprando</a>
    </div>
  </div>`);

  const cf = app.querySelector('#confirmPix');
  if (cf) cf.addEventListener('click', async () => {
    cf.disabled = true; cf.textContent = 'Confirmando…';
    try { await API.post('/orders/' + o.id + '/confirm-pix'); await Store.refreshUser(); renderHeader(); toast('Pagamento confirmado!', '', 'ok'); Pages.orderDetail(id); }
    catch (e) { toast('Ops', e.message, 'err'); }
  });
  const cp = app.querySelector('#copyPix');
  if (cp) cp.addEventListener('click', () => { navigator.clipboard.writeText(o.pix_code); toast('Código copiado!', '', 'ok'); });
  const po = app.querySelector('#payOnchain');
  if (po) po.addEventListener('click', () => payOrderOnchain(o));
  const vm = app.querySelector('#verifyManual');
  if (vm) vm.addEventListener('click', () => verifyOnchainManual(o));
  const ro = app.querySelector('#refreshOrder');
  if (ro) ro.addEventListener('click', () => Pages.orderDetail(o.id));
};
function paymentPanel(o, paid) {
  if (paid) return '';
  const mpOn = Store.chain && Store.chain.mpEnabled;
  if (o.payment_method === 'mbv' && Store.chain && Store.chain.enabled) return onchainPanel(o);
  if ((o.payment_method === 'card' || o.payment_method === 'pix') && mpOn) return mpPendingPanel(o);
  if (o.payment_method === 'pix') return pixPanel(o);
  return '';
}
function mpPendingPanel(o) {
  return `<div class="panel"><div class="pix-box">
    <div style="width:56px;height:56px;border-radius:50%;background:#fdf1dc;color:var(--warn);display:grid;place-items:center;margin:0 auto 10px">${icon('card', 26)}</div>
    <b>Aguardando confirmação do pagamento</b>
    <p class="muted" style="font-size:13.5px;margin:6px auto 14px;max-width:430px">Assim que o Mercado Pago confirmar, seu pedido é liberado automaticamente. Pode levar alguns instantes.</p>
    <button class="btn btn-primary" id="refreshOrder">${icon('check', 16)} Já paguei — atualizar</button>
  </div></div>`;
}
function pixPanel(o) {
  return `<div class="panel"><div class="pix-box">
    <div class="pix-qr">${qrArt(o.code)}</div>
    <b>${money(o.total)}</b>
    <p class="muted" style="font-size:13px;margin:6px 0 0">Escaneie o QR (simulado) ou use o código copia-e-cola.</p>
    <div class="pix-code"><input value="${escapeHtml(o.pix_code)}" readonly><button class="btn btn-ghost" id="copyPix">Copiar</button></div>
    <button class="btn btn-primary btn-lg" id="confirmPix" style="margin-top:16px">${icon('check', 17)} Já paguei (simular confirmação)</button>
    <p class="muted" style="font-size:11.5px;margin-top:8px">Estrutura pronta para integração real (Pix via PSP/banco).</p>
  </div></div>`;
}
function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : '—'; }
function formatDoc(d) {
  d = String(d || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return d;
}
function onchainPanel(o) {
  const c = Store.chain;
  return `<div class="panel"><div class="pix-box">
    <h3 style="justify-content:center;display:flex;align-items:center;gap:8px">${iconFill('coin', 18)} Pague com NTR · ${escapeHtml(c.name)}</h3>
    <p class="muted" style="font-size:13.5px;margin:4px auto 14px;max-width:430px">Conecte sua carteira (MetaMask) e envie <b>${mbv(o.mbv_amount)}</b> para a carteira da loja. Tenha NTR e um pouco de ${escapeHtml(c.nativeSymbol)} (taxa de rede) na carteira.</p>
    <div class="mbv-pay" style="text-align:left;max-width:440px;margin:0 auto">
      <div style="display:flex;justify-content:space-between"><span>Valor</span><b>${mbv(o.mbv_amount)}</b></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12.5px;color:#cfe9d6"><span>Carteira da loja</span><a href="${c.explorer}/address/${c.store}" target="_blank" rel="noopener" style="font-family:monospace;color:var(--lime)">${shortAddr(c.store)}</a></div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:12.5px;color:#cfe9d6"><span>Token NTR</span><a href="${c.explorer}/token/${c.token.address}" target="_blank" rel="noopener" style="font-family:monospace;color:var(--lime)">${shortAddr(c.token.address)}</a></div>
    </div>
    <button class="btn btn-primary btn-lg" id="payOnchain" style="margin-top:16px">${iconFill('coin', 17)} Conectar carteira e pagar</button>
    <div style="margin-top:14px;font-size:12.5px;color:var(--muted)">Já pagou por fora? Cole o hash da transação:
      <div class="pix-code" style="max-width:440px;margin:8px auto 0"><input id="manualTx" placeholder="0x..." style="font-family:monospace"><button class="btn btn-ghost" id="verifyManual">Verificar</button></div>
    </div>
  </div></div>`;
}
async function payOrderOnchain(o) {
  const btn = app.querySelector('#payOnchain');
  const original = btn ? btn.innerHTML : '';
  try {
    if (btn) { btn.disabled = true; btn.textContent = 'Abrindo a carteira…'; }
    const tx = await Web3Pay.payNtr(Store.chain, String(o.mbv_amount));
    toast('Transação enviada', 'Aguardando confirmação na rede…', 'info');
    if (btn) btn.textContent = 'Confirmando na blockchain…';
    await tx.wait(Store.chain.minConfirmations || 1);
    await API.post('/orders/' + o.id + '/verify-onchain', { txHash: tx.hash });
    await Store.refreshUser(); renderHeader();
    toast('Pagamento confirmado!', 'NTR recebido on-chain ✓', 'ok');
    Pages.orderDetail(o.id);
  } catch (e) {
    toast('Pagamento', e.shortMessage || e.message || 'Não foi possível concluir o pagamento.', 'err');
    if (btn) { btn.disabled = false; btn.innerHTML = original; }
  }
}
async function verifyOnchainManual(o) {
  const el = app.querySelector('#manualTx');
  const hash = el ? el.value.trim() : '';
  if (!hash) return toast('Verificação', 'Cole o hash da transação (0x...).', 'err');
  try { await API.post('/orders/' + o.id + '/verify-onchain', { txHash: hash }); toast('Pagamento confirmado!', '', 'ok'); Pages.orderDetail(o.id); }
  catch (e) { toast('Verificação', e.message, 'err'); }
}
function qrArt(seed) {
  // Padrão decorativo determinístico (não escaneável) — placeholder visual do QR.
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const n = 13, cell = 13; let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const corner = (x < 4 && y < 4) || (x >= n - 4 && y < 4) || (x < 4 && y >= n - 4);
    if (corner || (h & 1)) rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#0b3d24"/>`;
  }
  return `<svg viewBox="0 0 ${n * cell} ${n * cell}" width="100%" height="100%">${rects}</svg>`;
}

/* ---------- ORDERS ---------- */
Pages.orders = async function () {
  if (!Store.isAuthed()) return go('/entrar?next=' + encodeURIComponent('/pedidos'));
  loading();
  const { orders } = await API.get('/orders');
  mount(`<div class="container">
    <h1 style="margin:24px 0 18px;font-size:27px">Meus pedidos</h1>
    ${!orders.length ? `<div class="empty"><div class="ic">${icon('box', 30)}</div><h3>Você ainda não fez pedidos</h3><a href="/produtos" class="btn btn-primary" style="margin-top:14px">Explorar produtos</a></div>`
      : orders.map(o => `<a href="/pedido/${o.id}" class="panel" style="display:flex;align-items:center;gap:16px;text-decoration:none">
          <div style="display:flex;margin-right:4px">${o.items.slice(0, 3).map(it => `<img src="${productImage(it)}" onerror="${UI.imgFallback(it)}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;border:2px solid #fff;margin-left:-10px">`).join('')}</div>
          <div style="flex:1"><b style="font-family:var(--display)">${escapeHtml(o.code)}</b><div class="muted" style="font-size:13px">${new Date(o.created_at + 'Z').toLocaleDateString('pt-BR')} · ${o.items.length} item(ns)</div></div>
          <div style="text-align:right"><b>${money(o.total)}</b><div style="margin-top:6px">${statusPill(o.status)}</div></div>
        </a>`).join('')}
  </div>`);
};

/* ---------- ACCOUNT ---------- */
Pages.account = async function () {
  if (!Store.isAuthed()) return go('/entrar');
  await Store.refreshUser(); renderHeader();
  const u = Store.user;
  const { orders } = await API.get('/orders');
  mount(`<div class="container" style="max-width:920px">
    <h1 style="margin:24px 0 18px;font-size:27px">Minha conta</h1>
    ${!u.email_verified ? `<div class="panel" style="border-color:#f0d9a6;background:#fdf7e8;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span style="font-size:14px">✉️ Confirme seu e-mail para ativar todos os recursos da conta.</span><button class="btn btn-light btn-sm" id="resendVerify">Reenviar e-mail</button></div>` : ''}
    <div class="checkout" style="grid-template-columns:1fr 320px">
      <div>
        <div class="panel">
          <h3>${icon('user', 18)} Dados</h3>
          <div class="grid-2"><div><span class="muted" style="font-size:13px">Nome</span><br><b>${escapeHtml(u.name)}</b></div><div><span class="muted" style="font-size:13px">E-mail</span><br><b>${escapeHtml(u.email)}</b></div></div>
          <div style="margin-top:14px"><span class="muted" style="font-size:13px">Tipo de conta</span><br><span class="chip">${u.role === 'admin' ? 'Administrador' : 'Cliente'}</span></div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3 style="margin:0">${icon('box', 18)} Últimos pedidos</h3><a href="/pedidos" class="btn btn-ghost btn-sm">Ver todos</a></div>
          ${orders.slice(0, 4).map(o => `<a href="/pedido/${o.id}" style="display:flex;justify-content:space-between;padding:11px 0;border-bottom:1px solid var(--line)"><span><b>${escapeHtml(o.code)}</b> <span class="muted">· ${new Date(o.created_at + 'Z').toLocaleDateString('pt-BR')}</span></span><span>${money(o.total)} ${statusPill(o.status)}</span></a>`).join('') || '<p class="muted">Nenhum pedido ainda.</p>'}
        </div>
      </div>
      <div>
        <div class="wallet-hero" style="padding:22px">
          <span style="font-size:13px;color:#cfe9d6">Carteira Neutrotan (NTR)</span>
          <div class="bal" style="font-size:34px">${mbv(Store.balance)}</div>
          <a href="/carteira" class="btn" style="background:var(--lime);color:#15391f;margin-top:14px">Abrir carteira</a>
        </div>
        ${Store.isAdmin() ? `<a href="/admin" class="btn btn-dark btn-block" style="margin-top:14px">${icon('grid', 17)} Painel administrativo</a>` : ''}
        <button class="btn btn-ghost btn-block" id="acctLogout" style="margin-top:10px;color:var(--danger)">${icon('logout', 17)} Sair</button>
      </div>
    </div>
  </div>`);
  app.querySelector('#acctLogout').addEventListener('click', () => { Store.logout(); renderHeader(); go('/'); });
  const rv = app.querySelector('#resendVerify');
  if (rv) rv.addEventListener('click', async () => { try { await API.post('/auth/resend-verification'); toast('E-mail enviado!', 'Verifique sua caixa de entrada.', 'ok'); } catch (e) { toast('Ops', e.message, 'err'); } });
};

/* ---------- WALLET ---------- */
Pages.wallet = async function () {
  if (!Store.isAuthed()) return go('/entrar?next=' + encodeURIComponent('/carteira'));
  loading();
  const w = await API.get('/wallet');
  mount(`<div class="container" style="max-width:920px">
    <h1 style="margin:24px 0 18px;font-size:27px">Carteira Neutrotan (NTR)</h1>
    <div class="checkout" style="grid-template-columns:1fr 330px">
      <div>
        <div class="wallet-hero">
          <span style="font-size:14px;color:#cfe9d6">Saldo disponível</span>
          <div class="bal">${mbv(w.balance)}</div>
          <div style="color:#cfe9d6;margin-top:6px">≈ ${money(w.balance_brl)} · 1 NTR = ${money(w.token.brlPerToken)}</div>
          <div class="wallet-addr">${escapeHtml(w.address)}</div>
        </div>
        <div class="panel" style="margin-top:18px">
          <h3>${icon('chart', 18)} Extrato</h3>
          ${w.transactions.length ? w.transactions.map(txRow).join('') : '<p class="muted">Nenhuma transação ainda.</p>'}
        </div>
      </div>
      <div>
        <div class="panel">
          <h3>${icon('plus', 18)} Recarregar</h3>
          <p class="muted" style="font-size:13px;margin-top:0">Compre Neutrotan (NTR) para pagar pedidos com desconto.</p>
          <div class="field"><label>Valor (R$)</label><input id="topupAmt" type="number" placeholder="100" value="100"></div>
          <div style="display:flex;gap:6px;margin-bottom:12px">${[50, 100, 250, 500].map(v => `<button class="btn btn-light btn-sm" data-amt="${v}">R$ ${v}</button>`).join('')}</div>
          <button class="btn btn-primary btn-block" id="topupBtn">Recarregar carteira</button>
          <p class="muted" style="font-size:11.5px;margin-top:10px">On-ramp simulado. Em produção, o crédito ocorre após confirmação real (Cartão/Pix).</p>
        </div>
        <div class="panel">
          <h3>${iconFill('coin', 18)} Sobre o token</h3>
          <div class="sum-row"><span>Nome</span><b>${escapeHtml(w.token.name)}</b></div>
          <div class="sum-row"><span>Símbolo</span><b>${escapeHtml(w.token.symbol)}</b></div>
          <div class="sum-row"><span>Rede</span><b>${escapeHtml(w.token.network)}</b></div>
          <div class="sum-row"><span>Lastro</span><b style="text-align:right;max-width:160px">${escapeHtml(w.token.backing || '—')}</b></div>
          <div class="sum-row"><span>Cashback</span><b>${(w.token.cashbackPct * 100)}% por compra</b></div>
        </div>
      </div>
    </div>
  </div>`);
  app.querySelectorAll('[data-amt]').forEach(b => b.addEventListener('click', () => app.querySelector('#topupAmt').value = b.dataset.amt));
  app.querySelector('#topupBtn').addEventListener('click', async () => {
    try {
      await API.post('/wallet/topup', { amount_brl: Number(app.querySelector('#topupAmt').value) });
      await Store.refreshUser(); renderHeader(); toast('Recarga concluída!', '', 'ok'); Pages.wallet();
    } catch (e) { toast('Ops', e.message, 'err'); }
  });
};
function txRow(t) {
  const isIn = t.amount >= 0;
  const labels = { welcome: 'Bônus de boas-vindas', topup: 'Recarga', purchase: 'Pagamento de pedido', cashback: 'Cashback', refund: 'Estorno' };
  return `<div class="tx"><div class="ic ${isIn ? 'in' : 'out'}">${icon(isIn ? 'plus' : 'cart', 17)}</div>
    <div><b>${labels[t.type] || t.type}</b><div class="muted" style="font-size:12.5px">${escapeHtml(t.description || '')} · ${new Date(t.created_at + 'Z').toLocaleDateString('pt-BR')}</div></div>
    <div class="amt ${isIn ? 'in' : 'out'}">${isIn ? '+' : ''}${mbv(t.amount)}</div></div>`;
}

/* ---------- FAVORITES ---------- */
Pages.favorites = async function () {
  loading();
  let items;
  if (Store.isAuthed()) { items = (await API.get('/cart/favorites/list')).items; }
  else {
    const favs = Store.guestFavs();
    items = favs.length ? (await API.get('/products/by-ids?ids=' + favs.join(','))).items : [];
  }
  mount(`<div class="container">
    <h1 style="margin:24px 0 18px;font-size:27px">Favoritos</h1>
    ${items.length ? `<div class="product-grid">${items.map(productCard).join('')}</div>` : `<div class="empty"><div class="ic">${iconFill('heart', 28)}</div><h3>Nenhum favorito ainda</h3><p class="muted">Toque no coração dos produtos que você gosta.</p><a href="/produtos" class="btn btn-primary" style="margin-top:14px">Explorar</a></div>`}
  </div>`);
};

/* ---------- AUTH ---------- */
/* ---------- Campo de senha com mostrar/ocultar (compartilhado: entrar, cadastro, redefinir) ---------- */
function passField(id, label, placeholder, autocomplete) {
  return `<div class="field"><label for="${id}">${label}</label><div class="pass-wrap">
    <input id="${id}" type="password" placeholder="${placeholder}" autocomplete="${autocomplete}">
    <button type="button" class="pass-eye" data-eye="${id}" aria-label="Mostrar senha" aria-pressed="false">${icon('eye', 17)}</button>
  </div></div>`;
}
function wireEyes(box) {
  box.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => {
    const inp = box.querySelector('#' + b.dataset.eye);
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show));
    b.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
    b.innerHTML = icon(show ? 'eyeOff' : 'eye', 17);
    inp.focus();
  }));
}

Pages.auth = function (query) {
  const tab = query.tab === 'register' ? 'register' : 'login';
  const next = query.next || '/';
  mount(`<div class="container"><div class="auth-wrap">
    <a href="/" class="logo" style="justify-content:center;margin-bottom:6px"><img class="mark" src="https://movimentobrasilverde.com/wp-content/uploads/2026/04/cropped-Icone-MBV-270x270.png" alt="MBV — Movimento Brasil Verde" width="40" height="40" onerror="this.onerror=null;this.src='/img/logo.svg'"><span>MBV</span></a>
    <div class="auth-tabs"><button data-tab="login" class="${tab === 'login' ? 'active' : ''}">Entrar</button><button data-tab="register" class="${tab === 'register' ? 'active' : ''}">Criar conta</button></div>
    <div id="authForm"></div>
  </div></div>`);

  // Submit com estado de carregamento (evita clique duplo) e restauração em erro.
  async function submitWith(btn, busyLabel, fn) {
    const original = btn.innerHTML;
    btn.disabled = true; btn.textContent = busyLabel;
    try { await fn(); } catch (e) { btn.disabled = false; btn.innerHTML = original; throw e; }
  }
  function renderForm(which) {
    const box = app.querySelector('#authForm');
    if (which === 'login') {
      box.innerHTML = `<h1>Bem-vindo de volta</h1><p class="muted" style="margin:0 0 18px">Acesse sua conta MBV.</p>
        <form id="loginForm" novalidate>
        <div class="field"><label for="l_email">E-mail</label><input id="l_email" type="email" placeholder="voce@email.com" autocomplete="email" inputmode="email"></div>
        ${passField('l_pass', 'Senha', '••••••', 'current-password')}
        <button type="submit" class="btn btn-primary btn-block btn-lg" id="loginBtn">Entrar</button>
        </form>
        <p style="text-align:center;margin-top:12px"><a href="/recuperar" style="color:var(--green-700);font-weight:600;font-size:13.5px">Esqueci minha senha</a></p>
        <div class="demo-box"><b>Contas de demonstração:</b><br>Admin: <b>admin@mbv.com</b> / admin123<br>Cliente: <b>cliente@mbv.com</b> / cliente123</div>`;
      wireEyes(box);
      box.querySelector('#loginForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const email = app.querySelector('#l_email'), pass = app.querySelector('#l_pass');
        fieldError(email, email.value.trim() ? '' : 'Informe seu e-mail.');
        fieldError(pass, pass.value ? '' : 'Informe sua senha.');
        if (!email.value.trim() || !pass.value) return;
        try {
          await submitWith(box.querySelector('#loginBtn'), 'Entrando…', async () => {
            const r = await API.post('/auth/login', { email: email.value.trim(), password: pass.value });
            Store.setSession(r.token, r.user); await Store.refreshFavorites(); await Store.mergeGuestToServer(); await Store.refreshCart(); await Store.refreshFavorites(); renderHeader();
            toast('Olá, ' + r.user.name.split(' ')[0] + '!', '', 'ok'); go(decodeURIComponent(next).replace(/^#/, '') || '/');
          });
        } catch (e) { toast('Falha no login', e.message, 'err'); }
      });
    } else {
      box.innerHTML = `<h1>Criar conta</h1><p class="muted" style="margin:0 0 18px">Ganhe <b>150 NTR</b> de boas-vindas.</p>
        <form id="regForm" novalidate>
        <div class="field"><label for="r_name">Nome completo</label><input id="r_name" autocomplete="name"></div>
        <div class="field"><label for="r_email">E-mail</label><input id="r_email" type="email" autocomplete="email" inputmode="email"></div>
        ${passField('r_pass', 'Senha', 'Mínimo 6 caracteres', 'new-password')}
        <button type="submit" class="btn btn-primary btn-block btn-lg" id="regBtn">Criar conta</button>
        </form>`;
      wireEyes(box);
      box.querySelector('#regForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const name = app.querySelector('#r_name'), email = app.querySelector('#r_email'), pass = app.querySelector('#r_pass');
        fieldError(name, name.value.trim() ? '' : 'Informe seu nome.');
        fieldError(email, /.+@.+\..+/.test(email.value.trim()) ? '' : 'Informe um e-mail válido.');
        fieldError(pass, pass.value.length >= 6 ? '' : 'A senha precisa de pelo menos 6 caracteres.');
        if (!name.value.trim() || !/.+@.+\..+/.test(email.value.trim()) || pass.value.length < 6) return;
        try {
          await submitWith(box.querySelector('#regBtn'), 'Criando conta…', async () => {
            const r = await API.post('/auth/register', { name: name.value.trim(), email: email.value.trim(), password: pass.value });
            Store.setSession(r.token, r.user); await Store.mergeGuestToServer(); await Store.refreshCart(); await Store.refreshFavorites(); renderHeader();
            toast('Conta criada!', 'Você ganhou 150 NTR 🌱', 'ok'); go(decodeURIComponent(next).replace(/^#/, '') || '/');
          });
        } catch (e) { toast('Não foi possível cadastrar', e.message, 'err'); }
      });
    }
  }
  renderForm(tab);
  app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
    app.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
    renderForm(b.dataset.tab);
  }));
};

Pages.forgot = function () {
  mount(`<div class="container"><div class="auth-wrap">
    <h1>Recuperar senha</h1><p class="muted" style="margin:0 0 18px">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>
    <form id="fgForm" novalidate>
    <div class="field"><label for="fg_email">E-mail</label><input id="fg_email" type="email" placeholder="voce@email.com" autocomplete="email" inputmode="email"></div>
    <button type="submit" class="btn btn-primary btn-block btn-lg" id="fgBtn">Enviar link</button>
    </form>
    <p style="text-align:center;margin-top:14px"><a href="/entrar" style="color:var(--green-700);font-weight:600">Voltar ao login</a></p>
  </div></div>`);
  app.querySelector('#fgForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await API.post('/auth/forgot', { email: app.querySelector('#fg_email').value.trim() }); toast('Verifique seu e-mail', 'Se houver uma conta, enviamos o link de redefinição.', 'ok'); }
    catch (e) { toast('Ops', e.message, 'err'); }
  });
};
Pages.reset = function (query) {
  const token = query.token || '';
  mount(`<div class="container"><div class="auth-wrap">
    <h1>Redefinir senha</h1><p class="muted" style="margin:0 0 18px">Crie uma nova senha para sua conta.</p>
    <form id="rsForm" novalidate>
    ${passField('rs_pass', 'Nova senha', 'Mínimo 6 caracteres', 'new-password')}
    <button type="submit" class="btn btn-primary btn-block btn-lg" id="rsBtn">Salvar nova senha</button>
    </form>
  </div></div>`);
  wireEyes(app.querySelector('#rsForm'));
  app.querySelector('#rsForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try { await API.post('/auth/reset', { token, password: app.querySelector('#rs_pass').value }); toast('Senha alterada!', 'Já pode entrar com a nova senha.', 'ok'); go('/entrar'); }
    catch (e) { toast('Ops', e.message, 'err'); }
  });
};
Pages.verify = function (query) {
  loading();
  API.post('/auth/verify', { token: query.token || '' }).then(async () => {
    await Store.refreshUser(); renderHeader();
    mount(`<div class="container"><div class="empty" style="margin:60px 0"><div class="ic" style="color:var(--green-700)">${icon('check', 34)}</div><h2>E-mail confirmado! 🌱</h2><p class="muted">Sua conta está ativada.</p><a href="/" class="btn btn-primary" style="margin-top:14px">Ir à loja</a></div></div>`);
  }).catch(e => {
    mount(`<div class="container"><div class="empty" style="margin:60px 0"><div class="ic">${icon('search', 30)}</div><h2>Não foi possível confirmar</h2><p class="muted">${escapeHtml(e.message)}</p><a href="/conta" class="btn btn-primary" style="margin-top:14px">Minha conta</a></div></div>`);
  });
};

/* ======================= ADMIN ======================= */
Pages.admin = function (parts, query) {
  if (!Store.isAuthed()) return go('/entrar?next=' + encodeURIComponent('/admin'));
  if (!Store.isAdmin()) return mount(`<div class="container"><div class="empty" style="margin:60px 0"><div class="ic">${icon('shield', 30)}</div><h2>Acesso restrito</h2><p class="muted">Esta área é exclusiva para administradores.</p><a href="/" class="btn btn-primary" style="margin-top:14px">Voltar à loja</a></div></div>`);
  const sub = parts[0] || 'dashboard';
  if (sub === 'produtos' && parts[1] === 'novo') return Admin.productForm(null);
  if (sub === 'produtos' && parts[1]) return Admin.productForm(parts[1]);
  if (sub === 'produtos') return Admin.products();
  if (sub === 'pedidos') return Admin.orders();
  if (sub === 'cupons') return Admin.coupons();
  if (sub === 'usuarios') return Admin.users();
  return Admin.dashboard();
};

function adminShell(active, content) {
  const nav = [['dashboard', 'Painel', 'chart', '/admin'], ['produtos', 'Produtos', 'box', '/admin/produtos'],
    ['pedidos', 'Pedidos', 'truck', '/admin/pedidos'], ['cupons', 'Cupons', 'tag', '/admin/cupons'], ['usuarios', 'Clientes', 'users', '/admin/usuarios']];
  return `<div class="container"><div class="admin-wrap">
    <aside class="admin-nav">
      <div style="padding:8px 12px 12px;font-weight:800;font-family:var(--display);display:flex;align-items:center;gap:8px">${icon('grid', 18)} Admin MBV</div>
      ${nav.map(([k, l, ic, href]) => `<a href="${href}" class="${active === k ? 'active' : ''}">${icon(ic, 17)} ${l}</a>`).join('')}
      <div class="sep" style="height:1px;background:var(--line);margin:8px 6px"></div>
      <a href="/">${icon('logout', 17)} Ver loja</a>
    </aside>
    <div>${content}</div>
  </div></div>`;
}

const Admin = {};

Admin.dashboard = async function () {
  loading();
  const s = await API.get('/admin/stats');
  const maxDay = Math.max(1, ...s.salesByDay.map(d => d.total));
  const c = Store.chain || {};
  mount(adminShell('dashboard', `
    <div class="panel-head"><h1>Visão geral</h1><span class="muted">Atualizado agora</span></div>
    <div class="stat-grid">
      <div class="stat"><div class="ic">${iconFill('coin', 20)}</div><b>${money(s.revenue)}</b><span>Receita confirmada</span></div>
      <div class="stat"><div class="ic">${icon('box', 20)}</div><b>${s.ordersCount}</b><span>Pedidos</span></div>
      <div class="stat"><div class="ic">${icon('users', 20)}</div><b>${s.customers}</b><span>Clientes</span></div>
      <div class="stat"><div class="ic">${icon('leaf', 20)}</div><b>${s.co2} kg</b><span>CO₂ evitado</span></div>
    </div>
    <div class="checkout" style="grid-template-columns:1fr 340px;align-items:start">
      <div>
        <div class="panel"><h3>${icon('chart', 18)} Vendas (7 dias)</h3>
          <div style="display:flex;align-items:end;gap:10px;height:160px;padding-top:10px">
            ${s.salesByDay.length ? s.salesByDay.map(d => `<div style="flex:1;text-align:center"><div title="${money(d.total)}" style="height:${Math.round(d.total / maxDay * 130)}px;min-height:4px;background:linear-gradient(180deg,var(--green-500),var(--green-700));border-radius:7px 7px 3px 3px"></div><span style="font-size:10.5px;color:var(--muted)">${d.day.slice(8, 10)}/${d.day.slice(5, 7)}</span></div>`).join('') : '<p class="muted">Sem vendas no período.</p>'}
          </div>
        </div>
        <div class="panel"><div class="panel-head"><h3 style="margin:0">Pedidos recentes</h3><a href="/admin/pedidos" class="btn btn-ghost btn-sm">Ver todos</a></div>
          <div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Pgto</th><th>Status</th></tr></thead><tbody>
            ${s.recentOrders.map(o => `<tr><td><a href="/pedido/${o.id}"><b>${escapeHtml(o.code)}</b></a></td><td>${escapeHtml(o.customer_name)}</td><td>${money(o.total)}</td><td>${payIcon(o.payment_method)} ${statusPill(o.payment_status)}</td><td>${statusPill(o.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhum pedido.</td></tr>'}
          </tbody></table></div>
        </div>
      </div>
      <div>
        <div class="panel"><h3>${icon('chart', 18)} Mais vendidos</h3>
          ${s.topProducts.length ? s.topProducts.map(p => `<div class="mini-prod" style="margin-bottom:12px"><img src="${productImage(p)}" onerror="${UI.imgFallback(p)}"><div style="flex:1"><div style="font-size:13.5px;font-weight:600">${escapeHtml(p.name)}</div><div class="muted" style="font-size:12px">${p.qty} ${escapeHtml(p.unit)} · ${money(p.revenue)}</div></div></div>`).join('') : '<p class="muted">Sem dados.</p>'}
        </div>
        <div class="panel"><h3 style="color:${s.lowStock.length ? 'var(--warn)' : 'inherit'}">${icon('box', 18)} Estoque baixo</h3>
          ${s.lowStock.length ? s.lowStock.map(p => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span style="font-size:13.5px">${escapeHtml(p.name)}</span><b style="color:var(--danger)">${p.stock} ${escapeHtml(p.unit)}</b></div>`).join('') : '<p class="muted">Tudo abastecido ✓</p>'}
        </div>
        <div class="panel"><h3>${icon('shield', 18)} Prontidão para go-live</h3>
          ${goliveRow('Modo', !c.demo, c.demo ? 'Demonstração' : 'Produção')}
          ${goliveRow('Mercado Pago (cartão/Pix)', c.mpEnabled)}
          ${goliveRow('E-mail (Resend)', c.emailEnabled)}
          ${goliveRow('Google Analytics', !!c.gaId)}
          ${goliveRow('Pagamento NTR on-chain', c.enabled)}
          ${goliveRow('Dados persistentes', c.persistent)}
          ${goliveRow('Carrinho abandonado (cron)', c.jobsReady)}
          <p class="muted" style="font-size:11.5px;margin-top:8px">Configure no Render → Environment. Passo a passo no GO-LIVE.md.</p>
        </div>
      </div>
    </div>`));
};
function goliveRow(label, ok, note) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--line)"><span style="font-size:13px">${escapeHtml(label)}</span><b style="font-size:12px;color:${ok ? 'var(--green-700)' : 'var(--muted)'}">${ok ? '✓ ' + (note || 'Conectado') : '• ' + (note || 'Pendente')}</b></div>`;
}
function payIcon(m) { return m === 'pix' ? icon('pix', 14) : m === 'mbv' ? iconFill('coin', 14) : icon('card', 14); }

Admin.products = async function () {
  loading();
  const { items } = await API.get('/products?limit=60&sort=newest');
  mount(adminShell('produtos', `
    <div class="panel-head"><h1>Produtos</h1><a href="/admin/produtos/novo" class="btn btn-primary">${icon('plus', 17)} Novo produto</a></div>
    <div class="table-wrap"><table><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th></th></tr></thead><tbody>
      ${items.map(p => `<tr>
        <td><div class="mini-prod"><img src="${productImage(p)}" onerror="${UI.imgFallback(p)}"><div><b style="font-size:13.5px">${escapeHtml(p.name)}</b>${p.featured ? ' <span class="chip" style="padding:2px 7px;font-size:10px">Destaque</span>' : ''}<div class="muted" style="font-size:12px">${escapeHtml(p.pack_size || '')}</div></div></div></td>
        <td>${escapeHtml(p.category_name || '—')}</td><td><b>${money(p.price)}</b></td>
        <td>${p.stock <= 5 ? `<span style="color:var(--danger);font-weight:700">${p.stock}</span>` : p.stock} ${escapeHtml(p.unit)}</td>
        <td>${p.active ? '<span class="pill pill-paid">Ativo</span>' : '<span class="pill pill-cancelled">Inativo</span>'}</td>
        <td style="white-space:nowrap"><a href="/admin/produtos/${p.id}" class="btn btn-ghost btn-sm">${icon('edit', 14)}</a> <button class="btn btn-ghost btn-sm" data-del="${p.id}" style="color:var(--danger)">${icon('trash', 14)}</button></td>
      </tr>`).join('')}
    </tbody></table></div>`));
  app.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Desativar este produto?')) return;
    try { await API.del('/products/' + b.dataset.del); toast('Produto desativado', '', 'ok'); Admin.products(); } catch (e) { toast('Ops', e.message, 'err'); }
  }));
};

Admin.productForm = async function (id) {
  loading();
  let p = { name: '', description: '', price: '', compare_at_price: '', category_id: Store.categories[0] && Store.categories[0].id, stock: 0, unit: 'un', pack_size: '', image: '', gallery: [], badges: [], specs: [], mapa_reg: '', co2: 0, featured: false };
  if (id) { const r = await API.get('/products/' + id); p = r.product; }
  mount(adminShell('produtos', `
    <div class="breadcrumb"><a href="/admin/produtos">Produtos</a> ${icon('arrow', 13)} <span>${id ? 'Editar' : 'Novo produto'}</span></div>
    <div class="panel" style="max-width:760px">
      <h1 style="font-size:22px;margin-bottom:18px">${id ? 'Editar produto' : 'Novo produto'}</h1>
      <div class="checkout" style="grid-template-columns:1fr 200px;gap:20px">
        <div>
          <div class="field"><label>Nome do produto *</label><input id="p_name" value="${escapeHtml(p.name)}"></div>
          <div class="field"><label>Descrição</label><textarea id="p_desc">${escapeHtml(p.description || '')}</textarea></div>
          <div class="grid-2">
            <div class="field"><label>Categoria</label><select id="p_cat" class="select" style="width:100%">${Store.categories.map(c => `<option value="${c.id}" ${p.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Unidade</label><select id="p_unit" class="select" style="width:100%">${['un', 'L', 'kg'].map(u => `<option ${p.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
          </div>
          <div class="grid-3">
            <div class="field"><label>Preço (R$) *</label><input id="p_price" type="number" step="0.01" value="${p.price}"></div>
            <div class="field"><label>Preço "de" (R$)</label><input id="p_compare" type="number" step="0.01" value="${p.compare_at_price || ''}"></div>
            <div class="field"><label>Estoque</label><input id="p_stock" type="number" value="${p.stock}"></div>
          </div>
          <div class="grid-2">
            <div class="field"><label>Embalagem</label><input id="p_pack" placeholder="ex: Bombona 16 litros" value="${escapeHtml(p.pack_size || '')}"></div>
            <div class="field"><label>CO₂ evitado (kg/un)</label><input id="p_co2" type="number" step="0.1" value="${p.co2 || 0}"></div>
          </div>
          <div class="field"><label>Selos eco (separados por vírgula)</label><input id="p_badges" placeholder="Orgânico, Biodegradável" value="${escapeHtml((p.badges || []).join(', '))}"></div>
          <div class="field"><label>Registro MAPA (se houver)</label><input id="p_mapa" placeholder="ex: RS-003872-5.000067" value="${escapeHtml(p.mapa_reg || '')}"></div>
          <div class="field"><label>Ficha técnica <span class="muted" style="font-weight:400">(1 item por linha, no formato Rótulo: Valor)</span></label><textarea id="p_specs" rows="5" placeholder="Dose recomendada: 5 a 6 L/ha&#10;Classe: A — via foliar">${escapeHtml((p.specs || []).map(s => `${s.k}: ${s.v}`).join('\n'))}</textarea></div>
          <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px"><input type="checkbox" id="p_featured" ${p.featured ? 'checked' : ''}> Destacar na home</label>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600">Imagem do produto</label>
          <div id="imgPreview" style="aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--green-50);margin:8px 0"><img src="${productImage(p)}" style="width:100%;height:100%;object-fit:cover"></div>
          <input type="file" id="p_file" accept="image/*" style="font-size:12px;width:100%">
          <div class="field" style="margin-top:10px"><label>ou URL</label><input id="p_image" value="${escapeHtml(p.image || '')}" placeholder="https://..."></div>
          <p class="muted" style="font-size:11.5px;margin:6px 0 0">Envie uma foto real (JPG/PNG, fundo claro). Sem foto, geramos uma arte da embalagem MBV.</p>
          <label style="font-size:13px;font-weight:600;display:block;margin-top:16px">Galeria (fotos extras)</label>
          <input type="file" id="p_gfiles" accept="image/*" multiple style="font-size:12px;width:100%;margin-top:6px">
          <div class="field" style="margin-top:8px"><label>URLs da galeria (1 por linha)</label><textarea id="p_gallery" rows="3" placeholder="https://...">${escapeHtml((p.gallery || []).join('\n'))}</textarea></div>
          <p class="muted" style="font-size:11.5px;margin:6px 0 0">As fotos extras aparecem como miniaturas na página do produto.</p>
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-primary btn-lg" id="saveProd">${icon('check', 17)} Salvar</button><a href="/admin/produtos" class="btn btn-ghost btn-lg">Cancelar</a></div>
    </div>`));

  const fileInput = app.querySelector('#p_file');
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files[0]) return;
    const fd = new FormData(); fd.append('image', fileInput.files[0]);
    try { const r = await API.upload('/products/upload', fd); app.querySelector('#p_image').value = r.url; app.querySelector('#imgPreview').innerHTML = `<img src="${r.url}" style="width:100%;height:100%;object-fit:cover">`; toast('Imagem enviada', '', 'ok'); }
    catch (e) { toast('Falha no upload', e.message, 'err'); }
  });
  app.querySelector('#p_image').addEventListener('change', e => { if (e.target.value) app.querySelector('#imgPreview').innerHTML = `<img src="${e.target.value}" style="width:100%;height:100%;object-fit:cover">`; });

  // Multi-upload da galeria: envia cada arquivo e adiciona a URL à lista.
  const gfiles = app.querySelector('#p_gfiles');
  gfiles.addEventListener('change', async () => {
    const ta = app.querySelector('#p_gallery');
    let ok = 0;
    for (const f of gfiles.files) {
      const fd = new FormData(); fd.append('image', f);
      try { const r = await API.upload('/products/upload', fd); ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + r.url; ok++; }
      catch (e) { toast('Falha no upload de ' + f.name, e.message, 'err'); }
    }
    if (ok) toast(`${ok} imagem(ns) adicionada(s) à galeria`, '', 'ok');
    gfiles.value = '';
  });

  app.querySelector('#saveProd').addEventListener('click', async () => {
    const body = {
      name: app.querySelector('#p_name').value.trim(), description: app.querySelector('#p_desc').value.trim(),
      category_id: Number(app.querySelector('#p_cat').value), unit: app.querySelector('#p_unit').value,
      price: Number(app.querySelector('#p_price').value), compare_at_price: Number(app.querySelector('#p_compare').value) || null,
      stock: parseInt(app.querySelector('#p_stock').value) || 0, pack_size: app.querySelector('#p_pack').value.trim(),
      co2: Number(app.querySelector('#p_co2').value) || 0, image: app.querySelector('#p_image').value.trim(),
      badges: app.querySelector('#p_badges').value.split(',').map(s => s.trim()).filter(Boolean), featured: app.querySelector('#p_featured').checked,
      gallery: app.querySelector('#p_gallery').value.split('\n').map(s => s.trim()).filter(Boolean),
      mapa_reg: app.querySelector('#p_mapa').value.trim(),
      specs: app.querySelector('#p_specs').value.split('\n').map(l => {
        const i = l.indexOf(':');
        return i > 0 ? { k: l.slice(0, i).trim(), v: l.slice(i + 1).trim() } : null;
      }).filter(s => s && s.k && s.v)
    };
    if (!body.name || !body.price) return toast('Campos obrigatórios', 'Informe nome e preço.', 'err');
    try {
      if (id) await API.put('/products/' + id, body); else await API.post('/products', body);
      toast('Produto salvo!', '', 'ok'); go('/admin/produtos');
    } catch (e) { toast('Ops', e.message, 'err'); }
  });
};

Admin.orders = async function () {
  loading();
  const { orders } = await API.get('/orders?all=1');
  const stLabel = { processing: 'Em processamento', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado' };
  const tableHtml = (list) => `<div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Total</th><th>Pgto</th><th>Status</th></tr></thead><tbody>
      ${list.map(o => `<tr>
        <td><a href="/pedido/${o.id}"><b>${escapeHtml(o.code)}</b></a></td>
        <td>${escapeHtml(o.customer_name || '')}<div class="muted" style="font-size:12px">${escapeHtml(o.customer_email || '')}</div></td>
        <td>${new Date(o.created_at + 'Z').toLocaleDateString('pt-BR')}</td>
        <td><b>${money(o.total)}</b></td>
        <td>${payIcon(o.payment_method)} ${statusPill(o.payment_status)}</td>
        <td><select class="select" data-ostatus="${o.id}" style="padding:7px 10px">
          ${['processing', 'shipped', 'delivered', 'cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${stLabel[s]}</option>`).join('')}
        </select></td>
      </tr>`).join('') || '<tr><td colspan="6" class="muted">Nenhum pedido.</td></tr>'}
    </tbody></table></div>`;
  const wireStatus = () => app.querySelectorAll('[data-ostatus]').forEach(sel => sel.addEventListener('change', async () => {
    try { await API.patch('/orders/' + sel.dataset.ostatus + '/status', { status: sel.value }); toast('Status atualizado', '', 'ok'); }
    catch (e) { toast('Ops', e.message, 'err'); }
  }));
  mount(adminShell('pedidos', `
    <div class="panel-head"><h1>Pedidos</h1><span class="muted">${orders.length} no total</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <select class="select" id="fStatus" style="padding:8px 10px"><option value="">Todos os status</option>${['processing', 'shipped', 'delivered', 'cancelled'].map(s => `<option value="${s}">${stLabel[s]}</option>`).join('')}</select>
      <select class="select" id="fPay" style="padding:8px 10px"><option value="">Todo pagamento</option><option value="card">Cartão</option><option value="pix">Pix</option><option value="mbv">NTR</option></select>
      <span style="flex:1"></span>
      <button class="btn btn-light btn-sm" id="expOrders">${icon('box', 14)} Exportar pedidos (CSV)</button>
      <button class="btn btn-light btn-sm" id="expCust">${icon('users', 14)} Exportar clientes (CSV)</button>
    </div>
    <div id="ordersTable">${tableHtml(orders)}</div>`));
  wireStatus();
  const apply = () => {
    const fs = app.querySelector('#fStatus').value, fp = app.querySelector('#fPay').value;
    app.querySelector('#ordersTable').innerHTML = tableHtml(orders.filter(o => (!fs || o.status === fs) && (!fp || o.payment_method === fp)));
    wireStatus();
  };
  app.querySelector('#fStatus').addEventListener('change', apply);
  app.querySelector('#fPay').addEventListener('change', apply);
  app.querySelector('#expOrders').addEventListener('click', () => downloadCsv('/admin/export/orders.csv', 'pedidos-mbv.csv'));
  app.querySelector('#expCust').addEventListener('click', () => downloadCsv('/admin/export/customers.csv', 'clientes-mbv.csv'));
};

Admin.coupons = async function () {
  loading();
  const [{ coupons }, { report }] = await Promise.all([API.get('/coupons'), API.get('/coupons/report')]);
  const rep = {}; report.forEach(r => { rep[r.code] = r; });
  const totalRev = report.reduce((s, r) => s + (r.revenue || 0), 0);
  const totalComm = report.reduce((s, r) => s + (r.commission || 0), 0);
  mount(adminShell('cupons', `
    <div class="panel-head"><h1>Cupons & Afiliados</h1><span class="muted">Receita via cupom: <b>${money(totalRev)}</b> · Comissões: <b>${money(totalComm)}</b></span></div>
    <div class="checkout" style="grid-template-columns:1fr 330px;align-items:start">
      <div class="table-wrap"><table><thead><tr><th>Código</th><th>Restrição</th><th>Desc.</th><th>Pedidos</th><th>Receita</th><th>Comissão</th><th>Status</th><th></th></tr></thead><tbody>
        ${coupons.map(c => { const r = rep[c.code] || {}; return `<tr>
          <td><b>${escapeHtml(c.code)}</b><div class="muted" style="font-size:12px">${escapeHtml(c.description || '')}</div></td>
          <td style="font-size:12.5px">${c.cpf_cnpj ? '🔒 ' + escapeHtml(formatDoc(c.cpf_cnpj)) : ''}${c.affiliate ? `${c.cpf_cnpj ? '<br>' : ''}👤 ${escapeHtml(c.affiliate)}${c.commission_pct ? ' (' + c.commission_pct + '%)' : ''}` : ''}${!c.cpf_cnpj && !c.affiliate ? '<span class="muted">Público</span>' : ''}</td>
          <td>${c.type === 'percent' ? c.value + '%' : money(c.value)}</td>
          <td>${r.paid_orders || 0}${r.orders ? `<div class="muted" style="font-size:11px">${r.orders} no total</div>` : ''}</td>
          <td><b>${money(r.revenue || 0)}</b></td>
          <td>${c.commission_pct ? '<b style="color:var(--green-700)">' + money(r.commission || 0) + '</b>' : '—'}</td>
          <td>${c.active ? '<span class="pill pill-paid">Ativo</span>' : '<span class="pill pill-cancelled">Inativo</span>'}</td>
          <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-toggle="${c.id}" data-active="${c.active}">${c.active ? 'Desativar' : 'Ativar'}</button> <button class="btn btn-ghost btn-sm" data-cdel="${c.id}" style="color:var(--danger)">${icon('trash', 13)}</button></td>
        </tr>`; }).join('') || '<tr><td colspan="8" class="muted">Nenhum cupom.</td></tr>'}
      </tbody></table></div>
      <div class="panel"><h3>${icon('plus', 18)} Novo cupom</h3>
        <div class="field"><label>Código</label><input id="cc_code" placeholder="COINMAX" style="text-transform:uppercase"></div>
        <div class="grid-2"><div class="field"><label>Tipo</label><select id="cc_type" class="select" style="width:100%"><option value="percent">Percentual (%)</option><option value="fixed">Valor fixo (R$)</option></select></div>
        <div class="field"><label>Valor</label><input id="cc_value" type="number" step="0.01"></div></div>
        <div class="grid-2"><div class="field"><label>Subtotal mín. (R$)</label><input id="cc_min" type="number" value="0"></div>
        <div class="field"><label>Cashback (NTR)</label><input id="cc_cash" type="number" value="0"></div></div>
        <div class="field"><label>Descrição</label><input id="cc_desc"></div>
        <div style="border-top:1px solid var(--line);margin:6px 0 12px;padding-top:12px;font-weight:700;font-size:13px">Restrição & afiliado (opcional)</div>
        <div class="field"><label>Exclusivo p/ CPF/CNPJ</label><input id="cc_cpf" placeholder="só este documento poderá usar"></div>
        <div class="grid-2"><div class="field"><label>Afiliado</label><input id="cc_aff" placeholder="nome do afiliado"></div>
        <div class="field"><label>Comissão (%)</label><input id="cc_comm" type="number" step="0.1" value="0"></div></div>
        <button class="btn btn-primary btn-block" id="cc_save">Criar cupom</button>
      </div>
    </div>`));
  app.querySelector('#cc_save').addEventListener('click', async () => {
    try {
      await API.post('/coupons', { code: app.querySelector('#cc_code').value, type: app.querySelector('#cc_type').value, value: Number(app.querySelector('#cc_value').value), min_subtotal: Number(app.querySelector('#cc_min').value), cashback_mbv: Number(app.querySelector('#cc_cash').value), description: app.querySelector('#cc_desc').value, cpf_cnpj: app.querySelector('#cc_cpf').value, affiliate: app.querySelector('#cc_aff').value, commission_pct: Number(app.querySelector('#cc_comm').value) });
      toast('Cupom criado', '', 'ok'); Admin.coupons();
    } catch (e) { toast('Ops', e.message, 'err'); }
  });
  app.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', async () => {
    try { await API.put('/coupons/' + b.dataset.toggle, { active: b.dataset.active == '1' ? 0 : 1 }); Admin.coupons(); } catch (e) { toast('Ops', e.message, 'err'); }
  }));
  app.querySelectorAll('[data-cdel]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Excluir cupom?')) return;
    try { await API.del('/coupons/' + b.dataset.cdel); Admin.coupons(); } catch (e) { toast('Ops', e.message, 'err'); }
  }));
};

Admin.users = async function () {
  loading();
  const { users } = await API.get('/admin/users');
  mount(adminShell('usuarios', `
    <div class="panel-head"><h1>Clientes</h1><span class="muted">${users.length} cadastro(s)</span></div>
    <div class="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Pedidos</th><th>Gasto</th><th>Saldo MBV</th></tr></thead><tbody>
      ${users.map(u => `<tr><td><b>${escapeHtml(u.name)}</b></td><td>${escapeHtml(u.email)}</td>
        <td>${u.role === 'admin' ? '<span class="chip">Admin</span>' : 'Cliente'}</td>
        <td>${u.orders_count}</td><td>${money(u.spent)}</td><td><b>${mbv(u.mbv_balance)}</b></td></tr>`).join('')}
    </tbody></table></div>`));
};

/* ======================= BOOT ======================= */
// Banner de cookies. force=true reabre para REVER a escolha (LGPD art. 8º §5º —
// revogar deve ser tão fácil quanto consentir; link "Preferências de cookies" no rodapé).
function cookieBanner(force) {
  const prev = localStorage.getItem('mbv_cookie_consent');
  if (prev && !force) return;
  const old = document.querySelector('.cookie-bar'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'cookie-bar';
  el.innerHTML = `<span>🍪 Usamos cookies essenciais (sessão e carrinho) e, com sua permissão, de análise. Veja a <a href="/privacidade">Política de Privacidade</a>.${prev ? `<br><small class="muted">Escolha atual: ${prev === 'all' ? 'todos os cookies' : 'só essenciais'}.</small>` : ''}</span><span style="display:inline-flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="ckess">Só essenciais</button><button class="btn btn-primary btn-sm" id="ckok">Aceitar todos</button></span>`;
  document.body.appendChild(el);
  const close = (consent) => {
    localStorage.setItem('mbv_cookie_consent', consent);
    // Registro do consentimento (accountability): escolha + data + versão da política.
    try { localStorage.setItem('mbv_cookie_consent_meta', JSON.stringify({ choice: consent, at: new Date().toISOString(), policy: '2026-07' })); } catch (_) {}
    el.remove();
    if (consent === 'all' && Store.chain && Store.chain.gaId) { if (!window.gtag) injectGA(Store.chain.gaId); }
    // Revogação: se o GA já estava ativo e o usuário recuou, recarrega sem o script de análise.
    if (consent === 'essential' && prev === 'all' && window.gtag) { toast('Preferência salva', 'Cookies de análise desativados.', 'ok'); setTimeout(() => location.reload(), 800); }
    else if (force) toast('Preferência salva', '', 'ok');
  };
  el.querySelector('#ckok').addEventListener('click', () => close('all'));
  el.querySelector('#ckess').addEventListener('click', () => close('essential'));
}

function injectGA(id) {
  const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date()); gtag('config', id);
}
function setupErrorReporting() {
  let last = 0;
  const report = (payload) => {
    const now = Date.now(); if (now - last < 3000) return; last = now;
    try { fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, url: location.href }) }); } catch (_) {}
  };
  window.addEventListener('error', e => report({ type: 'error', message: e.message, source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', e => report({ type: 'unhandledrejection', message: String((e.reason && e.reason.message) || e.reason) }));
}

(async function boot() {
  setupErrorReporting();
  if (location.hash.startsWith('#/')) history.replaceState({}, '', location.hash.slice(1)); // migra links antigos #/ -> /
  await Store.init();
  // Link de afiliado: ?ref=CUPOM aplica o cupom automaticamente no checkout.
  try {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref) {
      Flow.coupon = ref.toUpperCase().trim();
      localStorage.setItem('mbv_ref', Flow.coupon);
      // Antes era aplicado em silêncio — agora o cliente VÊ que o cupom do parceiro está ativo.
      setTimeout(() => toast('Cupom de parceiro ativado', `O cupom ${Flow.coupon} será aplicado no seu pedido.`, 'info'), 600);
    } else { const saved = localStorage.getItem('mbv_ref'); if (saved && !Flow.coupon) Flow.coupon = saved; }
  } catch (_) {}
  renderHeader();
  renderFooter();
  if (Store.chain && Store.chain.gaId && localStorage.getItem('mbv_cookie_consent') === 'all') injectGA(Store.chain.gaId);
  window.addEventListener('popstate', () => { pendingFocus = true; render(); });
  render();
  cookieBanner();
})();


