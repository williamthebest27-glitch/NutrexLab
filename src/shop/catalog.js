import { PRODUCTS } from '../products.js'
import { COPY } from '../content.js'
import { SHOP } from './config.js'

/*
  Catalogo del negozio: i 12 prodotti con i dati gia' presenti nel sito (nomi e colori da
  products.js, frasi, dose e confezione da content.js, prezzi da shop/config.js).
  Foto: public/images/prodotti/<id>.webp, rese dai modelli 3D con le luci del sito.
*/

export const FORMS = { powder: 'Polvere', tablet: 'Compresse', capsule: 'Capsule' }

const int = new Intl.NumberFormat('it-IT', { useGrouping: 'always' })
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: SHOP.currency })

/** "500 g. Gusto neutro. Prodotto in Italia." -> ['500 g', 'Gusto neutro'] (in Italia: tutti) */
function packOf(meta = '') {
  return meta
    .split(/\.\s*/)
    .map((s) => s.trim())
    .filter((s) => s && !/^prodott[oa] in italia$/i.test(s))
}

/** La nota del prodotto, se non ripete il formato ("In polvere", "Compresse"). */
const detailOf = (note, form) => (note && !note.toLowerCase().includes(String(form).toLowerCase()) ? note : '')

export const CATALOG = PRODUCTS.map((p, i) => {
  const c = COPY[p.id] ?? {}
  const pal = p.theme.palette
  const hero = c.ing?.hero
  return {
    id: p.id,
    index: i + 1,
    name: p.name,
    note: p.note,
    form: p.form,
    formLabel: FORMS[p.form] ?? '',
    detail: detailOf(p.note, FORMS[p.form] ?? ''),
    line: c.hero?.line ?? '',
    tags: c.tags ?? [],
    pack: packOf(c.shop?.meta),
    dose: hero ? { value: int.format(hero.value), unit: hero.unit, name: hero.name, sub: hero.sub } : null,
    price: SHOP.prices[p.id] ?? null,
    image: `/images/prodotti/${p.id}.webp`,
    // il racconto 3D del prodotto nella homepage
    href: i === 0 ? '/' : `/?prodotto=${p.id}`,
    colors: { a: pal.berry, hi: pal.berryHi, paper: pal.paper, mist: pal.mist, ink: pal.ink, deep: pal.wine, swatch: p.theme.swatch },
  }
})

export const itemById = (id) => CATALOG.find((x) => x.id === id)

/** Colori del prodotto come custom properties (schede, righe del carrello). */
export const colorVars = (item) => {
  const c = item.colors
  return `--c-a:${c.a};--c-hi:${c.hi};--c-paper:${c.paper};--c-mist:${c.mist};--c-ink:${c.ink};--c-deep:${c.deep};--c-sw:${c.swatch}`
}

/** 24.9 -> "24,90 €"; null -> null */
export const money = (v) => (v == null ? null : eur.format(v))

export const pad = (n) => String(n).padStart(2, '0')

/** "1 prodotto" / "3 prodotti" */
export const pieces = (n) => `${n} ${n === 1 ? 'prodotto' : 'prodotti'}`

/**
 * Totali del carrello. Con un prezzo mancante il subtotale non e' calcolabile (null): la pagina
 * mostra "In arrivo" invece di un numero sbagliato.
 */
export function totals(lines) {
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const known = lines.every((l) => itemById(l.id)?.price != null)
  const subtotal = known ? lines.reduce((s, l) => s + itemById(l.id).price * l.qty, 0) : null
  const { cost, freeFrom } = SHOP.shipping
  let shipping = cost
  if (subtotal != null && freeFrom != null && subtotal >= freeFrom) shipping = 0
  const total = subtotal != null && shipping != null ? subtotal + shipping : null
  return { count, subtotal, shipping, total }
}
