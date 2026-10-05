import { initPage, rise } from './common.js'
import { cart } from '../shop/cart.js'

/*
  Grazie: dopo il pagamento nel checkout di WooCommerce il cliente torna qui (plugin Nutrex Headless,
  ?numero=<numero dell'ordine>). Il carrello del negozio si svuota: i prodotti ora sono nell'ordine.
*/

const { ready } = initPage()

const number = new URLSearchParams(location.search).get('numero')
if (number && /^[\w-]{1,40}$/.test(number)) {
  document.querySelector('[data-number-value]').textContent = number
  document.querySelector('[data-number]').hidden = false
  document.title = `Grazie, ordine ${number} | Nutrex Lab`
  // i prodotti sono stati ordinati: il carrello del negozio riparte vuoto
  if (cart.count > 0) cart.clear().catch(() => {})
}

rise(document.querySelectorAll('[data-rise]'), { y: 30, stagger: 0.08, after: ready })
