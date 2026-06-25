// Cliente HTTP do MBV — adiciona token JWT e trata erros.
const API = (function () {
  const KEY = 'mbv_token';
  function getToken() { return localStorage.getItem(KEY); }
  function setToken(t) { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); }

  async function req(method, path, body, isForm) {
    const headers = {};
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    const opts = { method, headers };
    if (isForm) { opts.body = body; }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }

    let res;
    try { res = await fetch('/api' + path, opts); }
    catch (e) { throw new Error('Não foi possível conectar ao servidor.'); }

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
