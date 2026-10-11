/*
  Lingue del sito. L'italiano e' la lingua di partenza: e' quella scritta nell'HTML e nei file del sito.
  Ogni lingua ha i suoi indirizzi, cosi' i motori di ricerca trovano e indicizzano ogni versione:
    italiano  /integratori          (senza prefisso, come sempre)
    altre     /de/integratori, /en/prodotto/<slug>, /fr (homepage) ...
  Le pagine delle altre lingue sono gia' tradotte nell'HTML (build: vite.config.js, plugin "i18n-pages";
  pagina prodotto: server/product-page.js), con canonical, hreflang e dati strutturati nella loro lingua.
  Nel browser si cambia lingua senza ricaricare la pagina (src/i18n/index.js): cambia anche l'indirizzo.

  Quale lingua vede chi apre il sito senza prefisso (es. https://www.nutrexlab.it/):
  - la lingua scelta in passato dal selettore (cookie nx_lang, anche "it"), altrimenti
  - quella del paese da cui arriva (middleware.js e src/i18n/geo.js: Germania -> tedesco, Francia ->
    francese...), mai per i motori di ricerca, che vedono sempre la pagina dell'indirizzo che aprono.
  Un indirizzo con il prefisso mostra sempre la sua lingua. ?lang=de nei link (pagamento e area clienti
  sul WooCommerce) porta alla stessa pagina in quella lingua e la ricorda.
  Solo dati e funzioni pure: lo usano anche il middleware, il server e la build (niente DOM qui).
*/

export const LANGS = ['it', 'en', 'fr', 'de', 'es']
export const DEFAULT_LANG = 'it'
/** Lingue con il prefisso nell'indirizzo (tutte tranne l'italiano). */
export const PREFIXED = LANGS.filter((l) => l !== DEFAULT_LANG)
/** Versione per chi cerca in una lingua che il sito non ha (hreflang x-default). */
export const FALLBACK_LANG = 'en'
/** Lingua scelta dal visitatore: cookie (lo legge anche il middleware) e memoria del browser. */
export const STORAGE_KEY = 'nx_lang'
export const COOKIE = 'nx_lang'

export const LANG_INFO = {
  it: { name: 'Italiano', short: 'IT', locale: 'it-IT' },
  en: { name: 'English', short: 'EN', locale: 'en-GB' },
  fr: { name: 'Français', short: 'FR', locale: 'fr-FR' },
  de: { name: 'Deutsch', short: 'DE', locale: 'de-DE' },
  es: { name: 'Español', short: 'ES', locale: 'es-ES' },
}

export const isLang = (l) => LANGS.includes(l)

/** Open Graph vuole it_IT, en_GB... */
export const ogLocale = (l) => LANG_INFO[l].locale.replace('-', '_')

// ---------------------------------------------------------------------------
// indirizzi

const PREFIX = new RegExp(`^/(${PREFIXED.join('|')})(?=/|$)`)

/** '/de/integratori' -> { lang: 'de', path: '/integratori' }; '/integratori' -> { lang: null, path: '/integratori' }. */
export function splitLang(pathname) {
  const p = String(pathname || '/')
  const m = PREFIX.exec(p)
  if (!m) return { lang: null, path: p }
  return { lang: m[1], path: p.slice(m[0].length) || '/' }
}

/** Percorso italiano di un indirizzo (senza prefisso della lingua). */
export const stripLang = (pathname) => splitLang(pathname).path

/**
 * Lo stesso percorso nella lingua l: '/integratori' -> '/de/integratori', '/' -> '/de', '/?prodotto=x' ->
 * '/de?prodotto=x'. Accetta anche un percorso che ha gia' un prefisso (lo sostituisce). Italiano: senza prefisso.
 */
export function withLang(href, l) {
  const s = String(href || '/')
  const cut = s.search(/[?#]/)
  const pathname = cut < 0 ? s : s.slice(0, cut)
  const rest = cut < 0 ? '' : s.slice(cut)
  const path = stripLang(pathname || '/')
  if (!isLang(l) || l === DEFAULT_LANG) return path + rest
  return (path === '/' ? `/${l}` : `/${l}${path}`) + rest
}

/**
 * Un percorso del sito che ha una versione in ogni lingua (le pagine): senza estensione, fuori da /api, dalle
 * cartelle dei file (/assets, /images...) e da /account (l'area clienti sul WooCommerce: porta ?lang=).
 */
export function isPagePath(href) {
  const s = String(href ?? '')
  if (!s.startsWith('/') || s.startsWith('//')) return false
  const path = stripLang(s.split(/[?#]/)[0] || '/')
  if (/^\/(api|assets|images|models|draco|email|account)(\/|$)/.test(path)) return false
  return !/\.[a-z0-9]+$/i.test(path)
}

// ---------------------------------------------------------------------------
// lingua scelta (cookie + memoria del browser)

/** Valore del cookie nx_lang in un'intestazione Cookie (o document.cookie). */
export function cookieLang(cookieHeader) {
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([a-z]{2})(?:;|$)`).exec(String(cookieHeader ?? ''))
  return m && isLang(m[1]) ? m[1] : null
}

/** Lingua scelta in passato dal visitatore (cookie, poi memoria del browser), null se non l'ha mai scelta. */
export function savedLang() {
  try {
    const c = cookieLang(document.cookie)
    if (c) return c
  } catch {
    // cookie non leggibili
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // memoria non disponibile (navigazione privata)
  }
  return null
}

/** Ricorda la lingua scelta (anche l'italiano: chi sceglie l'italiano non viene piu' mandato altrove). */
export function saveLang(l) {
  if (!isLang(l)) return
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
  } catch {
    // niente cookie
  }
  try {
    localStorage.setItem(STORAGE_KEY, l)
  } catch {
    // niente memoria: la lingua vale solo per questa pagina
  }
}
