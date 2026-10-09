import { ORIGIN, BRAND, SHOP, QUALITY, productBySlug, categoryFor, productTrail, siblings, productPath, categoryPath, qualityFor } from '../src/seo/catalog.js'
import { headTags } from '../src/seo/head.js'
import { crumbsHtml, faqHtml, esc } from '../src/seo/render.js'
import { graph, webPage, breadcrumbs, faqPage, returnPolicy, IDS, safeJson } from '../src/seo/schema.js'

/*
  Pagina prodotto (/prodotto/<slug>) preparata sul server per motori di ricerca e anteprime social:
  titolo e descrizione (curati in src/seo/catalog.js, altrimenti dal nome e dalla descrizione breve),
  canonical sul dominio principale, Open Graph, Twitter, dati strutturati (Product con prezzo,
  disponibilita', SKU, immagini, politica di reso e voto medio solo se ci sono recensioni vere;
  BreadcrumbList; FAQPage) e un primo contenuto della pagina per chi non esegue JavaScript (breadcrumb,
  nome, prezzo, descrizioni, caratteristiche, benefici, qualita' e garanzie, domande frequenti, prodotti
  della stessa linea).
  Tutti i dati commerciali arrivano da WooCommerce. Il modello e' prodotto.html.
*/

const money = (minor, cur) => (minor ?? 0) / 10 ** (cur?.minorUnit ?? 2)

function availability(stock) {
  if (stock.backorder) return 'https://schema.org/BackOrder'
  return stock.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
}

/** Ha un prezzo (in WooCommerce un prodotto ancora senza prezzo vale 0 e non e' acquistabile). */
const priced = (item) => (item.prices.price ?? 0) > 0

/** Il prezzo piu' basso in vendita (minor units), null se il prodotto non ha ancora un prezzo. */
function lowestPrice(product) {
  const items = product.variations?.length ? product.variations : [product]
  const prices = items.filter(priced).map((i) => i.prices.price)
  return prices.length ? Math.min(...prices) : null
}

/** Testo tagliato a una parola intera (descrizioni di riserva). */
function clip(text, max = 158) {
  const t = String(text ?? '').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/\s+\S*$/, '')}…`
}

/** Voto medio di WooCommerce, solo se ci sono recensioni approvate (mai valori inventati). */
const rated = (product) => product.rating?.count > 0 && product.rating.average > 0

function productSchema(product, url) {
  const cur = product.prices.currency
  const cat = categoryFor(product.slug, product.categories)
  const variations = (product.variations ?? []).filter(priced)
  const seller = { '@type': 'OnlineStore', '@id': IDS.org, name: BRAND }
  const offer = (item) => ({
    '@type': 'Offer',
    url,
    sku: item.sku || undefined,
    price: money(item.prices.price, cur).toFixed(cur.minorUnit),
    priceCurrency: cur.code,
    availability: availability(item.stock),
    itemCondition: 'https://schema.org/NewCondition',
    seller,
    hasMerchantReturnPolicy: returnPolicy(),
  })
  const node = {
    '@type': 'Product',
    '@id': `${url}#prodotto`,
    name: product.name,
    description: product.summary || undefined,
    url,
    image: product.images.map((i) => i.src),
    sku: product.sku || undefined,
    brand: { '@type': 'Brand', name: BRAND },
    category: cat ? `Integratori alimentari > ${cat.name}` : 'Integratori alimentari',
    mainEntityOfPage: { '@id': `${url}#pagina` },
  }
  const props = product.attributes.filter((a) => !a.variation && a.values.length)
  if (props.length) node.additionalProperty = props.map((a) => ({ '@type': 'PropertyValue', name: a.name, value: a.values.join(', ') }))
  // senza prezzo niente offerta: Google non deve vedere un prodotto "a 0 euro"
  if (product.variations?.length) {
    if (variations.length) {
      const prices = variations.map((v) => v.prices.price)
      node.offers = {
        '@type': 'AggregateOffer',
        priceCurrency: cur.code,
        lowPrice: money(Math.min(...prices), cur).toFixed(cur.minorUnit),
        highPrice: money(Math.max(...prices), cur).toFixed(cur.minorUnit),
        offerCount: variations.length,
        availability: availability({ inStock: variations.some((v) => v.stock.inStock), backorder: variations.some((v) => v.stock.backorder) }),
        offers: variations.map(offer),
      }
    }
  } else if (priced(product)) {
    node.offers = offer(product)
  }
  if (rated(product)) {
    node.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.rating.average.toFixed(1),
      reviewCount: product.rating.count,
      bestRating: 5,
      worstRating: 1,
    }
  }
  return node
}

function priceText(product) {
  const cur = product.prices.currency
  const low = lowestPrice(product)
  if (low === null) return 'Prezzo in arrivo'
  const amount = `${cur.prefix || ''}${money(low, cur).toFixed(cur.minorUnit).replace('.', cur.decimalSep || ',')}${cur.suffix || ''}`
  return product.variations?.length && product.prices.range ? `da ${amount}` : amount
}

/**
 * Primo contenuto della pagina (per chi legge senza JavaScript: motori di ricerca, assistenti AI,
 * anteprime): lo sostituisce la pagina interattiva (src/pages/prodotto.js), con gli stessi testi.
 */
