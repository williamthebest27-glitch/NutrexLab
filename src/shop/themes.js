import { PRODUCTS } from '../products.js'
import { t, tp } from '../i18n/index.js'

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

/** "1 prodotto" / "3 prodotti" (nella lingua del sito) */
export const pieces = (n) => tp(n, '{n} prodotto', '{n} prodotti')

/** Testo sicuro da inserire in HTML. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Disponibilita' (nella lingua del sito) dai dati di WooCommerce. quantity: anche i pezzi in magazzino (pagina prodotto). */
export function availability(stock, { quantity = false } = {}) {
  if (!stock) return { text: '', tone: '' }
  if (!stock.inStock) return { text: t('Esaurito'), tone: 'out' }
  // in WooCommerce ma non ancora acquistabile (per esempio senza prezzo)
  if (stock.purchasable === false) return { text: t('Presto disponibile'), tone: 'back' }
  if (stock.backorder) return { text: t('Disponibile su ordinazione'), tone: 'back' }
  if (stock.low) return { text: stock.low === 1 ? t('Ultimo pezzo') : t('Solo {n} disponibili', { n: stock.low }), tone: 'low' }
  if (quantity && stock.quantity) return { text: tp(stock.quantity, '{n} disponibile', '{n} disponibili'), tone: 'in' }
  return { text: t('Disponibile'), tone: 'in' }
}
