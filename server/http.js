import { publicError } from './errors.js'

/*
  Risposte delle funzioni del negozio e piccoli aiuti per le richieste.
  Le funzioni usano la firma Web (Request -> Response): export const GET = route(async (req) => ...).
*/

/** Risposta JSON. cache: secondi di cache sul CDN di Vercel (0 = mai: carrello, checkout, ordini). */
export function json(data, { status = 200, cache = 0, swr = 0, cookies = [], headers = {} } = {}) {
  const h = new Headers({ 'Content-Type': 'application/json; charset=utf-8', ...headers })
  h.set(
    'Cache-Control',
    cache > 0 ? `public, max-age=0, s-maxage=${cache}, stale-while-revalidate=${swr || cache * 10}` : 'private, no-store',
  )
  for (const c of cookies) h.append('Set-Cookie', c)
  return new Response(JSON.stringify(data), { status, headers: h })
}

/** Corpo JSON della richiesta (vuoto o non valido = {}). */
export async function readJson(request) {
  try {
    const text = await request.text()
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

/**
 * Avvolge un gestore: errori trasformati in messaggi sicuri per il cliente, dettagli nei log di Vercel.
 * name compare nei log per sapere quale funzione ha fallito.
 */
export function route(name, handler) {
  return async (request) => {
    try {
      return await handler(request)
    } catch (err) {
      const { status, body } = publicError(err)
      const detail = { name: err?.name, code: err?.code, status: err?.status, message: err?.message, info: err?.info, data: err?.data, missing: err?.missing }
      if (status >= 500) console.error(`[negozio:${name}]`, JSON.stringify(detail), err?.cause ?? '')
      else console.warn(`[negozio:${name}]`, JSON.stringify(detail))
      return json(body, { status })
    }
  }
}
