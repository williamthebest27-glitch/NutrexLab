/*
  Sessione del carrello. WooCommerce identifica il carrello di un cliente con il Cart-Token della
  Store API: il negozio lo conserva in un cookie httpOnly (il JavaScript della pagina non lo legge) e
  lo passa a WooCommerce a ogni richiesta del carrello.

  nx_cart   Cart-Token di WooCommerce (httpOnly)
  nx_count  quanti prodotti ci sono nel carrello (leggibile dalla pagina: i numeri del menu si
            mostrano subito, senza chiedere il carrello a WooCommerce a ogni pagina)
*/

const TWO_DAYS = 60 * 60 * 48 // come la sessione dei clienti ospiti di WooCommerce

export function parseCookies(header) {
  const out = {}
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    if (!k) continue
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim())
    } catch {
      out[k] = part.slice(i + 1).trim()
    }
  }
  return out
}

function isHttps(request) {
  const proto = request.headers.get('x-forwarded-proto')
  return proto ? proto === 'https' : new URL(request.url).protocol === 'https:'
}

function cookie(request, name, value, { maxAge = TWO_DAYS, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value ?? '')}`, 'Path=/', 'SameSite=Lax', `Max-Age=${value ? maxAge : 0}`]
  if (httpOnly) parts.push('HttpOnly')
  if (isHttps(request)) parts.push('Secure')
  return parts.join('; ')
}

/** Sessione della richiesta: { token } */
export function readSession(request) {
  const c = parseCookies(request.headers.get('cookie'))
  return { token: c.nx_cart || null }
}

/** Cookie da impostare dopo una risposta del carrello. */
export function sessionCookies(request, { token, count } = {}) {
  const out = []
  if (token !== undefined) out.push(cookie(request, 'nx_cart', token))
  if (count !== undefined) out.push(cookie(request, 'nx_count', count > 0 ? String(count) : '', { httpOnly: false }))
  return out
}
