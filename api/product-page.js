import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { route } from '../server/http.js'
import { getProduct } from '../server/catalog.js'
import { renderProductPage } from '../server/product-page.js'
import { productPath } from '../src/seo/catalog.js'
import { DEFAULT_LANG, isLang, withLang } from '../src/i18n/langs.js'

/*
  GET /prodotto/<slug>  (vercel.json la riscrive qui con ?slug=<slug>; /de/prodotto/<slug> con &lang=de)
  La pagina del prodotto con titolo, descrizione e dati strutturati presi da WooCommerce, in cache
  sul CDN per due minuti (prezzi e disponibilita' poi si aggiornano anche nel browser). Scaduti i due
  minuti il CDN serve subito la copia precedente e intanto la rifa' (stale-while-revalidate, fino a un
  giorno): dopo ore senza visite ne' i clienti ne' Googlebot aspettano l'avvio della funzione e WooCommerce.
  Slug di WooCommerce diverso da quello del sito (/prodotto/ashwagandha-nutrexlab): 301 all'indirizzo del sito.
  Prodotto inesistente: 404 (noindex). Negozio non raggiungibile: 503 con Retry-After, cosi' Google
  riprova piu' tardi senza togliere la pagina dall'indice. HEAD come GET, senza corpo (strumenti SEO).
*/

const templates = new Map()

/**
 * prodotto.html della build nella lingua (dist/prodotto.html, dist/de/prodotto.html..., inclusi nella
 * funzione) o, in mancanza, la stessa pagina pubblicata (/prodotto, /de/prodotto...).
 */
async function loadTemplate(request, lang) {
  const cached = templates.get(lang)
  if (cached && cached.until > Date.now()) return cached.html
  const file = lang === DEFAULT_LANG ? ['dist', 'prodotto.html'] : ['dist', lang, 'prodotto.html']
  let html = null
  try {
    const text = await readFile(join(process.cwd(), ...file), 'utf8')
    if (text.includes('/assets/')) html = text
  } catch {
    // non incluso: si prova la pagina pubblicata
  }
  if (!html) {
    const res = await fetch(new URL(lang === DEFAULT_LANG ? '/prodotto' : `/${lang}/prodotto`, request.url), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`modello della pagina prodotto non disponibile (${res.status})`)
    html = await res.text()
  }
  templates.set(lang, { html, until: Date.now() + 5 * 60_000 })
  return html
}

export const GET = route('product-page', async (request) => {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') ?? decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
  const lang = isLang(url.searchParams.get('lang')) ? url.searchParams.get('lang') : DEFAULT_LANG
  let product = null
  let status = 200
  try {
    product = await getProduct(slug)
  } catch (err) {
    status = err?.status === 404 ? 404 : 503
    if (status === 503) console.error('[negozio:product-page]', slug, err?.message)
  }
  if (product && product.slug !== slug) {
    const headers = { Location: withLang(productPath(product.slug), lang), 'Cache-Control': 'public, max-age=0, s-maxage=86400' }
    return new Response(null, { status: 301, headers })
  }
  const html = await loadTemplate(request, lang)
  const page = await renderProductPage(html, { product, slug, status, lang })
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': status === 200 ? 'public, max-age=0, s-maxage=120, stale-while-revalidate=86400' : 'public, max-age=0, s-maxage=15',
  }
  if (status === 503) headers['Retry-After'] = '120'
  return new Response(request.method === 'HEAD' ? null : page, { status, headers })
})

export const HEAD = GET
