/* ============================================
   PREVAILER MATATU JOURNEY — i18n.js
   Generic, data-driven translation engine.

   - Content lives in i18n/<lang>.json, never in HTML or JS (except "ti", whose file is
     named i18n/tigrinya.json — see I18N_FILENAMES below — while the language code itself
     stays the short "ti" everywhere else: I18N_LABELS, data-audio-ti attributes, the saved
     localStorage preference, etc.).
   - Any element with class "text-panel" and an id is auto-wired to
     panels[id] in the active language's JSON.
   - Any element with a data-i18n="path.to.key" attribute is wired to
     that key (uses textContent, or innerHTML if data-i18n-html is present).
   - Missing/blank keys in a non-English language fall back to English
     automatically, so partial translations never show empty text.
   - Adding a language: add "<code>": "LABEL" to I18N_LABELS below and
     drop a matching i18n/<code>.json file next to en.json.
   ============================================ */

const I18N_LABELS  = { en: 'ENGLISH', sw: 'KISWAHILI', ti: 'ትግርኛ' };
// Language code -> JSON filename, only where it differs from "<code>.json". Everything else
// (I18N_LABELS keys, data-audio-ti attributes, the saved language preference) keeps using the
// short code "ti" — only the on-disk filename is the exception, kept readable as "tigrinya.json".
const I18N_FILENAMES = { ti: 'tigrinya', sw: 'kiswahili' };
const I18N_DEFAULT = 'en';
const I18N_STORAGE_KEY = 'prevailerLang';

let i18nCurrent = I18N_DEFAULT;
const i18nCache = {};

async function i18nLoad(lang) {
  if (i18nCache[lang]) return i18nCache[lang];
  const filename = I18N_FILENAMES[lang] || lang;
  const res  = await fetch(`i18n/${filename}.json`);
  const data = await res.json();
  i18nCache[lang] = data;
  return data;
}

function i18nGet(lang, path) {
  let cur = i18nCache[lang];
  for (const key of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

// String lookup (panels/ui): blank or missing → fall back to English.
function t(path) {
  const val = i18nGet(i18nCurrent, path);
  if (val !== undefined && val !== null && val !== '') return val;
  return i18nGet(I18N_DEFAULT, path);
}

// Character-bubble lookup: merges per-field, so a partial translation
// (e.g. only "dialogue" filled in) still falls back field-by-field.
function tChar(key) {
  const en  = i18nGet(I18N_DEFAULT, `chars.${key}`) || {};
  const cur = i18nGet(i18nCurrent, `chars.${key}`) || {};
  const merged = Object.assign({}, en);
  Object.keys(cur).forEach(k => { if (cur[k]) merged[k] = cur[k]; });
  return merged;
}

function i18nRenderDOM() {
  document.querySelectorAll('.text-panel[id]').forEach(el => {
    const html = t(`panels.${el.id}`);
    if (html == null) return;
    // Panels with a static bubble__tail arrow (see index.html) keep it out of the
    // translated string entirely — the arrow's own SVG lives once in the HTML, sourced
    // from English, and is never touched by a language switch. Translated text goes into
    // the inner [data-i18n-panel-text] wrapper instead of the panel's own innerHTML, so
    // this doesn't wipe out that sibling SVG the way overwriting the whole panel would.
    const textTarget = el.querySelector(':scope > [data-i18n-panel-text]') || el;
    textTarget.innerHTML = html;
  });

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val == null) return;
    if (el.dataset.i18nHtml !== undefined) el.innerHTML = val;
    else el.textContent = val;
  });

  // Image alt text — same fallback rules as data-i18n, applied to the alt attribute
  // instead of textContent. The English string stays hard-coded in the alt="" markup
  // as the pre-hydration/no-JS fallback; this only overwrites it once JSON is loaded.
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const val = t(el.dataset.i18nAlt);
    if (val != null) el.alt = val;
  });

  // Image source — same fallback rules as data-i18n, applied to src instead of textContent.
  // The English file stays hard-coded as src="" (the pre-hydration/no-JS fallback); this only
  // swaps it once JSON is loaded, so panels.<key> in each i18n/<lang>.json should hold the
  // path to that language's version of the image (e.g. "assets/foo/screenshot-sw.png").
  document.querySelectorAll('[data-i18n-src]').forEach(el => {
    const val = t(el.dataset.i18nSrc);
    if (val != null) el.src = val;
  });

  document.documentElement.lang = i18nCurrent;
  document.dispatchEvent(new CustomEvent('i18n:rendered'));
}

async function setLanguage(lang) {
  if (!I18N_LABELS[lang]) lang = I18N_DEFAULT;
  await i18nLoad(I18N_DEFAULT);
  if (lang !== I18N_DEFAULT) await i18nLoad(lang);
  i18nCurrent = lang;
  window.i18nCurrentLang = lang; // exposed so non-module scripts (scroll.js) can read the active language
  localStorage.setItem(I18N_STORAGE_KEY, lang);
  i18nRenderDOM();
}

async function i18nInit() {
  const saved = localStorage.getItem(I18N_STORAGE_KEY) || I18N_DEFAULT;
  await setLanguage(saved);
}

i18nInit();
