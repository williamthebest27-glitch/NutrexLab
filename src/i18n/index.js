import { LANG_INFO, DEFAULT_LANG, isLang, initialLang, saveLang } from './langs.js'

/*
  Traduzioni del sito, applicate nel browser senza ricaricare la pagina.

  La chiave di ogni traduzione e' il testo italiano stesso (src/i18n/locales/<lingua>/*.js):
  - testi dell'HTML: l'elemento ha l'attributo data-i18n e dentro il testo italiano (anche con <b>, <br>,
    link...); data-i18n-attr="aria-label alt" traduce gli attributi elencati;
  - testi scritti dal JavaScript: t('Testo italiano') o t('Con {n} pezzi', { n }); tp(n, 'singolare',
    'plurale') per i numeri;
  - dati dei prodotti (testi della homepage, catalogo, schede di WooCommerce): localize(oggetto) traduce
    tutti i testi dell'oggetto con lo stesso dizionario.
  Spazi e a capo non contano. Un testo senza traduzione resta in italiano (in sviluppo lo segnala la
  console): cambiando un testo italiano va aggiornata anche la sua traduzione (npm test lo controlla).

  Ogni lingua e' un file a parte, scaricato solo quando serve. Cambiando lingua: setLang('de') carica il
  file, traduce l'HTML della pagina e avvisa le pagine (onLang) che ridisegnano le loro parti.

  Fuori dal browser (build di Vite, src/seo/build.js che usa le schede di src/shop/card.js) non c'e' il
  DOM: la lingua resta l'italiano e t() restituisce il testo com'e'.
*/

const LOADERS = {
  en: () => import('./locales/en.js'),
  fr: () => import('./locales/fr.js'),
  de: () => import('./locales/de.js'),
  es: () => import('./locales/es.js'),
}

const browser = typeof document !== 'undefined'
const html = browser ? document.documentElement : null
let current = DEFAULT_LANG
let dict = null // Map: testo italiano normalizzato -> traduzione
const cache = new Map()
const listeners = new Set()

export { LANG_INFO, isLang }
export { LANGS } from './langs.js'
export const lang = () => current
export const locale = () => LANG_INFO[current].locale

/**
 * Chiave di un testo: spazi e a capo non contano (anche l'HTML: <br /> e <br> sono la stessa cosa), ne'
 * come sono scritte le lettere accentate (a + accento o un carattere solo: forma NFC).
 */
const tpl = browser ? document.createElement('template') : null
const squeeze = (s) => String(s).replace(/\s+/g, ' ').trim()
export function norm(s) {
  const str = String(s ?? '').normalize('NFC')
  if (!tpl || !/[<&]/.test(str)) return squeeze(str)
  tpl.innerHTML = str
  return squeeze(tpl.innerHTML)
}

async function load(l) {
  if (l === DEFAULT_LANG) return null
  if (!cache.has(l)) {
    cache.set(
      l,
      LOADERS[l]().then((m) => {
        const map = new Map()
        for (const part of Object.values(m.default)) for (const [it, tr] of Object.entries(part)) map.set(norm(it), tr)
        return map
      }),
    )
  }
  return cache.get(l)
}

// ---------------------------------------------------------------------------
// testi

const missing = browser && import.meta.env?.DEV ? new Set() : null
function warn(key) {
  if (!missing || missing.has(`${current}|${key}`)) return
  missing.add(`${current}|${key}`)
  console.warn(`[i18n] ${current}: manca la traduzione di`, JSON.stringify(key))
}

/** In sviluppo: i testi senza traduzione visti finora (window.__i18nMissing()). */
if (missing) window.__i18nMissing = () => [...missing]

const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s)

// testi uguali in tutte le lingue: marchio, quantita' con unita' (500 g, 180 mg...)
const SAME = /^(Nutrex Lab|[\d\s.,%/+-]+\s*(mg|g|µg|kg|ml|UI|GDU)?)$/

