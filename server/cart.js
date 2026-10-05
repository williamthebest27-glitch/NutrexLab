import { store } from './woo.js'
import { decode, plain, assertSellable } from './catalog.js'
import { ShopError } from './errors.js'

/*
  Carrello di WooCommerce (Store API) per la sessione del cliente. Prezzi, sconti, spedizioni,
  tasse e totali li calcola WooCommerce: qui si trasformano soltanto nella forma usata dal negozio.
  Gli importi sono in centesimi e gia' con l'IVA (negozio B2C italiano: prezzi IVA inclusa).
  Indirizzi, spedizione e pagamento si scelgono poi nel checkout di WooCommerce.
*/

const int = (v) => (v === null || v === undefined || v === '' ? 0 : Number.parseInt(v, 10) || 0)

function currencyOf(t) {
  return {
    code: t.currency_code,
    symbol: t.currency_symbol,
    minorUnit: t.currency_minor_unit,
    decimalSep: t.currency_decimal_separator,
    thousandSep: t.currency_thousand_separator,
    prefix: t.currency_prefix,
    suffix: t.currency_suffix,
  }
}

/** slug del prodotto dall'indirizzo (…/prodotto/<slug> o …/product/<slug>/) */
const slugOf = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? null
  } catch {
    return null
  }
}

const address = (a) =>
  a && {
    firstName: a.first_name ?? '',
    lastName: a.last_name ?? '',
    company: a.company ?? '',
    address1: a.address_1 ?? '',
    address2: a.address_2 ?? '',
    city: a.city ?? '',
    state: a.state ?? '',
    postcode: a.postcode ?? '',
    country: a.country ?? '',
    phone: a.phone ?? '',
    email: a.email ?? undefined,
  }

export function normalizeCart(c) {
  const t = c.totals ?? {}
  return {
    count: c.items_count ?? 0,
    items: (c.items ?? []).map((i) => ({
      key: i.key,
      id: i.id,
      name: decode(i.name),
      slug: slugOf(i.permalink),
      sku: i.sku || null,
      quantity: i.quantity,
      limits: {
        min: i.quantity_limits?.minimum ?? 1,
        max: i.quantity_limits?.maximum ?? 9999,
        step: i.quantity_limits?.multiple_of ?? 1,
        editable: i.quantity_limits?.editable ?? true,
      },
      summary: plain(i.short_description),
      image: i.images?.[0] ? { src: i.images[0].src, thumbnail: i.images[0].thumbnail, alt: decode(i.images[0].alt || i.name) } : null,
      variation: (i.variation ?? []).map((v) => ({ name: decode(v.attribute), value: decode(v.value) })),
      prices: { price: int(i.prices?.price), regular: int(i.prices?.regular_price), sale: int(i.prices?.sale_price) },
      totals: {
        subtotal: int(i.totals?.line_subtotal) + int(i.totals?.line_subtotal_tax),
        total: int(i.totals?.line_total) + int(i.totals?.line_total_tax),
      },
      lowStock: i.low_stock_remaining ?? null,
      backorder: !!i.backorders_allowed,
    })),
    coupons: (c.coupons ?? []).map((co) => ({
      code: co.code,
      label: decode(co.label || co.code),
      discount: int(co.totals?.total_discount) + int(co.totals?.total_discount_tax),
    })),
    totals: {
      currency: currencyOf(t),
      items: int(t.total_items) + int(t.total_items_tax),
      discount: int(t.total_discount) + int(t.total_discount_tax),
      shipping: t.total_shipping === null || t.total_shipping === undefined ? null : int(t.total_shipping) + int(t.total_shipping_tax),
      fees: int(t.total_fees) + int(t.total_fees_tax),
      tax: int(t.total_tax),
      total: int(t.total_price),
    },
    needsShipping: !!c.needs_shipping,
    needsPayment: !!c.needs_payment,
    hasCalculatedShipping: !!c.has_calculated_shipping,
    shipping: (c.shipping_rates ?? []).map((pkg) => ({
      packageId: pkg.package_id,
      rates: (pkg.shipping_rates ?? []).map((r) => ({
        id: r.rate_id,
        name: decode(r.name),
        methodId: r.method_id,
        price: int(r.price) + int(r.taxes),
        selected: !!r.selected,
        deliveryTime: r.delivery_time?.value ? decode(r.delivery_time.value) : null,
      })),
    })),
    shippingAddress: address(c.shipping_address),
    billingAddress: address(c.billing_address),
    errors: (c.errors ?? []).map((e) => ({ code: e.code, message: plain(e.message) })),
  }
}

const clip = (v, max = 120) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max)

// ---------------------------------------------------------------------------- azioni
const ACTIONS = {
  add: ({ id, quantity = 1 }) => {
    const pid = Number.parseInt(id, 10)
    const qty = Number.parseInt(quantity, 10)
    if (!(pid > 0) || !(qty > 0) || qty > 9999) throw new ShopError(400, 'invalid_item', 'Prodotto o quantità non validi.')
    return ['/cart/add-item', 'POST', { id: pid, quantity: qty }]
  },
  update: ({ key, quantity }) => {
    const qty = Number.parseInt(quantity, 10)
    if (!key || !(qty >= 0) || qty > 9999) throw new ShopError(400, 'invalid_item', 'Quantità non valida.')
    return qty === 0 ? ['/cart/remove-item', 'POST', { key: String(key) }] : ['/cart/update-item', 'POST', { key: String(key), quantity: qty }]
  },
  remove: ({ key }) => {
    if (!key) throw new ShopError(400, 'invalid_item', 'Prodotto non valido.')
    return ['/cart/remove-item', 'POST', { key: String(key) }]
  },
  coupon: ({ code }) => {
    const c = clip(code, 60)
    if (!c) throw new ShopError(400, 'invalid_coupon', 'Inserisci un codice sconto.')
    return ['/cart/apply-coupon', 'POST', { code: c }]
  },
  'remove-coupon': ({ code }) => ['/cart/remove-coupon', 'POST', { code: clip(code, 60) }],
}

/** Esegue un'azione sul carrello WooCommerce della sessione. Ritorna { cart, token }. */
export async function cartAction(token, action, payload = {}) {
  if (action === 'clear') return clearCart(token)
  const make = ACTIONS[action]
  if (!make) throw new ShopError(400, 'invalid_action', 'Operazione non valida.')
  const [path, method, body] = make(payload)
  // si aggiungono solo i prodotti di questo negozio (WooCommerce puo' essere condiviso)
  if (action === 'add') await assertSellable(body.id)
  // nuovo cliente: prima si apre la sessione WooCommerce (Cart-Token), poi si modifica il carrello
  if (!token) token = (await store('/cart')).cartToken
  const res = await store(path, { method, body, cartToken: token })
  return { cart: normalizeCart(res.data), token: res.cartToken }
}

export async function getCart(token) {
  const res = await store('/cart', { cartToken: token })
  return { cart: normalizeCart(res.data), token: res.cartToken }
}

/** Svuota il carrello (dopo un pagamento riuscito). */
export async function clearCart(token) {
  if (!token) return getCart(null)
  const res = await store('/cart/items', { method: 'DELETE', cartToken: token })
  const after = await getCart(res.cartToken)
  return after
}
