import { store } from './woo.js'
import { requireConfig } from './env.js'
import { ShopError } from './errors.js'

/*
  Catalogo dalla Store API di WooCommerce, trasformato nella forma usata dal negozio.
  Tutti i dati commerciali (nomi, prezzi, offerte, stock, SKU, immagini, categorie, attributi,
  variazioni) arrivano da WooCommerce: qui non c'e' nessun dato inventato o duplicato.
  I prezzi restano in centesimi (unita' minori) con le impostazioni di valuta del negozio.
*/

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', euro: '€', deg: '°', reg: '®', trade: '™', copy: '©' }

/** "Collagene &amp; vitamina C &#8211; 500 g" -> testo semplice */
export function decode(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

export const plain = (html) => decode(String(html ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

/*
  Descrizioni: HTML scritto dall'amministratore nel pannello. Si tengono solo i tag di testo e i
  link sicuri (niente script, iframe, stili, eventi): e' un controllo in piu', non un filtro completo.
*/
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'h5', 'blockquote', 'a', 'span', 'sup', 'sub', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'small'])
export function safeHtml(html) {
  return String(html ?? '')
    .replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (tag, name, attrs) => {
      const n = name.toLowerCase()
      if (!ALLOWED.has(n)) return ''
      if (tag.startsWith('</')) return `</${n}>`
      if (n === 'a') {
        const href = /\bhref\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs)
        const url = href ? (href[2] ?? href[3] ?? '').trim() : ''
        if (/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return `<a href="${url.replace(/"/g, '&quot;')}" rel="noopener">`
        return '<a>'
      }
      return `<${n}>`
    })
    .trim()
}

function currency(p) {
  return {
    code: p.currency_code,
    symbol: p.currency_symbol,
    minorUnit: p.currency_minor_unit,
    decimalSep: p.currency_decimal_separator,
    thousandSep: p.currency_thousand_separator,
    prefix: p.currency_prefix,
    suffix: p.currency_suffix,
  }
}

const int = (v) => (v === null || v === undefined || v === '' ? null : Number.parseInt(v, 10))

function prices(p) {
  const range = p.price_range ? { min: int(p.price_range.min_amount), max: int(p.price_range.max_amount) } : null
  return {
    currency: currency(p),
    price: int(p.price),
    regular: int(p.regular_price),
    sale: int(p.sale_price),
    range: range && range.min !== range.max ? range : null,
  }
}

function stock(p) {
  return {
    inStock: !!p.is_in_stock,
    purchasable: !!p.is_purchasable,
    backorder: !!p.is_on_backorder,
    low: p.low_stock_remaining ?? null,
    soldIndividually: !!p.sold_individually,
  }
}

const image = (img) => ({
  id: img.id,
  src: img.src,
  thumbnail: img.thumbnail,
  srcset: img.srcset,
  sizes: img.sizes,
  alt: decode(img.alt || img.name || ''),
})

/** Prodotto della Store API -> prodotto del negozio. */
export function normalizeProduct(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: decode(p.name),
    type: p.type,
    sku: p.sku || null,
    shortDescription: safeHtml(p.short_description),
    description: safeHtml(p.description),
    summary: plain(p.short_description) || plain(p.description).slice(0, 220),
    onSale: !!p.on_sale,
    rating: { average: Number.parseFloat(p.average_rating) || 0, count: Number.parseInt(p.review_count, 10) || 0 },
    reviewsAllowed: p.reviews_allowed !== false,
    prices: prices(p.prices),
    stock: stock(p),
    images: (p.images ?? []).map(image),
    categories: (p.categories ?? []).map((c) => ({ id: c.id, name: decode(c.name), slug: c.slug })),
    tags: (p.tags ?? []).map((t) => ({ id: t.id, name: decode(t.name), slug: t.slug })),
    attributes: (p.attributes ?? []).map((a) => ({
      name: decode(a.name),
      variation: !!a.has_variations,
      values: (a.terms ?? []).map((t) => decode(t.name)),
    })),
    variationIds: (p.variations ?? []).map((v) => ({
      id: v.id,
      attributes: Object.fromEntries((v.attributes ?? []).map((a) => [decode(a.name), decode(a.value)])),
    })),
    weight: p.weight || null,
    addToCart: { min: p.add_to_cart?.minimum ?? 1, max: p.add_to_cart?.maximum ?? 9999, step: p.add_to_cart?.multiple_of ?? 1 },
  }
}