/** Traduzione di un testo italiano (null se non c'e'). */
function lookup(it) {
  if (current === DEFAULT_LANG || it == null || it === '' || !/[A-Za-zÀ-ÿ]/.test(it)) return null
  const s = dict?.get(norm(it))
  if (s == null && it.length > 3 && !SAME.test(String(it).trim())) warn(it)
  return s ?? null
}

/** Testo tradotto (la chiave e' il testo italiano). vars: { n: 3 } per i segnaposto {n}. */
export function t(it, vars) {
  return fill(lookup(it) ?? it, vars)
}

/** Forma singolare/plurale secondo la lingua (in francese anche lo 0 e' singolare). */
export function tp(n, one, other, vars) {
  const single = current === 'fr' ? n === 0 || n === 1 : n === 1
  return t(single ? one : other, { n, ...vars })
}

/**
 * Copia di un dato con tutti i testi tradotti (oggetti e liste, anche annidati). skip: nomi dei campi da
 * non tradurre (slug, simboli...). In italiano ritorna il dato stesso.
 */
export function localize(value, skip = LOCALIZE_SKIP) {
  if (current === DEFAULT_LANG) return value
  const walk = (v, key) => {
    if (typeof v === 'string') return skip.has(key) ? v : (lookup(v) ?? v)
    if (Array.isArray(v)) return v.map((x) => walk(x, key))
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const out = {}
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k)
      return out
    }
    return v
  }
  return walk(value, '')
}
const LOCALIZE_SKIP = new Set(['id', 'slug', 'category', 'quality', 'icon', 'model', 'form', 'shape', 'swatch', 'src', 'srcset', 'thumbnail', 'href', 'url', 'path', 'sku', 'type', 'code'])

/** Numeri nel formato della lingua (10.000 / 10,000 / 10 000). */
const numberFormats = new Map()
export function formatNumber(value, { decimals = 0, grouping = 'always' } = {}) {
  const key = `${current}|${decimals}|${grouping}`
  if (!numberFormats.has(key)) {
    numberFormats.set(
      key,
      new Intl.NumberFormat(locale(), { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping }),
    )
  }
  return numberFormats.get(key).format(value)
}

/** Data lunga nella lingua (9 ottobre 2026 / 9 October 2026...). */
export const formatDate = (date) => new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date)

// ---------------------------------------------------------------------------
// testi dell'HTML

const ORIGINAL = new WeakMap()

/** HTML e attributi italiani di un elemento (presi la prima volta, prima di ogni traduzione). */
function original(el) {
  let o = ORIGINAL.get(el)
  if (!o) {
    const split = el._split
    if (split) split.revert()
    o = { html: el.innerHTML, attrs: {} }
    ORIGINAL.set(el, o)
    if (split) split.split()
  }
  return o
}

/** HTML italiano di un elemento [data-i18n] (il testo di partenza, qualunque sia la lingua del sito). */
export const sourceHtml = (el) => original(el).html

/** Cambia il contenuto anche dei testi divisi in righe/lettere per le animazioni (SplitText). */
function setInner(el, value) {
  const split = el._split
  if (split) {
    split.revert()
    el.innerHTML = value
    split.split()
  } else {
    el.innerHTML = value
  }
}

/** Traduce gli elementi [data-i18n] e gli attributi [data-i18n-attr] dentro root (anche root stesso). */
export function translateDom(root = document) {
  const sel = '[data-i18n], [data-i18n-attr]'
  const all = [...(root.matches?.(sel) ? [root] : []), ...(root.querySelectorAll?.(sel) ?? [])]
  for (const el of all) {
    if (el._i18nLang === current) continue
    const o = original(el)
    if (el.hasAttribute('data-i18n')) {
      const value = lookup(o.html) ?? o.html
      if (el.innerHTML !== value || el._i18nLang) setInner(el, value)
    }
    const names = el.dataset.i18nAttr
    if (names) {
      for (const attr of names.split(/[\s,]+/).filter(Boolean)) {
        if (!(attr in o.attrs)) o.attrs[attr] = el.getAttribute(attr)
        const it = o.attrs[attr]
        if (it == null) continue
        el.setAttribute(attr, lookup(it) ?? it)
      }
    }
    el._i18nLang = current
  }
}

