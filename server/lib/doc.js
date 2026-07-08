// Validação de CPF e CNPJ pelos dígitos verificadores (rejeita sequências repetidas).
function validCPF(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (len) => {
    let s = 0;
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function validCNPJ(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (w) => {
    let s = 0;
    w.forEach((p, i) => { s += p * Number(d[i]); });
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12])
    && calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
}

// Aceita com ou sem máscara; retorna válido apenas para 11 (CPF) ou 14 (CNPJ) dígitos corretos.
function validCpfCnpj(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return validCPF(d);
  if (d.length === 14) return validCNPJ(d);
  return false;
}

module.exports = { validCpfCnpj, validCPF, validCNPJ };
