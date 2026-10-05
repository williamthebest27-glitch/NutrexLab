import { route, json } from '../server/http.js'
import { readSession } from '../server/session.js'
import { checkoutUrl } from '../server/checkout.js'

/*
  POST /api/checkout   indirizzo del checkout di WooCommerce con i prodotti del carrello:
                       il browser ci va e il cliente paga su WooCommerce.
*/
export const POST = route('checkout', async (request) => {
  const { url } = await checkoutUrl(readSession(request).token)
  return json({ url })
})
