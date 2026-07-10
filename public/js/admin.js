/* ============================================================
   MBV Admin — carregado SOB DEMANDA por app.js (só na rota /admin).
   Compartilha o escopo global dos scripts clássicos (Pages, mount,
   icon, API, Store, toast, etc. já existem quando este arquivo roda).
   ============================================================ */
// Roteador do painel (chamado pelo loader em app.js, já autenticado como admin).
function AdminRouter(parts, query) {
  const sub = parts[0] || 'dashboard';
  if (sub === 'produtos' && parts[1] === 'novo') return Admin.productForm(null);
  if (sub === 'produtos' && parts[1]) return Admin.productForm(parts[1]);
  if (sub === 'produtos') return Admin.products();
  if (sub === 'pedidos') return Admin.orders();
  if (sub === 'cupons') return Admin.coupons();
  if (sub === 'usuarios') return Admin.users();
  return Admin.dashboard();
}

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

// Sinaliza ao loader (app.js) que o bundle admin terminou de registrar.
window.__mbvAdminReady = true;
