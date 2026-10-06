/*
  WooCommerce finto per le prove: risponde come la Store API (/wp-json/wc/store/v1) con pochi prodotti
  di esempio, al posto di fetch. Solo i campi che usa il negozio. Prezzi e dati sono inventati.
*/

export const WOO_URL = 'https://woo.test'

const CUR = {
  currency_code: 'EUR',
  currency_symbol: '€',
  currency_minor_unit: 2,
  currency_decimal_separator: ',',
  currency_thousand_separator: '.',
  currency_prefix: '',
  currency_suffix: ' €',
}

const prices = (price, regular = price) => ({
  ...CUR,
  price: String(price),
  regular_price: String(regular),
  sale_price: String(price),
  price_range: null,
})

const CATEGORIES = [
  { id: 10, parent: 0, slug: 'nutrex-lab', name: 'Nutrex Lab', count: 0 },
  { id: 11, parent: 10, slug: 'polvere', name: 'Polvere', count: 1 },
  { id: 12, parent: 10, slug: 'compresse', name: 'Compresse', count: 2 },
  { id: 13, parent: 10, slug: 'capsule', name: 'Capsule', count: 0 },
  { id: 20, parent: 0, slug: 'altro-negozio', name: 'Altro negozio', count: 1 },
]
const cat = (id) => {
  const c = CATEGORIES.find((x) => x.id === id)
  return { id: c.id, name: c.name, slug: c.slug }
}

function product(id, slug, name, categoryId, extra = {}) {
  return {
    id,
    slug,
    name,
    type: 'simple',
    parent: 0,
    sku: `SKU-${id}`,
    permalink: `${WOO_URL}/prodotto/${slug}/`,
    short_description: '<p>Breve descrizione.</p>',
    description: '<p>Descrizione.</p>',
    on_sale: false,
    prices: prices(1990),
    is_in_stock: true,
    is_purchasable: true,
    is_on_backorder: false,
    low_stock_remaining: null,
    sold_individually: false,
    images: [{ id: id * 10, src: `${WOO_URL}/img/${slug}.webp`, thumbnail: `${WOO_URL}/img/${slug}-300.webp`, srcset: '', sizes: '', name: slug, alt: '' }],
    categories: categoryId ? [cat(categoryId)] : [],
    tags: [],
    attributes: [],
    variations: [],
    weight: '',
    add_to_cart: { minimum: 1, maximum: 9999, multiple_of: 1 },
    average_rating: '0',
    review_count: 0,
    reviews_allowed: true,
    ...extra,
  }
}

// _order = "Ordinamento" del pannello; _hidden = visibilita' catalogo "nascosto"
export const PRODUCTS = [
  product(100, 'collagene', 'Collagene &amp; vitamina C', 11, {
    _order: 1,
    type: 'variable',
    sku: 'COLL',
    description:
      '<p onclick="rubaDati()">Testo <strong>forte</strong> <a href="javascript:alert(1)">link</a> <a href="https://esempio.it/x">fonte</a></p><script>alert(1)</script><iframe src="https://x"></iframe>',
    attributes: [{ name: 'Quantità', has_variations: true, terms: [{ name: '1 confezione' }, { name: '2 confezioni' }] }],
    variations: [
      { id: 101, attributes: [{ name: 'Quantità', value: '1 confezione' }] },
      { id: 102, attributes: [{ name: 'Quantità', value: '2 confezioni' }] },
    ],
  }),
  product(101, 'collagene-1', 'Collagene - 1 confezione', 0, { _variation: true, type: 'variation', parent: 100, sku: 'COLL-1', on_sale: true, prices: prices(4490, 4990) }),
  product(102, 'collagene-2', 'Collagene - 2 confezioni', 0, { _variation: true, type: 'variation', parent: 100, sku: 'COLL-2', prices: prices(8990), is_in_stock: false, is_purchasable: false }),
  product(110, 'magnesio', 'Magnesio', 12, { _order: 2, on_sale: true, prices: prices(1690, 1990), low_stock_remaining: 3, average_rating: '4.50', review_count: 2 }),
  product(120, 'nascosto', 'Prodotto nascosto', 12, { _order: 3, _hidden: true }),
  product(200, 'altro-prodotto', 'Prodotto di un altro negozio', 20, { _order: 0 }),
]

