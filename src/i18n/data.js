import { lang, t, localize } from './index.js'
import { productBySlug, categoryBySlug, CATEGORIES, QUALITY, SHOP, productAlt as productAltIt } from '../seo/catalog.js'

/*
  Dati del negozio nella lingua del sito: catalogo del sito (src/seo/catalog.js) e prodotti di
  WooCommerce (nome, descrizioni, caratteristiche, testi delle foto). Le traduzioni sono quelle di
  src/i18n/locales/<lingua>/ (la chiave e' il testo italiano): se in WooCommerce cambia un testo, finche'
  non c'e' la sua traduzione si vede quello italiano.
  In italiano ogni funzione restituisce il dato cosi' com'e'.
*/

const it = () => lang() === 'it'
const plain = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

/** Prodotto del catalogo del sito tradotto (benefici: il simbolo resta, titolo e testo si traducono). */
export function catalogProduct(slug) {
  const p = productBySlug(slug)
  if (!p || it()) return p
  const { benefits, ...rest } = p
  return {
    ...localize(rest),
    benefits: (benefits ?? []).map(([icon, title, text]) => [icon, t(title), t(text)]),
  }
}

/** Categoria del sito tradotta (nome, titoli, testi, domande frequenti). */
export const category = (c) => (c && !it() ? localize(c) : c)
export const categoryOfSlug = (slug) => category(categoryBySlug(slug))
export const categories = () => (it() ? CATEGORIES : CATEGORIES.map(category))

/** Sigillo o simbolo di "Qualita' e garanzie" tradotto. */
export const quality = (key) => (QUALITY[key] && !it() ? localize(QUALITY[key]) : QUALITY[key])

/** Pagina Integratori (nome, titolo, domande frequenti) tradotta. */
export const shop = () => (it() ? SHOP : localize(SHOP))

/** Testo alternativo della foto di un prodotto (come productAlt di src/seo/catalog.js, nella lingua). */
export function productAlt(name, slug, index = 0) {
  const p = productBySlug(slug)
  if (index > 0) return t('{nome} Nutrex Lab, foto {n}', { nome: name, n: index + 1 })
  return p ? `${name} Nutrex Lab, ${t(p.pack)}` : `${name} Nutrex Lab`
}

/**
 * Prodotto di WooCommerce tradotto: nome, descrizioni, caratteristiche (non quelle delle varianti: le
 * varianti si riconoscono dai valori italiani), categorie e testi delle foto.
 */
export function localizeProduct(p) {
  if (!p || it()) return p
  const name = t(p.name)
  const short = p.shortDescription ? t(p.shortDescription) : p.shortDescription
  const alt = (img, i) => {
    if (!img) return img
    // il testo fatto dal sito (nome e confezione) si rifa' nella lingua; quello scritto in WooCommerce si traduce
    const generated = img.alt === productAltIt(p.name, p.slug, i)
    return { ...img, alt: generated ? productAlt(name, p.slug, i) : t(img.alt) }
  }
  return {
    ...p,
    name,
    shortDescription: short,
    description: p.description ? t(p.description) : p.description,
    // la riga breve delle schede e' il testo della breve descrizione
    summary: short && short !== p.shortDescription ? plain(short) : t(p.summary),
    attributes: (p.attributes ?? []).map((a) => (a.variation ? a : { ...a, name: t(a.name), values: a.values.map((v) => t(v)) })),
    categories: (p.categories ?? []).map((c) => ({ ...c, name: t(c.name) })),
    images: (p.images ?? []).map(alt),
    variations: p.variations?.map((v) => ({ ...v, images: (v.images ?? []).map(alt) })),
  }
}

/** Voce del carrello tradotta (nome e testo della foto). */
export function localizeCartItem(item) {
  if (!item || it()) return item
  const name = t(item.name)
  return { ...item, name, image: item.image ? { ...item.image, alt: productAlt(name, item.slug) } : item.image }
}
