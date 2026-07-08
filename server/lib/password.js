// Política de senha — NIST SP 800-63B: comprimento mínimo real, blocklist de senhas
// comuns (BR) e rejeição de senha contendo nome/e-mail. SEM regras de composição
// forçada (geram senhas previsíveis). Aplicada em REGISTRO e RESET — nunca no login
// (as contas demo admin123/cliente123 continuam funcionando).
const COMMON = [
  '123456', '123456789', '12345678', '1234567', '12345', '102030', '10203040',
  '101010', '123123', '121212', '112233', '654321', '987654321', '666666',
  '147258369', '159357', '12341234', '00000000', 'senha', 'senha123', 'senha1234',
  'mudar123', 'admin', 'admin123', 'password', 'password1', 'brasil', 'brasil123',
  'qwerty', 'qwerty123', 'abc123', 'abc12345', '1qaz2wsx', 'deusefiel', 'deuseamor',
  'jesuscristo', 'flamengo', 'corinthians', 'palmeiras', 'amor123', 'cliente123'
];

function validatePassword(password, { email = '', name = '' } = {}) {
  const p = String(password || '');
  if (p.length < 8) return { ok: false, error: 'A senha deve ter pelo menos 8 caracteres.' };
  if (p.length > 64) return { ok: false, error: 'A senha deve ter no máximo 64 caracteres.' };
  const low = p.toLowerCase();
  if (COMMON.includes(low)) return { ok: false, error: 'Esta senha é muito comum. Escolha uma combinação menos óbvia.' };
  const local = String(email).toLowerCase().split('@')[0];
  if (local && local.length >= 4 && low.includes(local)) {
    return { ok: false, error: 'A senha não pode conter parte do seu e-mail.' };
  }
  for (const tok of String(name).toLowerCase().split(/\s+/)) {
    if (tok.length >= 4 && low.includes(tok)) {
      return { ok: false, error: 'A senha não pode conter o seu nome.' };
    }
  }
  return { ok: true };
}

module.exports = { validatePassword, COMMON };
