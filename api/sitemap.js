import { route } from '../server/http.js'
import { listProducts } from '../server/catalog.js'
import { siteUrl } from '../server/env.js'

/*
  GET /sitemap.xml  (riscritto qui da vercel.json): pagine del sito e prodotti pubblicati in WooCommerce.
*/

const PAGES = ['/', '/acquista', '/contatti']
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

export const GET = route('sitemap', async (request) => {
  const site = siteUrl(request)
  const urls = PAGES.map((p) => `${site}${p}`)
  for (let page = 1; page <= 20; page++) {
    const res = await listProducts({ page, perPage: 100 })
    for (const p of res.products) urls.push(`${site}/prodotto/${encodeURIComponent(p.slug)}`)
    if (page >= res.totalPages) break
  }
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') +
    '\n</urlset>\n'
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
  })
})
