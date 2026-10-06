import { route } from '../server/http.js'
import { listProducts } from '../server/catalog.js'
import { ORIGIN, CATEGORIES, PRODUCTS, SHOP, categoryPath, productPath, productImage } from '../src/seo/catalog.js'

/*
  GET /sitemap.xml  (riscritto qui da vercel.json): solo indirizzi canonici e indicizzabili, sempre sul
  dominio principale (anche se la richiesta arriva da un'anteprima di Vercel). Pagine del sito, categorie e
  prodotti pubblicati in WooCommerce (non quelli nascosti dal catalogo), con le loro foto (sitemap
  immagini di Google). Carrello, pagamento, ordine e account non ci sono: sono noindex o reindirizzano.
  Se WooCommerce non risponde restano i 12 prodotti della linea (src/seo/catalog.js), in cache per poco.
*/

const PAGES = [
  '/',
  SHOP.path,
  ...CATEGORIES.map((c) => categoryPath(c.slug)),
  '/chi-siamo',
  '/contatti',
  '/spedizioni-e-resi',
  '/termini-e-condizioni',
  '/note-legali',
  '/privacy-policy',
  '/cookie-policy',
]

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

async function shopProducts() {
  const out = []
  for (let page = 1; page <= 20; page++) {
    const res = await listProducts({ page, perPage: 100 })
    out.push(...res.products.map((p) => ({ slug: p.slug, images: p.images.map((i) => i.src) })))
    if (page >= res.totalPages) break
  }
  return out
}

function entry(path, images = []) {
  const imgs = [...new Set(images.filter(Boolean))]
    .map((src) => `\n    <image:image><image:loc>${esc(/^https?:/i.test(src) ? src : `${ORIGIN}${src}`)}</image:loc></image:image>`)
    .join('')
  return `  <url>\n    <loc>${esc(`${ORIGIN}${path}`)}</loc>${imgs}\n  </url>`
}

export const GET = route('sitemap', async (request) => {
  let products
  let fallback = false
  try {
    products = await shopProducts()
  } catch (err) {
    console.error('[negozio:sitemap] WooCommerce non raggiungibile, uso i prodotti della linea', err?.message)
    products = PRODUCTS.map((p) => ({ slug: p.slug, images: [productImage(p.slug)] }))
    fallback = true
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    [...PAGES.map((p) => entry(p)), ...products.map((p) => entry(productPath(p.slug), p.images))].join('\n') +
    '\n</urlset>\n'
  return new Response(request.method === 'HEAD' ? null : xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': fallback
        ? 'public, max-age=0, s-maxage=300'
        : 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
})

export const HEAD = GET
