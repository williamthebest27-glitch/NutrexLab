import { ORIGIN, BRAND, SHOP, QUALITY, productBySlug, categoryFor, productTrail, siblings, productPath, categoryPath, qualityFor, productAlt } from '../src/seo/catalog.js'
import { headTags } from '../src/seo/head.js'
import { localizeGraph } from '../src/seo/localize.js'
import { crumbsHtml, faqHtml, esc } from '../src/seo/render.js'
import { graph, webPage, breadcrumbs, faqPage, returnPolicy, IDS, safeJson } from '../src/seo/schema.js'
import { DEFAULT_LANG, isLang, withLang } from '../src/i18n/langs.js'
import { dictionary, translator, translateHtml } from '../src/i18n/static.js'

/*
  Pagina prodotto (/prodotto/<slug>) preparata sul server per motori di ricerca e anteprime social:
  titolo e descrizione (curati in src/seo/catalog.js, altrimenti dal nome e dalla descrizione breve),
  canonical sul dominio principale, Open Graph, Twitter, dati strutturati (Product con prezzo,
  disponibilita', SKU, immagini, politica di reso e voto medio solo se ci sono recensioni vere;
  BreadcrumbList; FAQPage) e un primo contenuto della pagina per chi non esegue JavaScript (breadcrumb,
  nome, prezzo, descrizioni, caratteristiche, benefici, qualita' e garanzie, domande frequenti, prodotti
  della stessa linea).
  Tutti i dati commerciali arrivano da WooCommerce. Il modello e' prodotto.html.
  Nelle altre lingue (/de/prodotto/<slug>...) il modello e' quello tradotto (dist/<lingua>/prodotto.html) e
  testi, titolo, descrizione e dati strutturati sono nella lingua (dizionari di src/i18n/locales: i testi di
  WooCommerce senza traduzione restano in italiano), con canonical e hreflang della pagina della lingua.
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

function productSchema(product, url, t = (x) => x) {
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
    category: cat ? `${t('Integratori alimentari')} > ${t(cat.name)}` : t('Integratori alimentari'),
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

/** Prezzo da mostrare: come lo scrive WooCommerce in italiano, nel formato della lingua nelle altre. */
function priceText(product, tr) {
  const cur = product.prices.currency
  const low = lowestPrice(product)
  if (low === null) return tr.t('Prezzo in arrivo')
  const value = money(low, cur)
  const amount =
    tr.lang === DEFAULT_LANG
      ? `${cur.prefix || ''}${value.toFixed(cur.minorUnit).replace('.', cur.decimalSep || ',')}${cur.suffix || ''}`
      : new Intl.NumberFormat(tr.locale, { style: 'currency', currency: cur.code || 'EUR', minimumFractionDigits: cur.minorUnit, maximumFractionDigits: cur.minorUnit }).format(value)
  return product.variations?.length && product.prices.range ? tr.t('da {prezzo}', { prezzo: amount }) : amount
}