function seoBlock(product, trail) {
  const img = product.images[0]
  const seo = productBySlug(product.slug)
  const cat = categoryFor(product.slug, product.categories)
  const specs = product.attributes.filter((a) => !a.variation && a.values.length)
  const rows = specs.map((a) => `<tr><th scope="row">${esc(a.name)}</th><td>${esc(a.values.join(', '))}</td></tr>`).join('')
  const quality = qualityFor(product.slug)
  const benefits = seo?.benefits ?? []
  const more = siblings(product.slug, 4, product.categories)
  return (
    `<article class="pseo">` +
    crumbsHtml(trail) +
    (img ? `<img src="${esc(img.src)}" alt="${esc(img.alt || product.name)}" width="800" height="1000" fetchpriority="high" />` : '') +
    `<h1>${esc(product.name)}</h1>` +
    `<p>${esc(priceText(product))}</p>` +
    (rated(product)
      ? `<p>Voto medio ${product.rating.average.toFixed(1).replace('.', ',')} su 5 (${product.rating.count} ${product.rating.count === 1 ? 'recensione' : 'recensioni'})</p>`
      : '') +
    (product.shortDescription || '') +
    (product.description ? `<h2>Descrizione</h2>${product.description}` : '') +
    (rows ? `<h2>Caratteristiche</h2><table><tbody>${rows}</tbody></table>` : '') +
    (benefits.length ? `<h2>Benefici</h2><ul>${benefits.map(([, name, text]) => `<li>${esc(name)}: ${esc(text)}</li>`).join('')}</ul>` : '') +
    (quality.length ? `<h2>Qualità e garanzie</h2><ul>${quality.map((k) => `<li>${esc(QUALITY[k].name)}: ${esc(QUALITY[k].note)}</li>`).join('')}</ul>` : '') +
    (seo?.faq?.length ? faqHtml(seo.faq, { id: 'domande', title: 'Domande frequenti' }) : '') +
    (more.length
      ? `<nav aria-label="Della stessa linea"><h2>Della stessa linea</h2><ul>${more
          .map((p) => `<li><a href="${productPath(p.slug)}">${esc(p.name)}</a></li>`)
          .join('')}</ul></nav>`
      : '') +
    `<p><a href="${cat ? categoryPath(cat.slug) : SHOP.path}">${esc(cat ? `Tutti gli integratori: ${cat.name.toLowerCase()}` : 'Tutti gli integratori Nutrex Lab')}</a></p>` +
    `</article>`
  )
}

/**
 * template: HTML di prodotto.html. product: dal catalogo (null = non trovato o negozio non raggiungibile).
 * status: 200, 404 o 503. Canonical e indirizzi sempre sul dominio principale (ORIGIN).
 */
export function renderProductPage(template, { product, slug, status = 200 }) {
  const path = productPath(slug)
  const url = `${ORIGIN}${path}`
  let head = ''
  let body = ''
  if (product) {
    const seo = productBySlug(product.slug)
    const title = seo?.title ?? `${product.name} | ${BRAND}`
    const description = seo?.description ?? clip(product.summary || `${product.name}, integratore alimentare Nutrex Lab prodotto in Italia.`)
    const img = product.images[0]
    const cur = product.prices.currency
    const low = lowestPrice(product)
    const trail = productTrail(product.slug, product.name, product.categories)
    let imageOrigin = null
    try {
      imageOrigin = img ? new URL(img.src).origin : null
    } catch {
      // indirizzo della foto non assoluto: niente preconnect
    }
    head = headTags({
      title,
      socialTitle: `${product.name} | ${BRAND}`,
      description,
      path,
      type: 'product',
      image: img ? { src: img.src, width: 800, height: 1000, alt: img.alt || product.name } : null,
      extra: [
        // le foto arrivano dal WooCommerce: connessione aperta subito (immagine principale = LCP)
        imageOrigin && imageOrigin !== ORIGIN ? `<link rel="preconnect" href="${esc(imageOrigin)}" />` : '',
        low !== null ? `<meta property="product:price:amount" content="${money(low, cur).toFixed(cur.minorUnit)}" />` : '',
        low !== null ? `<meta property="product:price:currency" content="${esc(cur.code)}" />` : '',
        low !== null ? `<meta property="product:availability" content="${product.stock.inStock ? 'in stock' : 'out of stock'}" />` : '',
        `<meta property="product:brand" content="${esc(BRAND)}" />`,
      ],
      jsonld: graph(
        webPage({ path, name: title, description, type: 'ItemPage', breadcrumb: true, image: img?.src }),
        breadcrumbs(trail, path),
        productSchema(product, url),
        seo?.faq?.length ? faqPage(seo.faq, path) : null,
      ),
    })
    body = seoBlock(product, trail)
  } else {
    head = headTags({
      title: status === 404 ? `Prodotto non trovato | ${BRAND}` : BRAND,
      description: '',
      path,
      robots: 'noindex',
    })
  }
  const data = `<script id="product-data" type="application/json">${safeJson({ slug, status, product })}</script>`
  // sostituzioni con funzione: i testi di WooCommerce possono contenere "$&", "$'"... che replace interpreterebbe
  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/, () => '')
    .replace('</head>', () => `    ${head}\n    ${data}\n  </head>`)
    .replace(/<!--\s*ssr:prodotto\s*-->/, () => body)
}
