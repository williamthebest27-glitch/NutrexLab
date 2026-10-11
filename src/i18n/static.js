import { DEFAULT_LANG, LANG_INFO, isLang, isPagePath, withLang } from './langs.js'

/*
  Traduzioni fuori dal browser: build (pagine gia' tradotte in dist/<lingua>/, vite.config.js), server di
  sviluppo, pagina prodotto sul server (server/product-page.js) e prove (tests/i18n.test.js).
  Stessi dizionari del browser (src/i18n/locales/<lingua>/: la chiave e' il testo italiano) e stesse regole:
  spazi, a capo, entita' HTML (&amp; = &) e <br /> = <br> non contano.

  translateHtml traduce una pagina HTML intera come translateDom nel browser (elementi data-i18n, attributi
  di data-i18n-attr, voci data-i18n-text, titolo e descrizione) e porta i link alle pagine della stessa
  lingua (/integratori -> /de/integratori). Su ogni testo tradotto lascia il numero della sua voce nel
  dizionario (data-i18n="12", data-i18n-at="aria-label:40"): cosi' il browser ritrova il testo italiano di
  partenza e puo' cambiare lingua senza ricaricare (src/i18n/index.js).
*/

const LOADERS = {
  en: () => import('./locales/en.js'),
  fr: () => import('./locales/fr.js'),
  de: () => import('./locales/de.js'),
  es: () => import('./locales/es.js'),
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', rsquo: '’', lsquo: '‘', ldquo: '“',
  rdquo: '”', hellip: '…', mdash: '—', ndash: '–', rarr: '→', minus: '−', times: '×', reg: '®', copy: '©',
  micro: 'µ', agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù', Egrave: 'È',
  ccedil: 'ç', ntilde: 'ñ', bull: '•', rsaquo: '›', laquo: '«', raquo: '»', deg: '°',
}

/** Chiave di un testo (come norm() di src/i18n/index.js nel browser): entita', <br />, spazi e accenti. */
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFC')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
      e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? m),
    )
    .replace(/\s*\/>/g, '>')
    .replace(/[\s ]+/g, ' ')
    .trim()

// testi uguali in tutte le lingue (come nel browser): marchio, quantita' con unita' (500 g, 180 mg...)
const SAME = /^(Nutrex Lab|[\d\s.,%/+-]+\s*(mg|g|µg|kg|ml|UI|GDU)?)$/

const fill = (s, vars) => (vars ? String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m)) : String(s))

const cache = new Map()

/**
 * Dizionario di una lingua: entries = [[italiano, traduzione], ...] nell'ordine dei file (lo stesso del
 * browser), map = chiave italiana -> traduzione, index = chiave italiana -> posizione in entries.
 * Italiano: dizionario vuoto.
 */
export function dictionary(lang) {
  if (!isLang(lang) || lang === DEFAULT_LANG) return Promise.resolve({ lang: DEFAULT_LANG, entries: [], map: new Map(), index: new Map() })
  if (!cache.has(lang)) {
    cache.set(
      lang,
      LOADERS[lang]().then((m) => {
        const entries = []
        for (const part of Object.values(m.default)) for (const e of Object.entries(part)) entries.push(e)
        const map = new Map()
        const index = new Map()
        entries.forEach(([it, tr], i) => {
          const k = norm(it)
          map.set(k, tr)
          index.set(k, i)
        })
        return { lang, entries, map, index }
      }),
    )
  }
  return cache.get(lang)
}

/**
 * Funzioni di traduzione per un dizionario: t(testo italiano, valori) come nel browser, tp() per singolare e
 * plurale, missing = testi senza traduzione incontrati (restano in italiano).
 */
export function translator(dict) {
  const lang = dict?.lang ?? DEFAULT_LANG
  const missing = new Set()
  const lookup = (it) => {
    if (lang === DEFAULT_LANG || it == null || it === '' || !/[A-Za-zÀ-ÿ]/.test(it)) return null
    const s = dict.map.get(norm(it))
    if (s == null && !SAME.test(String(it).trim())) missing.add(String(it))
    return s ?? null
  }
  const t = (it, vars) => fill(lookup(it) ?? it ?? '', vars)
  const tp = (n, one, other, vars) => t((lang === 'fr' ? n === 0 || n === 1 : n === 1) ? one : other, { n, ...vars })
  return { lang, locale: LANG_INFO[lang].locale, t, tp, lookup, missing, index: (it) => dict?.index.get(norm(it)) ?? null }
}

// ---------------------------------------------------------------------------
// HTML

const TAG = /<([a-zA-Z][\w-]*)\b([^>]*)>/g
const attrRe = (name) => new RegExp(`(\\s${name}\\s*=\\s*)"([^"]*)"`)
const getAttr = (attrs, name) => attrRe(name).exec(attrs)?.[2] ?? null
const hasFlag = (attrs, name) => new RegExp(`\\s${name}(\\s|=|$|/)`).test(attrs)

/** Testo per un attributo HTML: virgolette e < sempre, & solo se non e' gia' un'entita'. */
const escAttr = (s) =>
  String(s)
    .replace(/&(?!(#x[0-9a-f]+|#\d+|[a-z]+);)/gi, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')

/** Contenuto di script, style e commenti coperto da spazi (stesse posizioni): li' dentro non si cerca nulla. */
function mask(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length))
    .replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (m, open, _tag, body, close) => open + ' '.repeat(body.length) + close)
}

