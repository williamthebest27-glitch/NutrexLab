import { PRODUCTS } from '../products.js'

/*
  Colori del sito per i prodotti del negozio. I dati commerciali arrivano da WooCommerce; i colori
  sono parte del design (src/products.js, gli stessi del racconto 3D): un prodotto WooCommerce con lo
  stesso slug di un prodotto del sito ne prende i colori e il link al racconto 3D; gli altri usano i
  colori del marchio.
*/

const BRAND = { a: '#9e2e65', hi: '#d45c95', paper: '#f1f0f3', mist: '#e2e1e7', ink: '#0e0c11', deep: '#3b0b27', swatch: '#9e2e65' }

const bySlug = new Map(
  PRODUCTS.map((p) => {
    const pal = p.theme.palette
    return [p.id, { a: pal.berry, hi: pal.berryHi, paper: pal.paper, mist: pal.mist, ink: pal.ink, deep: pal.wine, swatch: p.theme.swatch }]
  }),
)

/** Colori del prodotto (per slug WooCommerce). */
export const themeFor = (slug) => bySlug.get(slug) ?? BRAND

/** Colori come custom properties per schede, righe e pagina prodotto. */
export const colorVars = (slug) => {
  const c = themeFor(slug)
  return `--c-a:${c.a};--c-hi:${c.hi};--c-paper:${c.paper};--c-mist:${c.mist};--c-ink:${c.ink};--c-deep:${c.deep};--c-sw:${c.swatch}`
}

/** Il racconto 3D del prodotto nella homepage (solo per i prodotti del sito). */
export const storyUrl = (slug) => {
  if (!bySlug.has(slug)) return null
  return slug === PRODUCTS[0].id ? '/' : `/?prodotto=${encodeURIComponent(slug)}`
}

export const productUrl = (slug) => `/prodotto/${encodeURIComponent(slug)}`

export const pad = (n) => String(n).padStart(2, '0')

/** "1 prodotto" / "3 prodotti" */
export const pieces = (n) => `${n} ${n === 1 ? 'prodotto' : 'prodotti'}`

/** Testo sicuro da inserire in HTML. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Disponibilita' in italiano dai dati di WooCommerce. */
export function availability(stock) {
  if (!stock) return { text: '', tone: '' }
  if (!stock.inStock) return { text: 'Esaurito', tone: 'out' }
  if (stock.backorder) return { text: 'Disponibile su ordinazione', tone: 'back' }
  if (stock.low) return { text: stock.low === 1 ? 'Ultimo pezzo' : `Solo ${stock.low} disponibili`, tone: 'low' }
  return { text: 'Disponibile', tone: 'in' }
}
