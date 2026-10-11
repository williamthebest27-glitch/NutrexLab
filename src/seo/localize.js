import { DEFAULT_LANG, LANG_INFO, isPagePath, withLang } from '../i18n/langs.js'
import { ORIGIN, SOCIAL_IMAGE } from './catalog.js'
import { IDS } from './schema.js'

/*
  SEO di una pagina nella lingua del visitatore: titolo, descrizione, testo dell'immagine social e dati
  strutturati tradotti con i dizionari del sito (src/i18n/static.js), indirizzi della stessa lingua
  (canonical, pagina, breadcrumb, prodotti: /de/...). La usano la build (pagine statiche) e il server
  (pagina prodotto). Le entita' uguali in tutte le lingue (Nutrex Lab come negozio, il sito, la politica di
  reso) tengono il loro indirizzo: cambia solo il testo.
*/

const SHARED = new Set([IDS.org, IDS.site, IDS.returns])
const TEXT_KEYS = new Set(['name', 'description', 'text', 'caption', 'value'])
const URL_KEYS = new Set(['url', 'item', '@id'])

/** Indirizzo assoluto del sito nella lingua (anche con #frammento); gli altri indirizzi restano com'erano. */
export function localUrl(url, lang) {
  if (typeof url !== 'string' || !url.startsWith(ORIGIN)) return url
  const rest = url.slice(ORIGIN.length) || '/'
  const hash = rest.indexOf('#')
  const path = hash < 0 ? rest : rest.slice(0, hash)
  if (!isPagePath(path || '/')) return url
  return `${ORIGIN}${withLang(path || '/', lang)}${hash < 0 ? '' : rest.slice(hash)}`
}

/** Dati strutturati (JSON-LD) nella lingua: testi tradotti, indirizzi della lingua, inLanguage. */
export function localizeGraph(data, lang, t) {
  if (lang === DEFAULT_LANG || !data) return data
  const walk = (v, key, shared) => {
    if (typeof v === 'string') {
      if (key === 'inLanguage') return LANG_INFO[lang].locale
      if (key === 'category') return v.split(' > ').map((part) => t(part)).join(' > ')
      if (TEXT_KEYS.has(key)) return t(v)
      if (URL_KEYS.has(key) && !shared) return localUrl(v, lang)
      return v
    }
    if (Array.isArray(v)) return key === 'inLanguage' ? v : v.map((x) => walk(x, key, shared))
    if (v && typeof v === 'object') {
      const isShared = shared || SHARED.has(v['@id'])
      const out = {}
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k, isShared)
      return out
    }
    return v
  }
  return walk(data, '', false)
}

/**
 * Pagina (dati per headTags di src/seo/head.js) nella lingua di tr (translator() di src/i18n/static.js):
 * titoli, descrizione e dati strutturati tradotti; i18n = posizione dei testi italiani nel dizionario
 * (il browser ritrova cosi' titolo e descrizione italiani per cambiare lingua senza ricaricare).
 */
export function localizePage(page, tr) {
  const { lang, t } = tr
  if (lang === DEFAULT_LANG) return { ...page, lang }
  const img = page.image === undefined ? SOCIAL_IMAGE : page.image // come headTags: senza foto propria, quella del sito
  const image = img && img.alt ? { ...img, alt: t(img.alt) } : img
  return {
    ...page,
    lang,
    title: t(page.title),
    socialTitle: page.socialTitle ? t(page.socialTitle) : page.socialTitle,
    description: page.description ? t(page.description) : page.description,
    image,
    jsonld: localizeGraph(page.jsonld, lang, t),
    i18n: { title: tr.index(page.title), description: page.description ? tr.index(page.description) : null },
  }
}
