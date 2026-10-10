import { route } from '../server/http.js'
import { requireConfig } from '../server/env.js'
import { isLang } from '../src/i18n/langs.js'

/*
  GET /account[?ref=CODICE&vista=registrati&torna=carrello|pagamento&lang=de]
  L'area clienti di Nutrex Lab sta sul WooCommerce (pagina /account-nutrex-lab/ creata dal plugin, con la
  cornice Nutrex): da qui ci si arriva con un indirizzo di nutrexlab.it, portandosi dietro l'invito di un
  amico (ref), la vista da aprire, dove tornare dopo l'accesso e la lingua del sito (i link del sito a
  /account hanno ?lang=, src/i18n/index.js). Mai in cache.
*/
export const GET = route('account', async (request) => {
  const { wooUrl } = requireConfig('wooUrl')
  const from = new URL(request.url).searchParams
  const url = new URL(`${wooUrl}/account-nutrex-lab/`)
  for (const key of ['ref', 'vista', 'torna']) {
    const value = (from.get(key) ?? '').trim().slice(0, 40)
    if (value && /^[\w-]+$/.test(value)) url.searchParams.set(key, value)
  }
  const lang = from.get('lang')
  if (isLang(lang)) url.searchParams.set('nutrex_lang', lang)
  return new Response(null, { status: 302, headers: { Location: url.toString(), 'Cache-Control': 'private, no-store' } })
})
