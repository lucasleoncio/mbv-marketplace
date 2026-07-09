// Helper dos testes de integração HTTP: sobe o app completo numa porta efêmera
// com banco isolado em diretório temporário. Cada arquivo *.test.js roda em
// processo próprio (node --test), então o env definido aqui não vaza entre suítes.
const os = require('os');
const fs = require('fs');
const path = require('path');

async function startApp(env = {}) {
  process.env.MBV_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mbvtest-'));
  process.env.AUTH_RATE_MAX = '1000'; // testes fazem muitas chamadas de auth; o limite real segue 12/min
  Object.assign(process.env, env);
  const app = require('../index'); // exporta o app sem listen (require.main !== module)
  await app.ready; // schema + seed prontos antes de abrir a porta
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;

      async function api(method, route, { token, body } = {}) {
        const res = await fetch(base + '/api' + route, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {})
          },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        let data = null;
        try { data = await res.json(); } catch (_) { /* respostas sem corpo */ }
        return { status: res.status, data };
      }

      async function login(email, password) {
        const r = await api('POST', '/auth/login', { body: { email, password } });
        if (r.status !== 200) throw new Error(`login ${email} falhou: HTTP ${r.status}`);
        return r.data.token;
      }

      resolve({
        base,
        api,
        login,
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

// Endereço de entrega válido reutilizado nos checkouts dos testes.
const SHIP = { name: 'Cliente Teste', cep: '01001000', address: 'Rua Teste, 100', city: 'São Paulo', state: 'SP', phone: '11999990000' };

module.exports = { startApp, SHIP };
