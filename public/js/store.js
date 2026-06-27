// Estado global simples do app (usuário, carrinho, saldo, categorias).
const Store = {
  user: null,
  cartCount: 0,
  balance: 0,
  categories: [],
  favorites: new Set(),
  chain: null,        // config de rede on-chain (de /api/chain)
  rate: 9.36,         // cotação: R$ por NTR

  isAuthed() { return !!this.user; },
  isAdmin() { return this.user && this.user.role === 'admin'; },

  // Carrega usuário atual (se houver token), categorias e contagem do carrinho.
  async init() {
    try { this.categories = (await API.get('/products/meta/categories')).categories; } catch (_) {}
    try { this.chain = await API.get('/chain'); if (this.chain && this.chain.brlPerToken) this.rate = this.chain.brlPerToken; } catch (_) {}
    if (API.getToken()) {
      try {
        const { user } = await API.get('/auth/me');
        this.user = user; this.balance = user.mbv_balance;
        await this.refreshCart();
        await this.refreshFavorites();
      } catch (_) { API.setToken(null); this.user = null; }
    }
    if (!this.user) this.loadGuestState(); // visitante: carrinho/favoritos do localStorage
  },

  async refreshCart() {
    if (!this.user) { this.cartCount = 0; return; }
    try { this.cartCount = (await API.get('/cart')).count; } catch (_) {}
  },

  async refreshFavorites() {
    if (!this.user) { this.favorites = new Set(); return; }
    try {
      const { items } = await API.get('/cart/favorites/list');
      this.favorites = new Set(items.map(i => i.id));
    } catch (_) {}
  },

  async refreshUser() {
    if (!this.user) return;
    try { const { user } = await API.get('/auth/me'); this.user = user; this.balance = user.mbv_balance; } catch (_) {}
  },

  setSession(token, user) {
    API.setToken(token); this.user = user; this.balance = user.mbv_balance;
  },
  logout() {
    API.setToken(null); this.user = null; this.balance = 0;
    this.loadGuestState(); // ao sair, volta a ver o carrinho/favoritos de visitante (se houver)
  },

  // ---- Visitante (sem login): carrinho e favoritos em localStorage ----
  _readLS(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } },
  _writeLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  guestCart() { return this._readLS('mbv_guest_cart'); },
  guestCartCount() { return this.guestCart().reduce((s, i) => s + (i.quantity || 0), 0); },
  guestAddToCart(id, qty) {
    const cart = this.guestCart(); const it = cart.find(i => i.product_id === id);
    if (it) it.quantity = Math.min(99, it.quantity + qty); else cart.push({ product_id: id, quantity: Math.min(99, qty) });
    this._writeLS('mbv_guest_cart', cart); this.cartCount = this.guestCartCount(); return this.cartCount;
  },
  guestSetQty(id, qty) {
    let cart = this.guestCart();
    if (qty <= 0) cart = cart.filter(i => i.product_id !== id);
    else { const it = cart.find(i => i.product_id === id); if (it) it.quantity = Math.min(99, qty); }
    this._writeLS('mbv_guest_cart', cart); this.cartCount = this.guestCartCount();
  },
  guestFavs() { return this._readLS('mbv_guest_favs'); },
  guestToggleFav(id) {
    let favs = this.guestFavs(); const on = !favs.includes(id);
    favs = on ? [...favs, id] : favs.filter(x => x !== id);
    this._writeLS('mbv_guest_favs', favs); this.favorites = new Set(favs); return on;
  },
  loadGuestState() { this.cartCount = this.guestCartCount(); this.favorites = new Set(this.guestFavs()); },
  // Após login/cadastro: envia carrinho e favoritos do visitante para o servidor e limpa o local.
  async mergeGuestToServer() {
    for (const it of this.guestCart()) { try { await API.post('/cart', { product_id: it.product_id, quantity: it.quantity }); } catch (_) {} }
    const serverFavs = this.favorites instanceof Set ? this.favorites : new Set();
    for (const id of this.guestFavs()) { if (!serverFavs.has(id)) { try { await API.post('/cart/favorites/' + id); } catch (_) {} } }
    this._writeLS('mbv_guest_cart', []); this._writeLS('mbv_guest_favs', []);
  }
};