/** Fine del contenuto di un elemento (il tag di chiusura corrispondente, anche con elementi uguali dentro). */
function closing(src, tag, from) {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}\\s*>`, 'gi')
  re.lastIndex = from
  let depth = 1
  for (let m; (m = re.exec(src)); ) {
    if (m[0][1] !== '/' && /\/>$/.test(m[0])) continue
    depth += m[0][1] === '/' ? -1 : 1
    if (depth === 0) return m.index
  }
  return -1
}

/**
 * Elementi da tradurre in un HTML (li usano anche le prove): per ognuno il tag di apertura, gli attributi da
 * tradurre (data-i18n-attr) e, se ha data-i18n o data-i18n-text, il contenuto.
 * [{ tag, start, end, attrs, inner: { start, end, text } | null, names: [...] }]
 */
export function i18nElements(html) {
  const src = mask(html)
  const out = []
  for (const m of src.matchAll(TAG)) {
    const [whole, tag, attrs] = m
    const names = (getAttr(attrs, 'data-i18n-attr') ?? '').split(/[\s,]+/).filter(Boolean)
    const text = hasFlag(attrs, 'data-i18n') || hasFlag(attrs, 'data-i18n-text')
    if (!names.length && !text) continue
    const el = { tag: tag.toLowerCase(), start: m.index, end: m.index + whole.length, attrs, names, inner: null }
    if (text) {
      const end = closing(src, tag, el.end)
      if (end > 0) el.inner = { start: el.end, end, text: html.slice(el.end, end) }
    }
    out.push(el)
  }
  return out
}

/** Porta i link interni di un tag <a> alla lingua (le pagine; /account riceve ?lang=). */
function localizeHref(tagHtml, lang) {
  return tagHtml.replace(/(\shref\s*=\s*)"([^"]*)"/, (m, pre, href) => {
    if (/^\/account(?=[/?#]|$)/.test(href)) {
      const [path, hash = ''] = href.split('#')
      const sep = path.includes('?') ? '&' : '?'
      return `${pre}"${path}${/[?&]lang=/.test(path) ? '' : `${sep}lang=${lang}`}${hash ? `#${hash}` : ''}"`
    }
    return isPagePath(href) ? `${pre}"${withLang(href, lang)}"` : m
  })
}

/**
 * Pagina HTML tradotta nella lingua di tr (translator()). Traduce i testi segnati, titolo e descrizione,
 * mette <html lang="de" data-src-lang="de"> e porta i link interni alla stessa lingua.
 */
export function translateHtml(html, tr) {
  const { lang } = tr
  if (lang === DEFAULT_LANG) return html
  const edits = [] // [inizio, fine, testo nuovo], senza sovrapposizioni
  let covered = -1 // fine del contenuto gia' tradotto per intero (gli elementi dentro si saltano)

  for (const el of i18nElements(html)) {
    if (el.start < covered) continue
    let open = html.slice(el.start, el.end)
    // attributi (aria-label, alt, placeholder...)
    const at = []
    for (const name of el.names) {
      const it = getAttr(el.attrs, name)
      if (it == null || !tr.lookup(it)) continue
      at.push(`${name}:${tr.index(it)}`)
      open = open.replace(attrRe(name), (m, pre) => `${pre}"${escAttr(tr.t(it))}"`)
    }
    if (at.length) open = open.replace(/^<[a-zA-Z][\w-]*/, (m) => `${m} data-i18n-at="${at.join(' ')}"`)
    // contenuto
    if (el.inner && tr.lookup(el.inner.text) != null) {
      const i = tr.index(el.inner.text)
      const flag = hasFlag(el.attrs, 'data-i18n') ? 'data-i18n' : 'data-i18n-text'
      open = open.replace(new RegExp(`(\\s${flag})(?=[\\s>/])(?!\\s*=)`), `$1="${i}"`)
      edits.push([el.start, el.inner.end, open + tr.t(el.inner.text)])
      covered = el.inner.end
    } else if (open !== html.slice(el.start, el.end)) {
      edits.push([el.start, el.end, open])
    }
  }

  let out = ''
  let pos = 0
  for (const [start, end, text] of edits) {
    out += html.slice(pos, start) + text
    pos = end
  }
  out += html.slice(pos)

  // link interni, lingua del documento, titolo e descrizione (quando non arrivano da src/seo/pages.js)
  const masked = mask(out)
  const headEnd = masked.search(/<\/head\s*>/i)
  let result = ''
  pos = 0
  for (const m of masked.matchAll(/<(a|html|title|meta)\b[^>]*>/gi)) {
    const tag = m[1].toLowerCase()
    // titolo e descrizione solo quelli della pagina (nell'<head>; i <title> delle icone SVG restano)
    if ((tag === 'title' || tag === 'meta') && (headEnd < 0 || m.index > headEnd)) continue
    let open = out.slice(m.index, m.index + m[0].length)
    let tail = m.index + m[0].length
    if (tag === 'a') open = localizeHref(open, lang)
    else if (tag === 'html') {
      open = open.replace(/\slang="[^"]*"/, '').replace(/^<html/i, `<html lang="${lang}" data-src-lang="${lang}"`)
    } else if (tag === 'title') {
      const end = out.indexOf('</title>', tail)
      const it = out.slice(tail, end)
      if (end > 0 && tr.lookup(it) != null) {
        open = `<title data-i18n="${tr.index(it)}">${escText(tr.t(it))}`
        tail = end
      }
    } else if (tag === 'meta' && /\sname="description"/.test(open)) {
      const it = getAttr(open, 'content')
      if (it && tr.lookup(it) != null) open = open.replace(attrRe('content'), (x, pre) => `${pre}"${escAttr(tr.t(it))}" data-i18n="${tr.index(it)}"`)
    }
    result += out.slice(pos, m.index) + open
    pos = tail
  }
  return result + out.slice(pos)
}

const escText = (s) => String(s).replace(/&(?!(#x[0-9a-f]+|#\d+|[a-z]+);)/gi, '&amp;').replace(/</g, '&lt;')