/** Voto medio scritto nella lingua: "Voto medio 4,5 su 5 (3 recensioni)". */
function ratingText(product, tr) {
  const voto = new Intl.NumberFormat(tr.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(product.rating.average)
  return tr.tp(product.rating.count, 'Voto medio {voto} su 5 ({n} recensione)', 'Voto medio {voto} su 5 ({n} recensioni)', { voto })
}

/**
 * Prodotto di WooCommerce nella lingua (come localizeProduct di src/i18n/data.js nel browser): nome,
 * descrizioni, caratteristiche (non quelle delle varianti), categorie e testi delle foto.
 */
function localizeProduct(p, tr) {
  if (tr.lang === DEFAULT_LANG) return p
  const { t } = tr
  const name = t(p.name)
  const seo = productBySlug(p.slug)
  const alt = (img, i) => {
    if (!img) return img
    if (img.alt !== productAlt(p.name, p.slug, i)) return { ...img, alt: t(img.alt) }
    const generated = i > 0 ? t('{nome} Nutrex Lab, foto {n}', { nome: name, n: i + 1 }) : seo ? `${name} Nutrex Lab, ${t(seo.pack)}` : `${name} Nutrex Lab`
    return { ...img, alt: generated }
  }
  const short = p.shortDescription ? t(p.shortDescription) : p.shortDescription
  return {
    ...p,
    name,
    shortDescription: short,
    description: p.description ? t(p.description) : p.description,
    summary: short && short !== p.shortDescription ? short.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : t(p.summary),
    attributes: (p.attributes ?? []).map((a) => (a.variation ? a : { ...a, name: t(a.name), values: a.values.map((v) => t(v)) })),
    categories: (p.categories ?? []).map((c) => ({ ...c, name: t(c.name) })),
    images: (p.images ?? []).map(alt),
  }
}

/**
 * Primo contenuto della pagina (per chi legge senza JavaScript: motori di ricerca, assistenti AI,
 * anteprime): lo sostituisce la pagina interattiva (src/pages/prodotto.js), con gli stessi testi.
 * Si scrive in italiano con i testi segnati (data-i18n) e si traduce poi come le pagine statiche
 * (translateHtml): nelle altre lingue testi e link sono della lingua. Prezzo e voto sono gia' nella lingua.
 */
function seoBlock(product, trail, tr) {
  const img = tr.lang === DEFAULT_LANG ? product.images[0] : localizeProduct(product, tr).images[0]
  const seo = productBySlug(product.slug)
  const cat = categoryFor(product.slug, product.categories)
  const specs = product.attributes.filter((a) => !a.variation && a.values.length)
  const rows = specs
    .map((a) => `<tr><th scope="row" data-i18n>${esc(a.name)}</th><td>${a.values.map((v) => `<span data-i18n>${esc(v)}</span>`).join(', ')}</td></tr>`)
    .join('')
  const quality = qualityFor(product.slug)
  const benefits = seo?.benefits ?? []
  const more = siblings(product.slug, 4, product.categories)
  const pair = (name, text) => `<li><span data-i18n>${esc(name)}</span>: <span data-i18n>${esc(text)}</span></li>`
  const all =
    tr.lang === DEFAULT_LANG
      ? esc(cat ? `Tutti gli integratori: ${cat.name.toLowerCase()}` : 'Tutti gli integratori Nutrex Lab')
      : esc(cat ? `${tr.t('Tutti gli integratori')}: ${tr.t(cat.name)}` : tr.t('Tutti gli integratori Nutrex Lab'))
  const html =
    `<article class="pseo">` +
    crumbsHtml(trail) +
    (img ? `<img src="${esc(img.src)}" alt="${esc(img.alt || product.name)}" width="800" height="1000" fetchpriority="high" />` : '') +
    `<h1 data-i18n>${esc(product.name)}</h1>` +
    `<p>${esc(priceText(product, tr))}</p>` +
    (rated(product) ? `<p>${esc(ratingText(product, tr))}</p>` : '') +
    (product.shortDescription ? `<div data-i18n>${product.shortDescription}</div>` : '') +
    (product.description ? `<h2 data-i18n>Descrizione</h2><div data-i18n>${product.description}</div>` : '') +
    (rows ? `<h2 data-i18n>Caratteristiche</h2><table><tbody>${rows}</tbody></table>` : '') +
    (benefits.length ? `<h2 data-i18n>Benefici</h2><ul>${benefits.map(([, name, text]) => pair(name, text)).join('')}</ul>` : '') +
    (quality.length ? `<h2 data-i18n>Qualità e garanzie</h2><ul>${quality.map((k) => pair(QUALITY[k].name, QUALITY[k].note)).join('')}</ul>` : '') +
    (seo?.faq?.length ? faqHtml(seo.faq, { id: 'domande', title: 'Domande frequenti' }) : '') +
    (more.length
      ? `<nav aria-label="Della stessa linea" data-i18n-attr="aria-label"><h2 data-i18n>Della stessa linea</h2><ul>${more
          .map((p) => `<li><a href="${productPath(p.slug)}" data-i18n>${esc(p.name)}</a></li>`)
          .join('')}</ul></nav>` 
      : '') +
    `<p><a href="${cat ? categoryPath(cat.slug) : SHOP.path}">${all}</a></p>` +
    `</article>`
  return translateHtml(html, tr)
}

/**
 * template: HTML di prodotto.html (nella lingua: dist/<lingua>/prodotto.html). product: dal catalogo (null =
 * non trovato o negozio non raggiungibile). status: 200, 404 o 503. lang: lingua della pagina ('it', 'de'...).
 * Canonical e indirizzi sempre sul dominio principale (ORIGIN), nella lingua della pagina.
 */
export async function renderProductPage(template, { product, slug, status = 200, lang = DEFAULT_LANG }) {
  const tr = translator(await dictionary(isLang(lang) ? lang : DEFAULT_LANG))
  const { t } = tr
  const path = productPath(slug)
  const url = `${ORIGIN}${withLang(path, tr.lang)}`
  const local = (data) => localizeGraph(data, tr.lang, (x) => x) // testi gia' tradotti: solo indirizzi e lingua
  let head = ''
  let body = ''
  if (product) {
    const seo = productBySlug(product.slug)
    const shown = localizeProduct(product, tr)
    const title = seo?.title ? t(seo.title) : `${shown.name} | ${BRAND}`
    const description = seo?.description
      ? t(seo.description)
      : clip(shown.summary || t('{nome}, integratore alimentare Nutrex Lab prodotto in Italia.', { nome: shown.name }))
    const img = shown.images[0]
    const cur = product.prices.currency
    const low = lowestPrice(product)
    const trail = productTrail(product.slug, product.name, product.categories)
    const localTrail = trail.map(([name, p], i) => [i === trail.length - 1 ? shown.name : t(name), p])
    let imageOrigin = null
    try {
      imageOrigin = img ? new URL(img.src).origin : null
    } catch {
      // indirizzo della foto non assoluto: niente preconnect
    }
    head = headTags({
      title,
      socialTitle: `${shown.name} | ${BRAND}`,
      description,
      path,
      lang: tr.lang,
      type: 'product',
      image: img ? { src: img.src, width: 800, height: 1000, alt: img.alt || shown.name } : null,
      i18n: seo?.title ? { title: tr.index(seo.title), description: seo.description ? tr.index(seo.description) : null } : undefined,
      extra: [
        // le foto arrivano dal WooCommerce: connessione aperta subito (immagine principale = LCP)
        imageOrigin && imageOrigin !== ORIGIN ? `<link rel="preconnect" href="${esc(imageOrigin)}" />` : '',
        low !== null ? `<meta property="product:price:amount" content="${money(low, cur).toFixed(cur.minorUnit)}" />` : '',
        low !== null ? `<meta property="product:price:currency" content="${esc(cur.code)}" />` : '',
        low !== null ? `<meta property="product:availability" content="${product.stock.inStock ? 'in stock' : 'out of stock'}" />` : '',
        `<meta property="product:brand" content="${esc(BRAND)}" />`,
      ],
      jsonld: graph(
        local(webPage({ path, name: title, description, type: 'ItemPage', breadcrumb: true, image: img?.src })),
        local(breadcrumbs(localTrail, path)),
        productSchema(shown, url, t),
        seo?.faq?.length ? local(faqPage(seo.faq.map(([q, a]) => [t(q), t(a)]), path)) : null,
      ),
    })
    body = seoBlock(product, trail, tr)
  } else {
    head = headTags({
      title: status === 404 ? t('Prodotto non trovato | Nutrex Lab') : BRAND,
      description: '',
      path,
      lang: tr.lang,
      robots: 'noindex',
    })
  }
  const data = `<script id="product-data" type="application/json">${safeJson({ slug, status, product })}</script>`
  // sostituzioni con funzione: i testi di WooCommerce possono contenere "$&", "$'"... che replace interpreterebbe
  return template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/, () => '')
    .replace('</head>', () => `    ${head}\n    ${data}\n  </head>`)
    .replace(/<!--\s*ssr:prodotto\s*-->/, () => body)
}
