import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { route } from '../server/http.js'
import { getProduct } from '../server/catalog.js'
import { siteUrl } from '../server/env.js'
import { renderProductPage } from '../server/product-page.js'

/*
  GET /prodotto/<slug>  (vercel.json la riscrive qui con ?slug=<slug>)
  La pagina del prodotto con titolo, descrizione e dati strutturati presi da WooCommerce, in cache
  sul CDN per due minuti (prezzi e disponibilita' poi si aggiornano anche nel browser).
*/

let template = null

/** prodotto.html della build (incluso nella funzione) o, in mancanza, la stessa pagina pubblicata. */
async function loadTemplate(request) {
  if (template && template.until > Date.now()) return template.html
  let html = null
  try {
    const text = await readFile(join(process.cwd(), 'dist', 'prodotto.html'), 'utf8')
    if (text.includes('/assets/')) html = text
  } catch {
    // non incluso: si prova la pagina pubblicata
  }
  if (!html) {
    const res = await fetch(new URL('/prodotto', request.url), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`modello della pagina prodotto non disponibile (${res.status})`)
    html = await res.text()
  }
  template = { html, until: Date.now() + 5 * 60_000 }
  return html
}

export const GET = route('product-page', async (request) => {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug') ?? decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
  const html = await loadTemplate(request)
  let product = null
  let status = 200
  try {
    product = await getProduct(slug)
  } catch (err) {
    status = err?.status === 404 ? 404 : 503
    if (status === 503) console.error('[negozio:product-page]', slug, err?.message)
  }
  const page = renderProductPage(html, { product, site: siteUrl(request), slug, status })
  return new Response(page, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=0, s-maxage=120, stale-while-revalidate=600' : 'public, max-age=0, s-maxage=15',
    },
  })
})
