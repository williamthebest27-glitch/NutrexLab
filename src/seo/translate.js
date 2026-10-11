import { DEFAULT_LANG } from '../i18n/langs.js'
import { dictionary, translator, translateHtml } from '../i18n/static.js'
import { PAGES } from './pages.js'
import { headTags } from './head.js'
import { localizePage } from './localize.js'

/*
  Pagine statiche nelle altre lingue (vite.config.js: build e server di sviluppo). Si parte dalla pagina
  italiana gia' pronta (parti comuni, griglie e SEO inserite): testi tradotti, link della stessa lingua e
  <head> della lingua (titolo, descrizione, canonical, hreflang, Open Graph, dati strutturati di
  src/seo/pages.js tradotti). Il <head> della SEO e' tra <!--nx:seo:chiave--> e <!--/nx:seo--> (plugin
  "seo" di vite.config.js): nella pagina finale i due segni non restano.
*/

const SEO_BLOCK = /<!--nx:seo:([a-z0-9-]+)-->([\s\S]*?)<!--\/nx:seo-->/

/** Pagina italiana finale: solo i segni del blocco SEO tolti. */
export const finishItalian = (html) => html.replace(SEO_BLOCK, (m, key, tags) => tags)

/**
 * Pagina tradotta in lang. Ritorna { html, missing }: missing = testi italiani senza traduzione (restano in
 * italiano; npm test controlla che non ce ne siano).
 */
export async function translatePage(html, lang) {
  if (lang === DEFAULT_LANG) return { html: finishItalian(html), missing: [] }
  const tr = translator(await dictionary(lang))
  let out = translateHtml(html, tr)
  out = out.replace(SEO_BLOCK, (m, key) => {
    if (!PAGES[key]) throw new Error(`SEO: nessuna pagina "${key}" in src/seo/pages.js`)
    return headTags(localizePage(PAGES[key], tr))
  })
  return { html: out, missing: [...tr.missing] }
}
