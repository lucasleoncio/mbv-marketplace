// TOTP (RFC 6238) com node:crypto — compatível com Google Authenticator, Authy etc.
// SHA-1 · 6 dígitos · período 30s · janela ±1. Secret: 160 bits em Base32 (RFC 4226 §4).
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const s = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out = [];
  for (const c of s) {
    val = (val << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateSecret() { return base32Encode(crypto.randomBytes(20)); }

// HOTP (RFC 4226) para um contador específico.
function hotp(secretB32, counter) {
  const key = base32Decode(secretB32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const code = (((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) % 1e6;
  return String(code).padStart(6, '0');
}

function stepAt(ms = Date.now()) { return Math.floor(ms / 1000 / 30); }

// Verifica o código na janela ±1 SEM early-return (mitiga timing attack) e exige
// step > lastStep (anti-replay: o mesmo código nunca vale duas vezes).
function verify(secretB32, code, { lastStep = 0, now = Date.now() } = {}) {
  const target = String(code || '').replace(/\D/g, '');
  if (target.length !== 6 || !secretB32) return { ok: false };
  const cur = stepAt(now);
  let matched = -1;
  for (const s of [cur - 1, cur, cur + 1]) {
    const c = hotp(secretB32, s);
    const eq = crypto.timingSafeEqual(Buffer.from(c), Buffer.from(target));
    if (eq && s > lastStep && matched === -1) matched = s;
  }
  return matched === -1 ? { ok: false } : { ok: true, step: matched };
}

// URI para o QR code (issuer nos dois lugares, conforme convenção do Google Authenticator).
function otpauthURI(secretB32, label, issuer = 'MBV') {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

module.exports = { generateSecret, hotp, stepAt, verify, otpauthURI, base32Encode, base32Decode };
