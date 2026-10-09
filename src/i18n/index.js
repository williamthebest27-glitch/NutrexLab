import { LANGS, LANG_INFO, DEFAULT_LANG, isLang, initialLang, saveLang } from './langs.js'

/*
  Traduzioni del sito, applicate nel browser senza ricaricare la pagina.

  - Testi dell'HTML (pagine e parti comuni): l'elemento ha data-i18n="chiave" e dentro il testo
    italiano; data-i18n-attr="aria-label:chiave, alt:chiave2" per gli attributi. Le traduzioni stanno
    in src/i18n/locales/<lingua>.js (html), l'italiano resta quello dell'HTML.
  - Testi scritti dal JavaScript: t('Testo italiano') o t('Con {n} pezzi', { n }); la chiave e' il testo
    italiano stesso (locales/<lingua>.js, ui). tp(n, 'singolare', 'plurale') per i numeri.
  - Dati dei prodotti (testi della homepage, catalogo, schede del negozio): section('copy'),
    section('catalog')... con gli stessi campi dei file italiani, solo quelli tradotti.

  Ogni lingua e' un file a parte, scaricato solo quando serve. Cambiando lingua: setLang('de') carica il
  file, traduce l'HTML della pagina e avvisa le pagine (onLang) che ridisegnano le loro parti.
  Una traduzione mancante lascia il testo italiano (in sviluppo lo segnala la console).
*/

const LOADERS = {
  en: () => import('./locales/en.js'),
  fr: () => import('./locales/fr.js'),
  de: () => import('./locales/de.js'),
  es: () => import('./locales/es.js'),
}

const html = document.documentElement
let current = DEFAULT_LANG
let dict = null
const cache = new Map()
const listeners = new Set()

export { LANGS, LANG_INFO, isLang }
export const lang = () => current
export const locale = () => LANG_INFO[current].locale

async function load(l) {
  if (l === DEFAULT_LANG) return null
  if (!cache.has(l)) cache.set(l, LOADERS[l]().then((m) => m.default))
  return cache.get(l)
}

// ---------------------------------------------------------------------------
// testi del JavaScript

const missing = import.meta.env?.DEV ? new Set() : null
function warn(kind, key) {
  if (!missing || missing.has(`${current}|${kind}|${key}`)) return
  missing.add(`${current}|${kind}|${key}`)
  console.warn(`[i18n] ${current}: manca ${kind}`, key)
}

const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : s)

/** Testo tradotto (la chiave e' il testo italiano). vars: { n: 3 } per i segnaposto {n}. */
export function t(it, vars) {
  if (current === DEFAULT_LANG || it == null || it === '') return fill(it, vars)
  const s = dict?.ui?.[it]
  if (s == null) warn('ui', it)
  return fill(s ?? it, vars)
}

/** Forma singolare/plurale secondo la lingua (in francese anche lo 0 e' singolare). */
export function tp(n, one, other, vars) {
  const single = current === 'fr' ? n === 0 || n === 1 : n === 1
  return t(single ? one : other, { n, ...vars })
}

/** Testo di una chiave dell'HTML (src/i18n/locales/<lingua>.js, html) per chi lo scrive da se'. */
export function htmlText(key, it) {
  if (current === DEFAULT_LANG || !key) return it
  const s = dict?.html?.[key]
  if (s == null) warn('html', key)
  return s ?? it
}

/** Parte tradotta dei dati (copy, catalog, woo, products...): undefined in italiano o se manca. */
export function section(name) {
  return current === DEFAULT_LANG ? undefined : dict?.[name]
}

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

/** HTML italiano di un elemento (preso la prima volta, prima di ogni traduzione). */
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

/** Traduce gli elementi [data-i18n] e gli attributi [data-i18n-attr] dentro root. */
export function translateDom(root = document) {
  const table = current === DEFAULT_LANG ? null : dict?.html
  const nodes = root.querySelectorAll ? root.querySelectorAll('[data-i18n], [data-i18n-attr]') : []
  const all = root.matches?.('[data-i18n], [data-i18n-attr]') ? [root, ...nodes] : [...nodes]
  for (const el of all) {
    if (el._i18nLang === current) continue
    const o = original(el)
    const key = el.dataset.i18n
    if (key) {
      let value = o.html
      if (table) {
        if (table[key] == null) warn('html', key)
        else value = table[key]
      }
      setInner(el, value)
    }
    const spec = el.dataset.i18nAttr
    if (spec) {
      for (const pair of spec.split(',')) {
        const [attr, k] = pair.split(':').map((s) => s.trim())
        if (!attr || !k) continue
        if (!(attr in o.attrs)) o.attrs[attr] = el.getAttribute(attr)
        let value = o.attrs[attr]
        if (table) {
          if (table[k] == null) warn('html', k)
          else value = table[k]
        }
        if (value == null) el.removeAttribute(attr)
        else el.setAttribute(attr, value)
      }
    }
    el._i18nLang = current
  }
}

// ---------------------------------------------------------------------------
// titolo e descrizione della pagina

const META = { title: document.title, description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '' }

/** Titolo della scheda e descrizione nella lingua (testi italiani come chiavi, sezione meta). */
export function setMeta({ title, description } = {}) {
  if (title !== undefined) META.title = title
  if (description !== undefined) META.description = description
  const table = section('meta')
  document.title = (table && table[META.title]) || META.title
  const desc = document.querySelector('meta[name="description"]')
  if (desc) desc.setAttribute('content', (table && table[META.description]) || META.description)
}

// ---------------------------------------------------------------------------
// cambio lingua

/** Si viene avvisati a ogni cambio di lingua (dopo che l'HTML e' gia' tradotto). */
export function onLang(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
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
  setMeta()
  for (const fn of listeners) {
    try {
      fn(l)
    } catch (err) {
      console.error('[i18n]', err)
    }
  }
  html.dispatchEvent(new CustomEvent('nx:lang', { detail: { lang: l } }))
}

/*
  All'apertura: la lingua scelta (o di ?lang=) si applica prima di mostrare la pagina. Lo script
  nell'<head> (src/partials/head.html) nasconde i testi traducibili finche' non e' pronta
  (classe i18n-wait). ready si risolve con la lingua pronta: le pagine lo aspettano prima di disegnare.
*/
export const ready = (async () => {
  const l = initialLang()
  try {
    if (l !== DEFAULT_LANG) {
      dict = await load(l)
      current = l
      saveLang(l) // arrivati da un link ?lang=: la scelta resta
    }
  } catch (err) {
    console.error('[i18n] lingua non disponibile', err)
    current = DEFAULT_LANG
    dict = null
  }
  mark()
  translateDom(document)
  setMeta()
  html.classList.remove('i18n-wait')
  // chi si e' gia' iscritto (prima che la lingua fosse pronta) ridisegna nella lingua scelta
  if (current !== DEFAULT_LANG) for (const fn of listeners) fn(current)
  return current
})()
