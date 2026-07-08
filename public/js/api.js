// Cliente HTTP do MBV — adiciona token JWT e trata erros.
const API = (function () {
  const KEY = 'mbv_token';
  function getToken() { return localStorage.getItem(KEY); }
  function setToken(t) { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); }

  // GETs re-tentam com backoff (1,2s → 3s): cobre o cold start do Render (~30-50s de wake)
  // e oscilações de rede. Escritas (POST/PUT/…) nunca re-tentam — evita efeito duplicado.
  const RETRY_STATUS = [502, 503, 504];
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  async function req(method, path, body, isForm) {
    const headers = {};
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const opts = { method, headers };
    if (isForm) { opts.body = body; }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }

    const attempts = method === 'GET' ? 3 : 1;
    let res = null;
    for (let i = 0; i < attempts; i++) {
      if (i) await wait(i === 1 ? 1200 : 3000);
      try { res = await fetch('/api' + path, opts); }
      catch (e) { res = null; continue; } // falha de rede: re-tenta (só GET chega aqui de novo)
      if (!(RETRY_STATUS.includes(res.status) && i < attempts - 1)) break;
    }
    if (!res) throw new Error('Não foi possível conectar. O servidor pode estar iniciando — tente novamente em instantes.');

    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || 'Ocorreu um erro inesperado.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    getToken, setToken,
    get: (p) => req('GET', p),
    post: (p, b) => req('POST', p, b),
    put: (p, b) => req('PUT', p, b),
    patch: (p, b) => req('PATCH', p, b),
    del: (p) => req('DELETE', p),
    upload: (p, formData) => req('POST', p, formData, true)
  };
})();
