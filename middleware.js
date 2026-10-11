import { COOKIE, DEFAULT_LANG, cookieLang, isLang, splitLang, withLang } from './src/i18n/langs.js'
import { visitorLang } from './src/i18n/geo.js'

/*
  Lingua di chi apre il sito (Vercel Routing Middleware: gira prima delle pagine, solo sugli indirizzi
  di config.matcher qui sotto, cioe' le pagine italiane senza prefisso).
  - ?lang=de in un link (dal pagamento e dall'area clienti sul WooCommerce): stessa pagina in quella
    lingua (/de/carrello), e la scelta resta nel cookie nx_lang.
  - lingua scelta in passato dal selettore (cookie nx_lang, anche "it"): quella.
  - altrimenti la lingua del paese da cui arriva il visitatore (src/i18n/geo.js): dalla Germania
    /integratori diventa /de/integratori, dalla Francia /fr/integratori... dall'Italia resta com'e'.
  Mai per i motori di ricerca e le anteprime dei link (Googlebot arriva quasi sempre dagli Stati Uniti):
  vedono sempre la pagina dell'indirizzo che aprono, e le altre lingue le trovano con hreflang e sitemap.
  Gli indirizzi con il prefisso (/de/...) mostrano sempre la loro lingua: qui non passano.
  Lo stesso middleware gira anche con npm run dev e npm run preview (vite.config.js), senza paese.
*/

export const config = {
  // le pagine del sito (vite.config.js, build.rolldownOptions.input) e i prodotti; npm test controlla che ci siano tutte
  matcher: [
    '/',
    '/integratori',
    '/integratori/:path*',
    '/prodotto/:path*',
    '/carrello',
    '/ordine',
    '/contatti',
    '/chi-siamo',
    '/note-legali',
    '/privacy-policy',
    '/cookie-policy',
    '/termini-e-condizioni',
    '/spedizioni-e-resi',
  ],
}

/** Motori di ricerca, assistenti AI, anteprime dei link e strumenti: nessun cambio di lingua. */
const BOT =
  /bot|crawl|spider|slurp|google|bing|yandex|baidu|duckduck|yahoo|facebookexternalhit|meta-externalagent|whatsapp|telegram|slack|discord|twitter|linkedin|pinterest|embedly|preview|lighthouse|headless|curl|wget|python|node-fetch|axios|okhttp|java\/|go-http|monitor|uptime|semrush|ahrefs|gptbot|claude|perplexity/i

const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } })

function redirect(url, cookie) {
  const headers = { Location: url.toString(), 'Cache-Control': 'private, no-store' }
  if (cookie) headers['Set-Cookie'] = `${COOKIE}=${cookie}; Path=/; Max-Age=31536000; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`
  return new Response(null, { status: 302, headers })
}

export default function middleware(request) {
  if (request.method !== 'GET') return next()
  const url = new URL(request.url)
  if (splitLang(url.pathname).lang) return next()

  // ?lang= di un link: la pagina di quella lingua, e la scelta resta
  const asked = url.searchParams.get('lang')
  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang')
    if (!isLang(asked)) return redirect(url)
    url.pathname = withLang(url.pathname, asked)
    return redirect(url, asked)
  }

  const accept = request.headers.get('accept') ?? ''
  if (accept && !/text\/html|\*\/\*/.test(accept)) return next()

  // lingua scelta dal visitatore, altrimenti quella del suo paese (mai per i motori di ricerca)
  let lang = cookieLang(request.headers.get('cookie'))
  if (!lang) {
    const ua = request.headers.get('user-agent') ?? ''
    if (!ua || BOT.test(ua)) return next()
    lang = visitorLang({ country: request.headers.get('x-vercel-ip-country'), acceptLanguage: request.headers.get('accept-language') })
  }
  if (!lang || lang === DEFAULT_LANG) return next()
  url.pathname = withLang(url.pathname, lang)
  return redirect(url)
}
