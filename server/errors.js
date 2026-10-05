/*
  Errori del negozio. Al cliente arriva sempre un messaggio comprensibile e mai dettagli tecnici
  (chiavi, indirizzi interni, risposte grezze): quelli restano nei log delle funzioni Vercel.
*/

export class ShopError extends Error {
  /**
   * @param {number} status   stato HTTP per il browser
   * @param {string} code     codice stabile per il frontend (es. 'out_of_stock')
   * @param {string} message  messaggio mostrabile al cliente (italiano)
   * @param {object} [info]   dettagli solo per i log
   */
  constructor(status, code, message, info) {
    super(message)
    this.name = 'ShopError'
    this.status = status
    this.code = code
    this.info = info
  }
}

/** WooCommerce (REST o Store API) ha risposto con un errore. */
export class WooError extends Error {
  constructor(status, code, message, data) {
    super(message || `WooCommerce ${status}`)
    this.name = 'WooError'
    this.status = status
    this.code = code || 'woocommerce_error'
    this.data = data
  }
}

/** Il servizio non risponde (spento, irraggiungibile, troppo lento). */
export class UpstreamError extends Error {
  constructor(service, cause) {
    super(`${service} non raggiungibile`)
    this.name = 'UpstreamError'
    this.service = service
    this.cause = cause
  }
}

// errori della Store API che il cliente deve vedere (il testo arriva gia' tradotto da WooCommerce)
const CUSTOMER_FACING = [
  /^woocommerce_rest_cart_/,
  /^woocommerce_rest_coupon_/,
  /^woocommerce_product_/,
  /^woocommerce_rest_product_/,
  /^woocommerce_rest_invalid_/,
  /^woocommerce_rest_missing_/,
  /^woocommerce_rest_checkout_/,
  /^woocommerce_rest_out_of_stock/,
  /^woocommerce_rest_.*stock/,
  /^woocommerce_rest_cart_item_error$/,
  /^woocommerce_rest_cart_coupon_error$/,
  /^rest_invalid_param$/,
]

const strip = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;|&#0?34;/g, '"')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;|&#822[01];/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()

/** Trasforma qualunque errore in { status, body } sicuro da mandare al browser. */
export function publicError(err) {
  if (err instanceof ShopError) {
    return { status: err.status, body: { error: { code: err.code, message: err.message } } }
  }
  if (err?.name === 'ConfigError') {
    return {
      status: 503,
      body: { error: { code: 'not_configured', message: 'Il negozio non è ancora attivo. Riprova più tardi.' } },
    }
  }
  if (err instanceof UpstreamError) {
    return {
      status: 503,
      body: { error: { code: 'unavailable', message: 'Il negozio non risponde in questo momento. Riprova tra qualche minuto.' } },
    }
  }
  if (err instanceof WooError) {
    if (CUSTOMER_FACING.some((re) => re.test(err.code)) && err.status < 500) {
      return { status: err.status === 403 ? 409 : err.status, body: { error: { code: err.code, message: strip(err.message) } } }
    }
    if (err.status === 404) {
      return { status: 404, body: { error: { code: 'not_found', message: 'Non trovato.' } } }
    }
  }
  return {
    status: 500,
    body: { error: { code: 'server_error', message: 'Qualcosa è andato storto. Riprova tra qualche istante.' } },
  }
}
