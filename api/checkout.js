import { route, json, readJson } from '../server/http.js'
import { readSession } from '../server/session.js'
import { checkoutUrl } from '../server/checkout.js'

/*
  POST /api/checkout { lang }   indirizzo del checkout di WooCommerce con i prodotti del carrello, nella
                                lingua del sito: il browser ci va e il cliente paga su WooCommerce.
*/
export const POST = route('checkout', async (request) => {
  const { lang } = await readJson(request)
  const { url } = await checkoutUrl(readSession(request).token, { lang })
  return json({ url })
})
