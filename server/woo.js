import { requireConfig } from './env.js'
import { WooError, UpstreamError } from './errors.js'

/*
  Store API di WooCommerce (/wp-json/wc/store/v1), dal server del negozio: catalogo pubblico e
  carrello della sessione del cliente. Non servono chiavi: sono le stesse API usate dal negozio
  WooCommerce stesso. La sessione del cliente e' il Cart-Token di WooCommerce, conservato in un
  cookie httpOnly del negozio (vedi session.js).
*/

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function withQuery(url, query) {
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return url
}

/**
 * Chiamata alla Store API. cartToken: la sessione del cliente (null = nuova sessione).
 * Ritorna anche il Cart-Token aggiornato da conservare nel cookie.
 */
export async function store(path, { method = 'GET', query, body, cartToken, timeout = 15000 } = {}) {
  // anche la categoria: senza, il negozio mostrerebbe tutti i prodotti del WooCommerce condiviso
  const c = requireConfig('wooUrl', 'category')
  const url = withQuery(new URL(`${c.wooUrl}/wp-json/wc/store/v1${path}`), query)
  /*
    La cache dell'hosting di WooCommerce (SiteGround) tiene le letture dei prodotti per ore, anche dopo
    una modifica nel pannello (prezzi, scorte): un parametro sempre diverso la salta. La freschezza la
    decidono le cache del negozio (catalog.js e CDN di Vercel, pochi secondi).
  */
  if (method === 'GET') url.searchParams.set('_nx', String(Date.now()))
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cartToken) headers['Cart-Token'] = cartToken
  const retries = method === 'GET' ? 2 : 0 // si riprova solo per le letture

  for (let attempt = 0; ; attempt++) {
    let res
    try {
      res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeout) })
    } catch (err) {
      if (attempt < retries) {
        await sleep(300 * 2 ** attempt)
        continue
      }
      throw new UpstreamError('WooCommerce', err)
    }
    if (res.status >= 500 && attempt < retries) {
      await sleep(300 * 2 ** attempt)
      continue
    }
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // WordPress a volte risponde con HTML (pagina di errore, manutenzione, firewall dell'hosting)
      if (res.ok) throw new UpstreamError('WooCommerce', new Error(`risposta non JSON (${res.status})`))
      throw new WooError(res.status, 'invalid_response', `risposta non JSON (${res.status})`)
    }
    if (!res.ok) throw new WooError(res.status, data?.code, data?.message, data?.data)
    return {
      data,
      cartToken: res.headers.get('cart-token') || cartToken || null,
      total: Number(res.headers.get('x-wp-total') ?? 0),
      totalPages: Number(res.headers.get('x-wp-totalpages') ?? 0),
    }
  }
}
