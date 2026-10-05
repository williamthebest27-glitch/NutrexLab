import { route, json, readJson } from '../server/http.js'
import { readSession, sessionCookies } from '../server/session.js'
import { getCart, cartAction } from '../server/cart.js'

/*
  Carrello del cliente (Store API di WooCommerce, sessione nel cookie httpOnly nx_cart).
  GET  /api/cart                          il carrello
  POST /api/cart { action, ... }          add {id, quantity} | update {key, quantity} | remove {key}
                                          coupon {code} | remove-coupon {code} | clear
  Mai in cache: ogni risposta e' del singolo cliente.
*/

function respond(request, session, { cart, token }) {
  return json({ cart }, { cookies: sessionCookies(request, { token: token ?? session.token, count: cart.count }) })
}

export const GET = route('cart', async (request) => {
  const session = readSession(request)
  return respond(request, session, await getCart(session.token))
})

export const POST = route('cart', async (request) => {
  const session = readSession(request)
  const body = await readJson(request)
  return respond(request, session, await cartAction(session.token, String(body.action ?? ''), body))
})
