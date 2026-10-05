/*
  Pagina prodotto (/prodotto/<slug>) preparata sul server per motori di ricerca e anteprime social:
  titolo e descrizione dinamici, canonical, Open Graph, Twitter, dati strutturati Product (prezzo,
  disponibilita', immagini, SKU) e i dati del prodotto gia' nella pagina (niente attesa al primo disegno).
  Tutto arriva da WooCommerce. Il modello e' prodotto.html (lo stesso stile delle altre pagine).
*/

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** JSON dentro <script>: niente chiusure di tag ne' caratteri che rompono l'HTML. */
const safeJson = (data) =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')

const money = (minor, cur) => (minor ?? 0) / 10 ** (cur?.minorUnit ?? 2)

function availability(stock) {
  if (stock.backorder) return 'https://schema.org/BackOrder'
  return stock.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

function jsonLd(product, url) {
  const cur = product.prices.currency
  const variations = product.variations ?? []
  const base = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.summary || undefined,
    image: product.images.map((i) => i.src),
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: 'Nutrex Lab' },
    category: product.categories[0]?.name,
    url,
  }
  if (variations.length) {
    const prices = variations.map((v) => v.prices.price).filter((p) => p != null)
    base.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: cur.code,
      lowPrice: money(Math.min(...prices), cur).toFixed(cur.minorUnit),
      highPrice: money(Math.max(...prices), cur).toFixed(cur.minorUnit),
      offerCount: variations.length,
      availability: availability({ inStock: variations.some((v) => v.stock.inStock), backorder: variations.some((v) => v.stock.backorder) }),
      offers: variations.map((v) => ({
        '@type': 'Offer',
        sku: v.sku || undefined,
        price: money(v.prices.price, cur).toFixed(cur.minorUnit),
        priceCurrency: cur.code,
        availability: availability(v.stock),
        itemCondition: 'https://schema.org/NewCondition',
        url,
      })),
    }
  } else {
    base.offers = {
      '@type': 'Offer',
      price: money(product.prices.price, cur).toFixed(cur.minorUnit),
      priceCurrency: cur.code,
      availability: availability(product.stock),
      itemCondition: 'https://schema.org/NewCondition',
      url,
    }
  }
  return base
}

/** Blocco di testo per chi legge la pagina senza JavaScript (motori di ricerca); il negozio lo sostituisce. */
function seoBlock(product) {
  const cur = product.prices.currency
  const price = money(product.prices.price, cur).toFixed(cur.minorUnit).replace('.', cur.decimalSep || ',')
  const img = product.images[0]
  return (
    `<article class="pseo">` +
    (img ? `<img src="${esc(img.src)}" alt="${esc(img.alt || product.name)}" width="800" height="1000" />` : '') +
    `<h1>${esc(product.name)}</h1>` +
    `<p>${esc(cur.prefix || '')}${esc(price)}${esc(cur.suffix || '')}</p>` +
    (product.shortDescription || '') +
    (product.description || '') +
    `</article>`
  )
}

/**
 * template: HTML di prodotto.html. product: dal catalogo (null = non trovato o negozio non raggiungibile).
 * status: 200, 404 o 503.
 */
export function renderProductPage(template, { product, site, slug, status = 200 }) {
  const url = `${site}/prodotto/${encodeURIComponent(slug)}`
  let head = ''
  let title = 'Prodotto | Nutrex Lab'
  let body = ''
  if (product) {
    const description = (product.summary || `${product.name}, integratore Nutrex Lab prodotto in Italia.`).slice(0, 160)
    const img = product.images[0]?.src
    const cur = product.prices.currency
    title = `${product.name} | Nutrex Lab`
    head = [
      `<meta name="description" content="${esc(description)}" />`,
      `<link rel="canonical" href="${esc(url)}" />`,
      `<meta property="og:type" content="product" />`,
      `<meta property="og:locale" content="it_IT" />`,
      `<meta property="og:site_name" content="Nutrex Lab" />`,
      `<meta property="og:title" content="${esc(title)}" />`,
      `<meta property="og:description" content="${esc(description)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      img ? `<meta property="og:image" content="${esc(img)}" />` : '',
      `<meta property="product:price:amount" content="${money(product.prices.price, cur).toFixed(cur.minorUnit)}" />`,
      `<meta property="product:price:currency" content="${esc(cur.code)}" />`,
      `<meta property="product:availability" content="${product.stock.inStock ? 'in stock' : 'out of stock'}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(title)}" />`,
      `<meta name="twitter:description" content="${esc(description)}" />`,
      img ? `<meta name="twitter:image" content="${esc(img)}" />` : '',
      `<script type="application/ld+json">${safeJson(jsonLd(product, url))}</script>`,
    ]
      .filter(Boolean)
      .join('\n    ')
    body = seoBlock(product)
  } else {
    title = status === 404 ? 'Prodotto non trovato | Nutrex Lab' : 'Nutrex Lab'
    head = `<meta name="robots" content="noindex" />`
  }
  const data = `<script id="product-data" type="application/json">${safeJson({ slug, status, product })}</script>`
  // sostituzioni con funzione: i testi di WooCommerce possono contenere "$&", "$'"... che replace interpreterebbe
  return template
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace('</head>', () => `    ${head}\n    ${data}\n  </head>`)
    .replace(/<!--\s*ssr:prodotto\s*-->/, () => body)
}
