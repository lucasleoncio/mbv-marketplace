// Normaliza texto para busca: minúsculas, sem acentos, espaços colapsados.
function normalize(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
module.exports = { normalize };
