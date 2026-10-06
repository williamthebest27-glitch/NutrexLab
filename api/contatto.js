import { route, json, readJson } from '../server/http.js'
import { cleanMessage, sendMessage } from '../server/contact.js'
import { clientIp } from '../server/plugin.js'

/*
  POST /api/contatto { nome, email, tema, prodotto, messaggio, sito }
  Il messaggio della pagina Contatti arriva a info@nutrexlab.it (plugin Nutrex Headless su WooCommerce).
  "sito" e' il campo trappola per i robot: se e' compilato si risponde ok senza spedire nulla.
  Mai in cache.
*/
export const POST = route('contatto', async (request) => {
  const message = cleanMessage(await readJson(request))
  if (message) await sendMessage(message, clientIp(request))
  return json({ ok: true })
})