// ---------------------------------------------------------------------------
// titolo e descrizione della pagina

const META = browser
  ? { title: document.title, description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '' }
  : { title: '', description: '' }

/** Titolo della scheda e descrizione nella lingua (le pagine che li cambiano passano quelli italiani). */
export function setMeta({ title, description } = {}) {
  if (title !== undefined) META.title = title
  if (description !== undefined) META.description = description
  document.title = t(META.title)
  document.querySelector('meta[name="description"]')?.setAttribute('content', t(META.description))
}

// ---------------------------------------------------------------------------
// link all'area clienti

/**
 * I link all'area clienti (/account: sta sul WooCommerce, api/account.js) portano la lingua del sito
 * (?lang=de), cosi' l'area clienti si apre nella stessa lingua. Anche l'italiano: chi torna all'italiano
 * ritrova l'area clienti in italiano.
 */
function langLinks() {
  for (const a of document.querySelectorAll('a[href^="/account"]')) {
    const url = new URL(a.getAttribute('href'), location.origin)
    url.searchParams.set('lang', current)
    a.setAttribute('href', url.pathname + url.search + url.hash)
  }
}

// ---------------------------------------------------------------------------
// cambio lingua

/** Si viene avvisati a ogni cambio di lingua (dopo che l'HTML e' gia' tradotto). */
export function onLang(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(current)
    } catch (err) {
      console.error('[i18n]', err)
    }
  }
  html.dispatchEvent(new CustomEvent('nx:lang', { detail: { lang: current } }))
}

function mark() {
  html.lang = current
  html.dataset.lang = current
}

let switching = null
/** Cambia lingua senza ricaricare: scarica le traduzioni, traduce la pagina, avvisa le pagine. */
export async function setLang(l) {
  if (!isLang(l) || l === current) return
  const job = (switching = load(l))
  const next = await job
  if (job !== switching) return // nel frattempo e' stata scelta un'altra lingua
  current = l
  dict = next
  saveLang(l)
  mark()
  translateDom(document)
  langLinks()
  setMeta()
  notify()
}

/*
  All'apertura: la lingua scelta (o di ?lang=) si applica prima di mostrare la pagina. Lo script
  nell'<head> (src/partials/head.html) nasconde i testi traducibili finche' non e' pronta
  (classe i18n-wait). ready si risolve con la lingua pronta: le pagine lo aspettano prima di disegnare.
*/
export const ready = (async () => {
  if (!browser) return DEFAULT_LANG
  const l = initialLang()
  // ?lang= di un link: la scelta resta nella memoria del browser e l'indirizzo torna pulito (cosi', cambiata
  // la lingua dal selettore, ricaricando la pagina non torna quella del link)
  try {
    const url = new URL(location.href)
    if (url.searchParams.has('lang')) {
      if (isLang(url.searchParams.get('lang'))) saveLang(l) // anche ?lang=it: vale la lingua del link
      url.searchParams.delete('lang')
      history.replaceState(history.state, '', url)
    }
  } catch {
    // indirizzo non modificabile: resta com'e'
  }
  try {
    if (l !== DEFAULT_LANG) {
      dict = await load(l)
      current = l
    }
  } catch (err) {
    console.error('[i18n] lingua non disponibile', err)
    current = DEFAULT_LANG
    dict = null
  }
  mark()
  translateDom(document)
  langLinks()
  setMeta()
  html.classList.remove('i18n-wait')
  // chi si e' gia' iscritto (prima che la lingua fosse pronta) ridisegna nella lingua scelta
  if (current !== DEFAULT_LANG) notify()
  return current
})()