// recensioni approvate (Store API /products/reviews)
export const REVIEWS = [
  { id: 501, date_created: '2026-09-20T10:00:00', date_created_gmt: '2026-09-20T08:00:00', product_id: 110, reviewer: 'Giulia', review: '<p>Ottimo, lo prendo ogni sera.</p><script>alert(1)</script>', rating: 5, verified: true },
  { id: 502, date_created: '2026-09-02T09:00:00', date_created_gmt: '2026-09-02T07:00:00', product_id: 110, reviewer: 'Marco &amp; Co', review: '<p>Buono.</p>', rating: 4, verified: false },
]

const COUPONS = { prova10: 0.1 }

function reply(status, data, headers = {}) {
  return new Response(data === undefined ? '' : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const error = (status, code, message) => reply(status, { code, message, data: { status } })

function page(list, params, maxPerPage = 100) {
  const perPage = Math.min(Number(params.get('per_page') ?? 10), maxPerPage)
  const n = Number(params.get('page') ?? 1)
  const totalPages = Math.max(1, Math.ceil(list.length / perPage))
  return reply(200, list.slice((n - 1) * perPage, n * perPage), { 'X-WP-Total': String(list.length), 'X-WP-TotalPages': String(totalPages) })
}

const descendants = (id) => {
  const ids = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const c of CATEGORIES) {
      if (!ids.has(c.id) && ids.has(c.parent)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return ids
}

const visible = (p) => {
  const out = { ...p }
  delete out._order
  delete out._hidden
  delete out._variation
  return out
}

/** Sostituisce fetch con il WooCommerce finto. Ritorna i controlli per le prove. */
export function installFakeWoo() {
  // plugin: le chiamate ricevute (/wp-json/nutrex/v1/...) e la risposta da dare (null = ok)
  const state = { carts: new Map(), down: false, requests: [], nextToken: 1, plugin: [], pluginReply: null }
  const realFetch = globalThis.fetch

  function cartJson(cart) {
    const items = cart.items.map((i) => {
      const p = PRODUCTS.find((x) => x.id === i.id)
      const parent = p.parent ? PRODUCTS.find((x) => x.id === p.parent) : p
      const unit = Number(p.prices.price)
      const variation = p.parent ? parent.variations.find((v) => v.id === p.id).attributes.map((a) => ({ attribute: a.name, value: a.value })) : []
      return {
        key: `k${i.id}`,
        id: p.id,
        name: parent.name,
        permalink: p.parent ? `${parent.permalink}?attribute_quantita=x` : p.permalink,
        sku: p.sku,
        quantity: i.quantity,
        quantity_limits: { minimum: 1, maximum: 99, multiple_of: 1, editable: true },
        short_description: parent.short_description,
        images: parent.images,
        variation,
        prices: { ...CUR, price: String(unit), regular_price: p.prices.regular_price, sale_price: p.prices.sale_price },
        totals: { line_subtotal: String(unit * i.quantity), line_subtotal_tax: '0', line_total: String(unit * i.quantity), line_total_tax: '0' },
        low_stock_remaining: p.low_stock_remaining,
        backorders_allowed: false,
      }
    })
    const sum = items.reduce((s, i) => s + Number(i.totals.line_total), 0)
    const coupons = cart.coupons.map((code) => ({ code, label: code, totals: { total_discount: String(Math.round(sum * COUPONS[code])), total_discount_tax: '0' } }))
    const discount = coupons.reduce((s, c) => s + Number(c.totals.total_discount), 0)
    return {
      items,
      coupons,
      items_count: cart.items.reduce((s, i) => s + i.quantity, 0),
      totals: { ...CUR, total_items: String(sum), total_items_tax: '0', total_discount: String(discount), total_discount_tax: '0', total_shipping: null, total_shipping_tax: null, total_fees: '0', total_fees_tax: '0', total_tax: '0', total_price: String(sum - discount) },
      needs_shipping: true,
      needs_payment: items.length > 0,
      has_calculated_shipping: false,
      shipping_rates: [],
      shipping_address: { country: 'IT' },
      billing_address: { country: 'IT' },
      errors: [],
    }
  }

  async function handle(url, init) {
    const method = (init.method ?? 'GET').toUpperCase()
    const path = url.pathname.replace('/wp-json/wc/store/v1', '')
    const params = url.searchParams
    const body = init.body ? JSON.parse(init.body) : {}
    let token = init.headers?.['Cart-Token'] ?? null

    if (url.pathname.startsWith('/wp-json/nutrex/v1/')) {
      state.plugin.push({ path: url.pathname, body: init.body ?? '', headers: init.headers ?? {} })
      const r = state.pluginReply ?? { status: 200, data: { ok: true } }
      return reply(r.status, r.data)
    }
    if (path === '/products/reviews') {
      const ids = String(params.get('product_id') ?? '').split(',').map(Number)
      return page(REVIEWS.filter((r) => ids.includes(r.product_id)), params)
    }
    if (path === '/products/categories') return page(CATEGORIES, params, 2) // a pagine piccole, come un negozio con tante categorie
    if (path === '/products') {
      let list = PRODUCTS.filter((p) => (params.get('type') === 'variation' ? p._variation : !p._variation))
      if (params.has('slug')) list = list.filter((p) => p.slug === params.get('slug'))
      if (params.has('parent')) list = list.filter((p) => p.parent === Number(params.get('parent')))
      if (params.has('category')) {
        const ids = descendants(Number(params.get('category')))
        list = list.filter((p) => p.categories.some((c) => ids.has(c.id)))
      }
      if (params.has('exclude')) {
        const out = params.get('exclude').split(',').map(Number)
        list = list.filter((p) => !out.includes(p.id))
      }
      if (params.get('catalog_visibility') === 'catalog') list = list.filter((p) => !p._hidden)
      if (params.get('orderby') === 'menu_order') list = [...list].sort((a, b) => a._order - b._order)
      return page(list.map(visible), params)
    }
    const one = /^\/products\/(\d+)$/.exec(path)
    if (one) {
      const p = PRODUCTS.find((x) => x.id === Number(one[1]))
      return p ? reply(200, visible(p)) : error(404, 'woocommerce_rest_product_invalid_id', 'ID prodotto non valido.')
    }

    if (path.startsWith('/cart')) {
      if (!token || !state.carts.has(token)) {
        if (method !== 'GET') return error(401, 'woocommerce_rest_missing_nonce', 'Manca il nonce.')
        token = `token-${state.nextToken++}`
        state.carts.set(token, { items: [], coupons: [] })
      }
      const cart = state.carts.get(token)
      const ok = () => reply(200, cartJson(cart), { 'Cart-Token': token })
      if (path === '/cart' && method === 'GET') return ok()
      if (path === '/cart/add-item') {
        const p = PRODUCTS.find((x) => x.id === body.id)
        if (!p || p.type === 'variable') return error(400, 'woocommerce_rest_cart_invalid_product', 'Questo prodotto non può essere aggiunto al carrello.')
        if (!p.is_in_stock) return error(400, 'woocommerce_rest_product_out_of_stock', `Non puoi aggiungere &quot;${p.name}&quot; al carrello perché il prodotto è esaurito.`)
        const line = cart.items.find((i) => i.id === p.id)
        if (line) line.quantity += body.quantity
        else cart.items.push({ id: p.id, quantity: body.quantity })
        return ok()
      }
      if (path === '/cart/update-item') {
        const line = cart.items.find((i) => `k${i.id}` === body.key)
        if (!line) return error(409, 'woocommerce_rest_cart_invalid_key', 'Il prodotto non è più nel carrello.')
        line.quantity = body.quantity
        return ok()
      }
      if (path === '/cart/remove-item') {
        cart.items = cart.items.filter((i) => `k${i.id}` !== body.key)
        return ok()
      }
      if (path === '/cart/apply-coupon') {
        const code = String(body.code).toLowerCase()
        if (!(code in COUPONS)) return error(400, 'woocommerce_rest_cart_coupon_error', `Il codice promozionale &quot;${body.code}&quot; non esiste!`)
        if (!cart.coupons.includes(code)) cart.coupons.push(code)
        return ok()
      }
      if (path === '/cart/remove-coupon') {
        cart.coupons = cart.coupons.filter((c) => c !== String(body.code).toLowerCase())
        return ok()
      }
      if (path === '/cart/items' && method === 'DELETE') {
        cart.items = []
        cart.coupons = []
        return reply(200, [], { 'Cart-Token': token })
      }
    }
    return error(404, 'rest_no_route', 'Nessun percorso corrisponde.')
  }

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input)
    state.requests.push(`${init.method ?? 'GET'} ${url.pathname}${url.search}`)
    if (state.down) throw new TypeError('fetch failed')
    if (url.origin !== WOO_URL) throw new Error(`richiesta inattesa a ${url.origin}`)
    return handle(url, init)
  }
  state.restore = () => {
    globalThis.fetch = realFetch
  }
  return state
}
