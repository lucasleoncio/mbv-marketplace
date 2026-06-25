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
    API.setToken(null); this.user = null; this.cartCount = 0; this.balance = 0; this.favorites = new Set();
  }
};
