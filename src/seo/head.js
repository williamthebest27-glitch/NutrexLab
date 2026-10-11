import { BRAND, SOCIAL_IMAGE, absolute } from './catalog.js'
import { esc } from './render.js'
import { safeJson } from './schema.js'
import { DEFAULT_LANG, FALLBACK_LANG, LANGS, ogLocale, withLang } from '../i18n/langs.js'

/*
  <head> di una pagina: titolo, descrizione, canonical, versioni nelle altre lingue (hreflang), robots,
  Open Graph, Twitter/X e dati strutturati. La usano la build (pagine statiche, vite.config.js) e il server
  (pagina prodotto). Indirizzi sempre assoluti e sul dominio canonico (https://www.nutrexlab.it).
  Ogni lingua ha il suo indirizzo (src/i18n/langs.js): canonical sulla pagina della sua lingua, hreflang
  verso tutte le lingue (anche se stessa) e x-default verso l'inglese, per chi cerca in un'altra lingua.
*/

/**
 * page: { title, description, path (italiano, senza prefisso), lang?: 'it' | 'en' ..., image?: { src, width,
 *         height, alt }, type?: 'website' | 'product', robots?: 'noindex' ..., jsonld?: oggetto,
 *         extra?: [righe HTML], i18n?: { title, description } (posizione dei testi nel dizionario) }
 *         Nelle altre lingue titolo, descrizione e dati arrivano gia' tradotti (localizePage di src/seo/localize.js).
 */
export function headTags(page) {
  const { title, description, path = '/', type = 'website', robots, jsonld, extra = [], lang = DEFAULT_LANG, i18n } = page
  const image = page.image === undefined ? SOCIAL_IMAGE : page.image
  const noindex = /noindex/.test(robots ?? '')
  const url = absolute(withLang(path, lang))
  const mark = (n) => (n != null ? ` data-i18n="${n}"` : '')
  const lines = [
    `<title${mark(i18n?.title)}>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}"${mark(i18n?.description)} />` : '',
    robots ? `<meta name="robots" content="${esc(robots)}" />` : '',
  ]
  // le pagine noindex (carrello, pagamento, errori) non hanno canonical, versioni nelle lingue ne' anteprima social
  if (!noindex) {
    lines.push(
      `<link rel="canonical" href="${esc(url)}" />`,
      ...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(absolute(withLang(path, l)))}" />`),
      `<link rel="alternate" hreflang="x-default" href="${esc(absolute(withLang(path, FALLBACK_LANG)))}" />`,
      `<meta property="og:type" content="${esc(type)}" />`,
      `<meta property="og:locale" content="${ogLocale(lang)}" />`,
      ...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${ogLocale(l)}" />`),
      `<meta property="og:site_name" content="${esc(BRAND)}" />`,
      `<meta property="og:title" content="${esc(page.socialTitle ?? title)}" />`,
      description ? `<meta property="og:description" content="${esc(description)}" />` : '',
      `<meta property="og:url" content="${esc(url)}" />`,
    )
    if (image?.src) {
      lines.push(
        `<meta property="og:image" content="${esc(absolute(image.src))}" />`,
        image.width ? `<meta property="og:image:width" content="${image.width}" />` : '',
        image.height ? `<meta property="og:image:height" content="${image.height}" />` : '',
        image.alt ? `<meta property="og:image:alt" content="${esc(image.alt)}" />` : '',
      )
    }
    lines.push(
      `<meta name="twitter:card" content="${image?.src ? 'summary_large_image' : 'summary'}" />`,
      `<meta name="twitter:title" content="${esc(page.socialTitle ?? title)}" />`,
      description ? `<meta name="twitter:description" content="${esc(description)}" />` : '',
      image?.src ? `<meta name="twitter:image" content="${esc(absolute(image.src))}" />` : '',
      image?.alt ? `<meta name="twitter:image:alt" content="${esc(image.alt)}" />` : '',
    )
  }
  lines.push(...extra)
  if (jsonld) lines.push(`<script type="application/ld+json">${safeJson(jsonld)}</script>`)
  return lines.filter(Boolean).join('\n    ')
}