/** Variazione (prodotto di tipo "variation" della Store API) -> variazione del negozio. */
function normalizeVariation(v, attributes) {
  return {
    id: v.id,
    sku: v.sku || null,
    attributes,
    onSale: !!v.on_sale,
    prices: prices(v.prices),
    stock: stock(v),
    images: (v.images ?? []).map(image),
    weight: v.weight || null,
    addToCart: { min: v.add_to_cart?.minimum ?? 1, max: v.add_to_cart?.maximum ?? 9999, step: v.add_to_cart?.multiple_of ?? 1 },
  }
}

// piccola cache in memoria (la funzione resta viva tra una richiesta e l'altra): meno chiamate a WooCommerce
const memo = new Map()
async function cached(key, ttlMs, load) {
  const hit = memo.get(key)
  if (hit && hit.until > Date.now()) return hit.value
  const value = await load()
  memo.set(key, { value, until: Date.now() + ttlMs })
  if (memo.size > 200) memo.delete(memo.keys().next().value)
  return value
}

/*
  WooCommerce condiviso con un altro marchio: il negozio vende solo i prodotti della categoria
  WOOCOMMERCE_CATEGORY e delle sue sottocategorie (obbligatoria: senza, il negozio resta chiuso).
*/
async function categoryTree() {
  return cached('category-tree', 5 * 60_000, async () => {
    // tutte le categorie del WooCommerce (la Store API le restituisce a pagine)
    const all = []
    for (let page = 1; page <= 20; page++) {
      const res = await store('/products/categories', { query: { per_page: 100, page, hide_empty: false } })
      all.push(...res.data)
      if (!res.totalPages || page >= res.totalPages) break
    }
    return all.map((c) => ({ id: c.id, parent: c.parent, slug: c.slug, name: decode(c.name), count: c.count }))
  })
}

