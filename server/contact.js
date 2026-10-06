import { ShopError } from './errors.js'
import { clip, EMAIL, postPlugin } from './plugin.js'

/*
  Modulo contatti: il messaggio arriva a info@nutrexlab.it attraverso il plugin Nutrex Headless su
  WooCommerce (POST /wp-json/nutrex/v1/contatto), che lo spedisce dal server di posta di nutrexlab.it
  con "Rispondi a" = chi ha scritto. Qui si controllano i campi.
*/

/** I campi puliti, oppure null se ha scritto un robot (campo trappola compilato). */
export function cleanMessage(body = {}) {
  const m = {
    nome: clip(body.nome, 120),
    email: clip(body.email, 200),
    tema: clip(body.tema, 120),
    prodotto: clip(body.prodotto, 200),
    messaggio: clip(body.messaggio, 5000),
  }
  if (clip(body.sito, 200)) return null
  if (m.nome.length < 2) throw new ShopError(400, 'invalid_name', 'Inserisci il tuo nome.')
  if (!EMAIL.test(m.email)) throw new ShopError(400, 'invalid_email', 'Inserisci un indirizzo email valido.')
  if (m.messaggio.length < 5) throw new ShopError(400, 'invalid_message', 'Scrivi il tuo messaggio.')
  return m
}

/** Spedisce il messaggio (true) o solleva un errore comprensibile per il cliente. */
export async function sendMessage(message, ip) {
  await postPlugin('contatto', message, ip)
  return true
}
