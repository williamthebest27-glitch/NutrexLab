import { requireConfig } from './env.js'
import { ShopError, UpstreamError } from './errors.js'

/*
  Chiamate alle funzioni del plugin Nutrex Headless su WooCommerce (/wp-json/nutrex/v1/...): modulo
  contatti e recensioni. Nessuna chiave: il plugin accetta solo dati completi e limita gli invii per
  indirizzo IP, che gli arriva nell'intestazione X-Nutrex-Client. I dettagli degli errori restano nei
  log: al cliente arriva un messaggio comprensibile.
*/

export const clip = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .trim()
    .slice(0, max)

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Indirizzo IP del visitatore dietro al CDN di Vercel. */
export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return clip(forwarded.split(',')[0] || request.headers.get('x-real-ip') || '', 64)
}

const strip = (html) => String(html ?? '').replace(/<[^>]*>/g, '').trim()

/** POST a una funzione del plugin: i dati della risposta, oppure un errore con un messaggio per il cliente. */
export async function postPlugin(path, body, ip, { failed = 'Invio non riuscito in questo momento.' } = {}) {
  const { wooUrl } = requireConfig('wooUrl')
  let res
  try {
    res = await fetch(`${wooUrl}/wp-json/nutrex/v1/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Nutrex-Client': ip || 'sconosciuto' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    })
  } catch (err) {
    throw new UpstreamError('WooCommerce', err)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (res.ok) return data ?? {}
  const message = strip(data?.message)
  if (res.status === 429) throw new ShopError(429, 'too_many', message || "Hai fatto molti invii in poco tempo: riprova tra un po'.")
  // il plugin ha rifiutato i dati (campo mancante, prodotto sbagliato, recensioni chiuse): il suo messaggio
  if (res.status < 500 && message && String(data?.code ?? '').startsWith('nutrex_')) throw new ShopError(res.status, data.code, message)
  // plugin non installato, posta non partita, WordPress in errore: dettagli solo nei log
  throw new ShopError(502, 'send_failed', failed, { status: res.status, code: data?.code, message: data?.message })
}