/** { root, ids } della categoria del negozio (WOOCOMMERCE_CATEGORY) con tutte le sue sottocategorie. */
export async function shopScope() {
  const { category: slug } = requireConfig('wooUrl', 'category')
  const all = await categoryTree()
  const root = all.find((c) => c.slug === slug)
  if (!root) throw new ShopError(503, 'not_configured', 'Il negozio non è ancora attivo. Riprova più tardi.', { category: slug })
  const ids = new Set([root.id])
  // sottocategorie a qualunque profondita'
  let grew = true
  while (grew) {
    grew = false
    for (const c of all) {
      if (!ids.has(c.id) && ids.has(c.parent)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return { root, ids }
}

const inScope = (scope, categories) => categories.some((c) => scope.ids.has(c.id))

/** Il prodotto (o la variazione) e' in vendita in questo negozio? Altrimenti 404. */
export async function assertSellable(id) {
  const scope = await shopScope()
  let p = (await store(`/products/${Number.parseInt(id, 10)}`)).data
  if (p?.parent) p = (await store(`/products/${p.parent}`)).data
  if (!inScope(scope, p?.categories ?? [])) throw new ShopError(404, 'not_found', 'Prodotto non trovato.')
}

/** Elenco dei prodotti pubblicati (paginato, nell'ordine scelto nel pannello). */
export async function listProducts({ page = 1, perPage = 24, category, search } = {}) {
  const scope = await shopScope()
  let categoryId = scope.root.id
  if (category) {
    // un filtro fuori dalla categoria del negozio non mostra nulla
    const match = (await categoryTree()).find((c) => c.slug === category || String(c.id) === String(category))
    if (!match || !scope.ids.has(match.id)) return { products: [], total: 0, totalPages: 0, page }
    categoryId = match.id
  }
  const query = {
    page,
    per_page: Math.min(Math.max(perPage, 1), 100),
    orderby: 'menu_order',
    order: 'asc',
    // come il negozio WooCommerce: niente prodotti con "Visibilita' catalogo: nascosto" (restano raggiungibili dal loro link)
    catalog_visibility: 'catalog',
    category: String(categoryId),
    search,
  }
  return cached(`list:${JSON.stringify(query)}`, 30_000, async () => {
    const res = await store('/products', { query })
    return {
      // nell'elenco bastano i dati della scheda: niente descrizione lunga, solo quante variazioni ci sono
      products: res.data.map((raw) => {
        const p = normalizeProduct(raw)
        p.variationCount = p.variationIds.length
        delete p.variationIds
        delete p.description
        return p
      }),
      total: res.total,
      totalPages: res.totalPages,
      page,
    }
  })
}

/** Un prodotto dal suo slug, con tutte le variazioni (prezzo, SKU, stock, immagine). */
export function getProduct(slug) {
  if (!/^[a-z0-9][a-z0-9-]{0,190}$/i.test(String(slug ?? ''))) {
    return Promise.reject(new ShopError(404, 'not_found', 'Prodotto non trovato.'))
  }
  return cached(`product:${slug}`, 30_000, async () => {
    const res = await store('/products', { query: { slug, per_page: 1 } })
    const raw = res.data?.[0]
    if (!raw || !inScope(await shopScope(), raw.categories ?? [])) throw new ShopError(404, 'not_found', 'Prodotto non trovato.')
    const product = normalizeProduct(raw)
    product.variations = []
    if (product.type === 'variable' && product.variationIds.length) {
      const vr = await store('/products', { query: { type: 'variation', parent: product.id, per_page: 100 } })
      const byId = new Map(vr.data.map((v) => [v.id, v]))
      product.variations = product.variationIds
        .filter((v) => byId.has(v.id))
        .map((v) => normalizeVariation(byId.get(v.id), v.attributes))
    }
    delete product.variationIds
    return product
  })
}

/** Categorie del negozio con almeno un prodotto (per i filtri): le sottocategorie della categoria del negozio. */
export async function listCategories() {
  const [all, scope] = await Promise.all([categoryTree(), shopScope()])
  return all
    .filter((c) => c.count > 0 && scope.ids.has(c.id) && c.id !== scope.root.id)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c.count }))
}

/** Prodotti correlati: della stessa sottocategoria, poi del negozio (mai il prodotto stesso, mai quelli nascosti). */
export async function relatedProducts(product, limit = 4) {
  if (!product) return []
  return cached(`related:${product.id}`, 60_000, async () => {
    const scope = await shopScope()
    const own = product.categories.filter((c) => scope.ids.has(c.id) && c.id !== scope.root.id).map((c) => c.id)
    const out = []
    const seen = new Set([product.id])
    for (const categoryId of [...own, scope.root.id]) {
      if (out.length >= limit) break
      const res = await store('/products', {
        query: { per_page: limit + 1, category: String(categoryId), exclude: String(product.id), catalog_visibility: 'catalog', orderby: 'menu_order', order: 'asc' },
      })
      for (const raw of res.data) {
        if (out.length >= limit || seen.has(raw.id) || !inScope(scope, raw.categories ?? [])) continue
        seen.add(raw.id)
        const p = normalizeProduct(raw)
        p.variationCount = p.variationIds.length
        delete p.variationIds
        delete p.description
        out.push(p)
      }
    }
    return out
  })
}

/** Recensioni approvate di un prodotto del negozio, dalla piu' recente (testo gia' ripulito). */
export async function listReviews(productId, limit = 20) {
  const id = Number.parseInt(productId, 10)
  if (!(id > 0)) throw new ShopError(400, 'invalid_product', 'Prodotto non valido.')
  return cached(`reviews:${id}`, 60_000, async () => {
    await assertSellable(id)
    const res = await store('/products/reviews', { query: { product_id: String(id), per_page: limit, orderby: 'date', order: 'desc' } })
    return res.data.map((r) => ({
      id: r.id,
      date: r.date_created_gmt ? `${r.date_created_gmt}Z` : r.date_created,
      reviewer: decode(r.reviewer || 'Cliente'),
      rating: Number.parseInt(r.rating, 10) || 0,
      verified: !!r.verified,
      review: safeHtml(r.review),
    }))
  })
}
