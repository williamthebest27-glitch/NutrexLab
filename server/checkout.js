import { requireConfig } from './env.js'
import { getCart } from './cart.js'
import { ShopError } from './errors.js'
import { isLang } from '../src/i18n/langs.js'

/*
  Pagamento: il carrello del negozio passa al checkout di WooCommerce, dove il cliente paga con i
  metodi gia' attivi su WooCommerce. L'ordine e' un normale ordine WooCommerce (stock, email, clienti,
  coupon, spedizioni, tasse, Amazon MCF: tutto come sempre).

  Il passaggio usa il plugin Nutrex Headless installato su WooCommerce:
    <WOOCOMMERCE_URL>/?nutrex-checkout=1&items=<id>:<qta>,<id>:<qta>&coupons=<codice>&nutrex_lang=<lingua>
  il plugin mette gli stessi prodotti (e i coupon) nel carrello WooCommerce del cliente e apre il
  checkout nella lingua del sito. I prezzi non viaggiano nell'indirizzo: li calcola WooCommerce.
*/

export async function checkoutUrl(token, { lang } = {}) {
  const { wooUrl } = requireConfig('wooUrl')
  const { cart } = await getCart(token)
  if (!cart.items.length) throw new ShopError(409, 'empty_cart', 'Il carrello è vuoto.')
  if (cart.errors.length) throw new ShopError(409, 'cart_error', cart.errors[0].message)
  const url = new URL(wooUrl + '/')
  url.searchParams.set('nutrex-checkout', '1')
  url.searchParams.set('items', cart.items.map((i) => `${i.id}:${i.quantity}`).join(','))
  if (cart.coupons.length) url.searchParams.set('coupons', cart.coupons.map((c) => c.code).join(','))
  if (isLang(lang)) url.searchParams.set('nutrex_lang', lang)
  return { url: url.toString(), cart }
}
