// Observabilidade — logs estruturados + captura de erros no Sentry (opcional).
//
// Sem SENTRY_DSN é tudo no-op: os logs continuam legíveis no console do Render e
// nada é enviado para fora. Com SENTRY_DSN definido, erros 5xx e exceções não
// tratadas são enviados ao Sentry via a Store API (HTTP puro — ZERO dependência
// nova, mantendo a stack enxuta). Nunca vaza segredo: o payload leva método, rota,
// status e a stack — nunca corpo de request, headers ou variáveis de ambiente.
const { SENTRY_DSN, NODE_ENV } = require('../config');

// ---------- Logger estruturado ----------
// Uma linha JSON por evento (ts, level, msg, ...campos) — fácil de filtrar/pesquisar
// nos Logs do Render e pronto para um coletor externo no futuro.
function log(level, msg, fields) {
  const line = { ts: new Date().toISOString(), level, msg, ...(fields || {}) };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}
const logger = {
  info: (msg, f) => log('info', msg, f),
  warn: (msg, f) => log('warn', msg, f),
  error: (msg, f) => log('error', msg, f)
};

// ---------- Sentry via Store API (sem SDK) ----------
let sentryEndpoint = null, sentryHeader = null;
if (SENTRY_DSN) {
  try {
    // DSN: https://<publicKey>@<host>/<projectId>
    const u = new URL(SENTRY_DSN);
    const projectId = u.pathname.replace(/\//g, '');
    sentryEndpoint = `${u.protocol}//${u.host}/api/${projectId}/store/`;
    sentryHeader = `Sentry sentry_version=7, sentry_client=mbv/1.0, sentry_key=${u.username}`;
    logger.info('sentry.enabled', { host: u.host, project: projectId });
  } catch (e) {
    logger.warn('sentry.dsn_invalido', { error: e.message });
  }
}

function captureException(err, context) {
  if (!sentryEndpoint) return;
  try {
    const payload = JSON.stringify({
      timestamp: new Date().toISOString(),
      platform: 'node',
      level: 'error',
      environment: NODE_ENV || 'production',
      server_name: 'mbv-marketplace',
      exception: { values: [{ type: err && err.name || 'Error', value: err && err.message || String(err), stacktrace: parseStack(err) }] },
      tags: (context && context.tags) || undefined,
      request: (context && context.request) || undefined
    });
    // fire-and-forget: observabilidade nunca pode atrasar/derrubar a resposta ao cliente
    fetch(sentryEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': sentryHeader }, body: payload })
      .catch(() => {});
  } catch (_) { /* nunca lança */ }
}

// Converte a stack do Node no formato de frames do Sentry (mais recente por último).
function parseStack(err) {
  if (!err || !err.stack) return undefined;
  const frames = err.stack.split('\n').slice(1).map((l) => {
    const m = l.match(/at (?:(.+?) )?\(?(.+?):(\d+):(\d+)\)?/);
    if (!m) return null;
    return { function: m[1] || '?', filename: m[2], lineno: Number(m[3]), colno: Number(m[4]) };
  }).filter(Boolean).reverse();
  return frames.length ? { frames } : undefined;
}

// Middleware de log de requisição: 1 linha por request com método, rota, status e ms.
// Health checks não poluem o log (o Render bate no /api/health o tempo todo).
function requestLogger() {
  return (req, res, next) => {
    if (req.path === '/api/health') return next();
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      log(level, 'http', { method: req.method, path: req.path, status: res.statusCode, ms, ip: req.ip });
    });
    next();
  };
}

module.exports = { logger, captureException, requestLogger, sentryEnabled: !!sentryEndpoint };
