// Componentes e utilitários de UI (ícones SVG, formatação, cards, toast, modal).
const UI = (function () {

  // ---------- Ícones (SVG inline, stroke currentColor) ----------
  const I = {
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16Z"/><path d="M4 21c2-6 6-9 11-11"/>',
    cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.6L23 7H6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 21c0-4 3-6 7-6s7 2 7 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4-4"/>',
    heart: '<path d="M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9Z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z"/>',
    sprout: '<path d="M12 22V12"/><path d="M12 12C12 8 9 6 4 6c0 4 3 6 8 6Z"/><path d="M12 12c0-3 2-5 6-5 0 3-2 5-6 5Z"/>',
    seed: '<path d="M16 4c-6 1-11 6-11 13a13 13 0 0 0 13-13c-.6 0-1.3 0-2 0Z"/>',
    drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12h3"/><path d="M3 8V7a3 3 0 0 1 3-3h10"/>',
    box: '<path d="M21 8 12 3 3 8l9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9Z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
    truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-5.5 6-5.5s6 2 6 5.5"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.5M21 20c0-2.6-1.3-4.4-3.5-5.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pix: '<path d="m12 3 4 4-4 4-4-4Z"/><path d="m12 13 4 4-4 4-4-4Z"/><path d="m3 12 4-4 4 4-4 4Z"/><path d="m13 12 4-4 4 4-4 4Z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.8 1.8 0 0 1 0 3.5H10a1.8 1.8 0 0 0 0 3.5h4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16Z"/>',
    leafFill: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 12-4 16-9 16Z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><circle cx="12" cy="12" r="3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="m3 3 18 18"/><path d="M10.6 5.1A11 11 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3 3.9M6.6 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.4 4.7-1.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
  };
  function icon(name, size = 20, stroke = 1.9) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${I[name] || ''}</svg>`;
  }
  function iconFill(name, size = 20) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor">${I[name] || ''}</svg>`;
  }

  // ---------- Formatação ----------
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = (n) => brl.format(Number(n) || 0);
  const mbv = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString('pt-BR') + ' NTR';
  // Converte um preço em R$ para NTR usando a cotação atual (Store.rate, padrão R$ 9,36).
  const ntr = (brlValue) => mbv((Number(brlValue) || 0) / ((window.Store && Store.rate) ? Store.rate : 9.36));
  // Parcelamento no cartão: maior nº de parcelas mantendo um valor mínimo por parcela.
  function installment(price) {
    const p = Number(price) || 0, MAXN = 12, MINP = 10;
    let n = MAXN; while (n > 1 && p / n < MINP) n--;
    return n > 1 ? `${n}x de ${money(p / n)}` : '';
  }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  function stars(rating, count) {
    const r = Math.round(Number(rating) || 0);
    let s = '';
    for (let i = 1; i <= 5; i++) s += i <= r ? '★' : '☆';
    return `<span class="stars">${s}</span>${count != null ? `<span>(${count})</span>` : ''}`;
  }

  // ---------- Imagem gerada por categoria (sempre disponível, on-brand) ----------
  const CAT_STYLE = {
    fertilizantes: ['#1f9a52', '#0c5e33', 'leaf'],
    defensivos: ['#2b8f8a', '#0e5f5b', 'shield'],
    bioestimulantes: ['#7fae22', '#3f6b12', 'sprout'],
    sementes: ['#c0892e', '#7a4e15', 'seed'],
    'solo-agua': ['#2f86c4', '#16527e', 'drop'],
    sustentabilidade: ['#d39a1f', '#9a6a10', 'sun']
  };
  function genImage(p) {
    const [c1, c2, ic] = CAT_STYLE[p.category_slug] || ['#1f9a52', '#0c5e33', 'leaf'];
    const glyph = (I[ic] || I.leaf);
    const pack = escapeHtml(p.pack_size || '');
    // Mockup de embalagem (saco/produto) on-brand: visual consistente quando não há foto real.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f4ec"/><stop offset="1" stop-color="#e7ebe1"/></linearGradient>
        <linearGradient id="pk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg)"/>
      <circle cx="342" cy="40" r="74" fill="#0c5e33" opacity="0.05"/>
      <circle cx="44" cy="276" r="60" fill="#0c5e33" opacity="0.04"/>
      <ellipse cx="200" cy="259" rx="98" ry="15" fill="#0c5e33" opacity="0.12"/>
      <rect x="150" y="46" width="100" height="20" rx="8" fill="${c2}"/>
      <rect x="128" y="58" width="144" height="196" rx="20" fill="url(#pk)"/>
      <rect x="128" y="58" width="44" height="196" rx="20" fill="#ffffff" opacity="0.10"/>
      <g transform="translate(176,92) scale(2.1)" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
      <rect x="128" y="158" width="144" height="60" fill="#ffffff" opacity="0.94"/>
      <text x="200" y="186" text-anchor="middle" fill="${c2}" font-family="Plus Jakarta Sans,Arial" font-size="19" font-weight="800">MBV</text>
      <text x="200" y="206" text-anchor="middle" fill="#5d6f64" font-family="Plus Jakarta Sans,Arial" font-size="11" font-weight="600" letter-spacing="0.4">${pack || 'Movimento Brasil Verde'}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  function productImage(p) {
    if (p && p.image && String(p.image).trim()) return p.image;
    return genImage(p || {});
  }
  // fallback inline para <img onerror>
  function imgFallback(p) {
    return `this.onerror=null;this.src='${genImage(p)}'`;
  }

  // ---------- Product card ----------
  function productCard(p) {
    const off = p.compare_at_price && p.compare_at_price > p.price
      ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
    const fav = Store.favorites.has(p.id);
    const badges = (p.badges || []).slice(0, 2).map(b => `<span class="badge-soft">${UI.icon('leaf', 11)} ${escapeHtml(b)}</span>`).join('');
    return `<article class="card" data-card="${p.id}">
      <div class="thumb">
        <a href="/produto/${p.id}/${p.slug || ''}"><img loading="lazy" src="${productImage(p)}" onerror="${imgFallback(p)}" alt="${escapeHtml(p.name)}"></a>
        ${off ? `<span class="tag-off">-${off}%</span>` : ''}
        <button class="fav ${fav ? 'on' : ''}" data-fav="${p.id}" title="Favoritar" aria-pressed="${fav}" aria-label="Favoritar ${escapeHtml(p.name)}">${iconFill('heart', 17)}</button>
      </div>
      <div class="body">
        <span class="cat">${escapeHtml(p.category_name || '')}</span>
        <a href="/produto/${p.id}/${p.slug || ''}" class="title">${escapeHtml(p.name)}</a>
        <div class="badges">${badges}</div>
        <div class="rating">${stars(p.rating, p.rating_count)}</div>
        ${p.stock > 0 && p.stock <= 8 ? `<div class="lowstock">${icon('spark', 11)} Últimas ${p.stock} unidades</div>` : ''}
        <div class="price-row">
          <div>
            ${off ? `<div class="price-old">${money(p.compare_at_price)}</div>` : ''}
            <div class="price">${money(p.price)} ${p.unit && p.unit !== 'un' ? `<small>/ ${escapeHtml(p.pack_size || p.unit)}</small>` : ''}</div>
            <div class="price-mbv">${UI.iconFill('coin', 12)} ${money(p.price * 0.95)} em NTR · <b>−5%</b></div>
            ${installment(p.price) ? `<div class="installment">ou até ${installment(p.price)} no cartão</div>` : ''}
          </div>
          <button class="add" data-add="${p.id}" title="Adicionar ao carrinho">${icon('plus', 20)}</button>
        </div>
      </div>
    </article>`;
  }

  // ---------- Toast ----------
  function toast(title, msg, type = 'ok') {
    const stack = document.getElementById('toast-stack');
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'err' : type === 'info' ? 'info' : '');
    const ic = type === 'err' ? '⚠️' : type === 'info' ? 'ℹ️' : '✅';
    t.innerHTML = `<div style="font-size:18px;line-height:1">${ic}</div><div><b>${escapeHtml(title)}</b>${msg ? `<p>${escapeHtml(msg)}</p>` : ''}</div>`;
    stack.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; setTimeout(() => t.remove(), 250); }, 3200);
  }

  // ---------- Modal ----------
  function openModal(title, bodyHtml, opts = {}) {
    const root = document.getElementById('modal-root');
    root._prevFocus = document.activeElement; // devolve o foco ao fechar (a11y)
    root.innerHTML = `<div class="modal-overlay" data-overlay>
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" tabindex="-1" style="${opts.maxWidth ? 'max-width:' + opts.maxWidth + 'px' : ''}">
        <div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="x" data-close aria-label="Fechar">✕</button></div>
        <div class="modal-body">${bodyHtml}</div>
      </div></div>`;
    root.querySelector('[data-overlay]').addEventListener('click', e => { if (e.target.dataset.overlay !== undefined) closeModal(); });
    root.querySelector('[data-close]').addEventListener('click', closeModal);
    root._onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', root._onKey);
    const m = root.querySelector('.modal'); if (m) m.focus();
    return root.querySelector('.modal-body');
  }
  function closeModal() {
    const root = document.getElementById('modal-root');
    if (root._onKey) { document.removeEventListener('keydown', root._onKey); root._onKey = null; }
    root.innerHTML = '';
    if (root._prevFocus && typeof root._prevFocus.focus === 'function' && document.contains(root._prevFocus)) root._prevFocus.focus();
    root._prevFocus = null;
  }

  function statusPill(s) {
    const map = { processing: 'Em processamento', shipped: 'Enviado', delivered: 'Entregue', cancelled: 'Cancelado',
      paid: 'Pago', pending: 'Aguardando pagamento', failed: 'Falhou' };
    return `<span class="pill pill-${s}">${map[s] || s}</span>`;
  }

  return { icon, iconFill, money, mbv, ntr, installment, escapeHtml, stars, productImage, imgFallback, genImage, productCard, toast, openModal, closeModal, statusPill, I };
})();
