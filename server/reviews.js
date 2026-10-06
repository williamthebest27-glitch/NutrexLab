import { ShopError } from './errors.js'
import { clip, EMAIL, postPlugin } from './plugin.js'

/*
  Recensioni scritte dal negozio: arrivano al plugin Nutrex Headless (POST /wp-json/nutrex/v1/recensione)
  e diventano normali recensioni WooCommerce del prodotto, con le stesse regole dell'altro negozio
  (recensioni attive, voto obbligatorio, solo chi ha acquistato, moderazione). Quelle approvate si
  leggono dalla Store API (server/catalog.js, listReviews).
*/

/** I campi puliti, oppure null se ha scritto un robot (campo trappola compilato). */
export function cleanReview(body = {}) {
  const r = {
    product_id: Number.parseInt(body.product, 10),
    nome: clip(body.nome, 120),
    email: clip(body.email, 200),
    voto: Number.parseInt(body.voto, 10),
    testo: clip(body.testo, 5000),
  }
  if (clip(body.sito, 200)) return null
  if (!(r.product_id > 0)) throw new ShopError(400, 'invalid_product', 'Prodotto non valido.')
  if (r.nome.length < 2) throw new ShopError(400, 'invalid_name', 'Inserisci il tuo nome.')
  if (!EMAIL.test(r.email)) throw new ShopError(400, 'invalid_email', 'Inserisci un indirizzo email valido.')
  if (!(r.voto >= 1 && r.voto <= 5)) throw new ShopError(400, 'invalid_rating', 'Scegli da 1 a 5 stelle.')
  if (r.testo.length < 5) throw new ShopError(400, 'invalid_text', 'Scrivi la tua recensione.')
  return r
}

/** Invia la recensione: { approved } (false = in attesa di approvazione). */
export async function sendReview(review, ip) {
  const data = await postPlugin('recensione', review, ip, { failed: 'Recensione non inviata in questo momento.' })
  return { approved: !!data.approved }
}
