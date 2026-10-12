import { route } from '../server/http.js'
import { listProducts } from '../server/catalog.js'
import { ORIGIN, BRAND, absolute, categoryFor, productBySlug, productPath } from '../src/seo/catalog.js'

/*
  GET /feed/google.xml  (riscritto qui da vercel.json): feed dei prodotti per Google Merchant Center
  (schede gratuite di Google Shopping: i prodotti compaiono nella scheda Shopping e nei riquadri
  prodotto delle ricerche come "collagene marino" o "vitamina d3 k2"). In Merchant Center si aggiunge
  come "feed programmato" con questo indirizzo; la spedizione si imposta li' (si calcola al pagamento).
  Solo prodotti pubblicati in WooCommerce, in vendita (con prezzo) e semplici: le varianti andrebbero
  inviate una per una. Titoli e descrizioni sono quelli SEO di src/seo/catalog.js, con il marchio davanti;
  prezzi, scorte, SKU e foto arrivano da WooCommerce. Niente GTIN (WooCommerce non li ha): marchio + MPN (SKU).
*/

// Google: "Salute e bellezza > Salute > Fitness e alimentazione > Vitamine e integratori"
const GOOGLE_CATEGORY = 525

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const tag = (name, value) => (value === undefined || value === null || value === '' ? '' : `\n      <g:${name}>${esc(value)}</g:${name}>`)
const amount = (minor, cur) => `${((minor ?? 0) / 10 ** (cur?.minorUnit ?? 2)).toFixed(cur?.minorUnit ?? 2)} ${cur?.code || 'EUR'}`

function availability(stock) {
  if (stock.backorder) return 'backorder'
  return stock.inStock ? 'in_stock' : 'out_of_stock'
}

async function shopProducts() {
  const out = []
  for (let page = 1; page <= 20; page++) {
    const res = await listProducts({ page, perPage: 100 })
    out.push(...res.products)
    if (page >= res.totalPages) break
  }
  return out
}

function item(p) {
  const seo = productBySlug(p.slug)
  const cat = categoryFor(p.slug, p.categories)
  const cur = p.prices.currency
  // "Vitamina D3 + K2 MK-7 2000 UI, 365 Compresse | Nutrex Lab" -> "Nutrex Lab Vitamina D3 + K2 MK-7 2000 UI, 365 Compresse"
  const name = seo?.title ? seo.title.replace(/\s*\|\s*Nutrex Lab$/i, '') : p.name
  const discounted = p.prices.regular > p.prices.price
  return (
    '\n    <item>' +
    tag('id', p.sku || p.id) +
    tag('title', `${BRAND} ${name}`.slice(0, 150)) +
    tag('description', seo?.description || p.summary) +
    tag('link', absolute(productPath(p.slug))) +
    tag('image_link', p.images[0]?.src) +
    p.images.slice(1, 11).map((i) => tag('additional_image_link', i.src)).join('') +
    tag('availability', availability(p.stock)) +
    tag('price', amount(discounted ? p.prices.regular : p.prices.price, cur)) +
    (discounted ? tag('sale_price', amount(p.prices.price, cur)) : '') +
    tag('brand', BRAND) +
    (p.sku ? tag('mpn', p.sku) : tag('identifier_exists', 'no')) +
    tag('condition', 'new') +
    tag('google_product_category', GOOGLE_CATEGORY) +
    tag('product_type', cat ? `Integratori alimentari > ${cat.name}` : 'Integratori alimentari') +
    '\n    </item>'
  )
}

export const GET = route('merchant-feed', async (request) => {
  const products = (await shopProducts()).filter((p) => p.type === 'simple' && (p.prices.price ?? 0) > 0)
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>' +
    `\n    <title>${esc(BRAND)}</title>\n    <link>${esc(`${ORIGIN}/`)}</link>\n    <description>${esc('Integratori alimentari Nutrex Lab prodotti in Italia')}</description>` +
    products.map(item).join('') +
    '\n  </channel>\n</rss>\n'
  return new Response(request.method === 'HEAD' ? null : xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  })
})

export const HEAD = GET
