import { route, json } from '../server/http.js'
import { listProducts, getProduct, listCategories, relatedProducts } from '../server/catalog.js'

/*
  GET /api/products                 prodotti pubblicati (?page=&per_page=&category=)
  GET /api/products?slug=<slug>     un prodotto con le sue variazioni e i prodotti correlati
  Dati pubblici della Store API di WooCommerce, in cache sul CDN per un minuto: prezzi e stock
  restano aggiornati e WooCommerce non riceve una richiesta per ogni visita.
*/
export const GET = route('products', async (request) => {
  const q = new URL(request.url).searchParams
  const slug = q.get('slug')
  if (slug) {
    const product = await getProduct(slug)
    const related = await relatedProducts(product).catch(() => [])
    return json({ product, related }, { cache: 60, swr: 600 })
  }
  const page = Math.max(1, Number.parseInt(q.get('page') ?? '1', 10) || 1)
  const perPage = Math.min(100, Math.max(1, Number.parseInt(q.get('per_page') ?? '24', 10) || 24))
  const [list, categories] = await Promise.all([listProducts({ page, perPage, category: q.get('category') ?? undefined }), listCategories()])
  return json({ ...list, categories }, { cache: 60, swr: 600 })
})
