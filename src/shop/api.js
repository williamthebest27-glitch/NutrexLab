/*
  Chiamate del browser alle funzioni del negozio (/api), che parlano con WooCommerce. Il pagamento
  avviene poi nel checkout di WooCommerce.
*/

export class ApiError extends Error {
  constructor(status, code, message, info) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.info = info
  }
}

const OFFLINE = 'Connessione assente. Controlla la rete e riprova.'

async function call(path, { method = 'GET', body, signal } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new ApiError(0, 'offline', OFFLINE)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    // risposta vuota o non JSON
  }
  if (!res.ok) {
    const e = data?.error ?? {}
    throw new ApiError(res.status, e.code ?? 'error', e.message ?? 'Qualcosa è andato storto. Riprova tra qualche istante.', e)
  }
  return data
}

export const api = {
  products: (params = {}) => call(`/api/products?${new URLSearchParams(params)}`),
  product: (slug) => call(`/api/products?slug=${encodeURIComponent(slug)}`),
  cart: () => call('/api/cart'),
  cartAction: (action, payload = {}) => call('/api/cart', { method: 'POST', body: { action, ...payload } }),
  /** indirizzo del checkout di WooCommerce con i prodotti del carrello */
  checkoutUrl: () => call('/api/checkout', { method: 'POST', body: {} }),
}
