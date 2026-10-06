import { route, json, readJson } from '../server/http.js'
import { listReviews } from '../server/catalog.js'
import { cleanReview, sendReview } from '../server/reviews.js'
import { clientIp } from '../server/plugin.js'

/*
  GET  /api/recensioni?product=<id>                       recensioni approvate del prodotto (cache CDN un minuto)
  POST /api/recensioni { product, nome, email, voto, testo, sito }   nuova recensione -> { ok, approved }
  "sito" e' il campo trappola per i robot: se e' compilato si risponde ok senza inviare nulla.
*/
export const GET = route('recensioni', async (request) => {
  const id = new URL(request.url).searchParams.get('product')
  return json({ reviews: await listReviews(id) }, { cache: 60, swr: 600 })
})

export const POST = route('recensioni', async (request) => {
  const review = cleanReview(await readJson(request))
  const result = review ? await sendReview(review, clientIp(request)) : { approved: false }
  return json({ ok: true, approved: result.approved })
})
