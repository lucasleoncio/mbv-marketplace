/* Service Worker do MBV Marketplace.
 *
 * Estratégias:
 *  - Navegações (HTML) e API  → NETWORK-FIRST: sempre busca o conteúdo fresco
 *    (preço, estoque, sessão). O cache é só rede de segurança quando offline —
 *    NUNCA serve dado velho de pagamento/estoque com a rede disponível.
 *  - Estáticos (css/js/img)   → STALE-WHILE-REVALIDATE: resposta instantânea do
 *    cache + atualização em segundo plano. É o que suaviza o cold start do Render:
 *    o "esqueleto" da loja pinta na hora, mesmo com o servidor ainda acordando.
 *
 * Bump CACHE_VERSION para invalidar tudo num novo deploy.
 */
const CACHE_VERSION = 'mbv-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const PRECACHE = [
  '/css/styles.css',
  '/js/api.js', '/js/store.js', '/js/components.js', '/js/web3.js', '/js/app.js',
  '/img/logo.svg', '/img/icon-192.png', '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return /\.(css|js|svg|png|jpe?g|webp|woff2?)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // nunca intercepta POST/PUT/DELETE (checkout, login…)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // deixa CDNs/terceiros passarem direto

  // API e uploads: rede sempre; sem rede, não inventa resposta (deixa o app tratar o erro).
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

  // Estáticos versionáveis: stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Navegações (páginas): network-first com fallback ao cache/casca offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put('/__offline_shell', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('/__offline_shell')))
    );
  }
});
