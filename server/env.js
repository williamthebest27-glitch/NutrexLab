/*
  Configurazione del negozio (variabili d'ambiente su Vercel). Nessuna chiave segreta: prodotti e
  carrello usano la Store API pubblica di WooCommerce, il pagamento avviene nel checkout di WooCommerce.

  WOOCOMMERCE_URL       indirizzo del sito WordPress con WooCommerce (https, senza barra finale)
  WOOCOMMERCE_CATEGORY  slug della categoria dei prodotti Nutrex (es. nutrex-lab): il negozio mostra e
                        vende solo questi prodotti e quelli delle sue sottocategorie. Obbligatoria: il
                        WooCommerce e' condiviso con un altro negozio, senza categoria il negozio resta chiuso
  SITE_URL              indirizzo pubblico del negozio Nutrex, es. https://nutrexlab.it
                        (facoltativo: senza, si usa l'indirizzo della richiesta)
*/

export class ConfigError extends Error {
  constructor(missing) {
    super(`Configurazione mancante: ${missing.join(', ')}`)
    this.name = 'ConfigError'
    this.missing = missing
  }
}

const read = (name) => String(process.env[name] ?? '').trim()

export function config() {
  return {
    siteUrl: (read('SITE_URL') || read('NEXT_PUBLIC_SITE_URL')).replace(/\/+$/, ''),
    wooUrl: read('WOOCOMMERCE_URL').replace(/\/+$/, ''),
    category: read('WOOCOMMERCE_CATEGORY').toLowerCase(),
  }
}

const NAMES = { wooUrl: 'WOOCOMMERCE_URL', category: 'WOOCOMMERCE_CATEGORY' }

/** La configurazione con i valori richiesti presenti, altrimenti ConfigError (503 per il cliente). */
export function requireConfig(...keys) {
  const c = config()
  const missing = keys.filter((k) => !c[k]).map((k) => NAMES[k] ?? k)
  if (missing.length) throw new ConfigError(missing)
  return c
}

/** Indirizzo pubblico del negozio: SITE_URL oppure quello della richiesta. */
export function siteUrl(request) {
  const fixed = config().siteUrl
  if (fixed) return fixed
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  return `${proto}://${host}`
}
