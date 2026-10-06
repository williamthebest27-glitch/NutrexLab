import { BRAND, SOCIAL_IMAGE, absolute } from './catalog.js'
import { esc } from './render.js'
import { safeJson } from './schema.js'

/*
  <head> di una pagina: titolo, descrizione, canonical, robots, Open Graph, Twitter/X e dati
  strutturati. La usano la build (pagine statiche, vite.config.js) e il server (pagina prodotto).
  Indirizzi sempre assoluti e sul dominio canonico (https://www.nutrexlab.it).
*/

/**
 * page: { title, description, path, image?: { src, width, height, alt }, type?: 'website' | 'product',
 *         robots?: 'noindex' ..., jsonld?: oggetto, extra?: [righe HTML] }
 */
export function headTags(page) {
  const { title, description, path, type = 'website', robots, jsonld, extra = [] } = page
  const image = page.image === undefined ? SOCIAL_IMAGE : page.image
  const noindex = /noindex/.test(robots ?? '')
  const url = absolute(path ?? '/')
  const lines = [
    `<title>${esc(title)}</title>`,
    description ? `<meta name="description" content="${esc(description)}" />` : '',
    robots ? `<meta name="robots" content="${esc(robots)}" />` : '',
  ]
  // le pagine noindex (carrello, pagamento, errori) non hanno canonical ne' anteprima social
  if (!noindex) {
    lines.push(
      `<link rel="canonical" href="${esc(url)}" />`,
      `<meta property="og:type" content="${esc(type)}" />`,
      `<meta property="og:locale" content="it_IT" />`,
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
