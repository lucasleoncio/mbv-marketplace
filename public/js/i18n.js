/* =========================================================================
   MBV Marketplace — Motor de i18n para a SPA.
   Lê window.MBV_I18N (dicionário) e window.MBV_LANGS (idiomas). Diferente da
   landing (que varre data-i18n do HTML estático), aqui a SPA REGENERA o DOM a
   cada navegação, então as telas chamam t('chave') direto nas template strings
   e a troca de idioma dispara um re-render completo (hook MBV_onLangChange).

   Cobertura: INTERFACE (chrome, formulários, checkout, mensagens). O CATÁLOGO
   (nomes/descrições de produtos e categorias) vem do banco no idioma cadastrado.
   ========================================================================= */
(function () {
  "use strict";
  var I18N = window.MBV_I18N || {};
  var LANGS = window.MBV_LANGS || [{ code: "pt", label: "Português", dir: "ltr", flag: "🇧🇷" }];
  var DEFAULT = "pt", STORE = "mbv_lang";
  var RTL = {};
  LANGS.forEach(function (l) { if (l.dir === "rtl") RTL[l.code] = true; });
  var current = DEFAULT;

  // t('chave', {var}) — traduz; cai para PT e depois para a própria chave.
  // Suporta interpolação: t('x', {n: 5}) substitui {n} por 5.
  function t(key, vars) {
    var s = (I18N[current] && I18N[current][key] != null) ? I18N[current][key]
      : (I18N[DEFAULT] && I18N[DEFAULT][key] != null) ? I18N[DEFAULT][key]
        : key;
    if (vars) for (var k in vars) s = String(s).split("{" + k + "}").join(vars[k]);
    return s;
  }

  function detect() {
    try { var q = new URL(location.href).searchParams.get("lang"); if (q && I18N[q]) return q; } catch (e) {}
    try { var s = localStorage.getItem(STORE); if (s && I18N[s]) return s; } catch (e) {}
    var nav = (navigator.language || "pt").slice(0, 2);
    if (I18N[nav]) return nav;
    return DEFAULT;
  }

  // skipRender=true no boot (o app.js ainda não montou); depois a troca re-renderiza.
  function setLang(lang, skipRender) {
    if (!I18N[lang]) lang = DEFAULT;
    current = lang;
    var dir = RTL[lang] ? "rtl" : "ltr";
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);
    try { localStorage.setItem(STORE, lang); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set("lang", lang); history.replaceState(null, "", u); } catch (e) {}
    if (!skipRender && typeof window.MBV_onLangChange === "function") window.MBV_onLangChange(lang, dir);
    document.dispatchEvent(new CustomEvent("mbv:lang", { detail: { lang: lang, dir: dir } }));
  }

  window.t = t;
  window.MBV = window.MBV || {};
  window.MBV.t = t;
  window.MBV.setLang = setLang;
  window.MBV.lang = function () { return current; };
  window.MBV.langs = LANGS;
  window.MBV.isRTL = function () { return !!RTL[current]; };

  // Aplica o idioma detectado no <html> antes do app montar (sem re-render).
  setLang(detect(), true);
})();
