import { PRODUCTS as LINE } from '../products.js'
import { productCard } from '../shop/card.js'
import { PRODUCTS, CATEGORIES, SHOP, productsIn, categoryBySlug, categoryPath, productPath } from './catalog.js'
import { crumbsHtml, faqHtml, esc } from './render.js'

/*
  HTML statico generato in build (vite.config.js, plugin "seo") dai dati di src/seo/catalog.js:
  - <!-- griglia:tutti -->        schede di tutti i prodotti nella pagina Integratori (stesso aspetto
                                   delle schede di sempre: le leggono anche i motori di ricerca senza
                                   JavaScript; il browser le aggiorna con i dati di WooCommerce)
  - <!-- faq:integratori -->      domande frequenti della pagina Integratori
  - <!-- categorie:tutti -->      link alle categorie nella pagina Integratori (come nelle pagine categoria)
  - <!-- catalogo:<categoria> --> contenuto delle pagine categoria (/integratori/<categoria>): testata con
                                   breadcrumb, categorie, griglia, testi e domande frequenti
  - <!-- seo:linea -->            sezione "La linea Nutrex Lab" della homepage, prima del footer
  Solo per la build: usa src/shop/card.js e src/products.js (colori), che il server non carica.
  Classi con nomi propri (linea, crumbs, cats, faq, seo-copy): "line" e "char" sono le righe e le
  lettere create da SplitText (src/ui/text.js) e non vanno mai usate qui.
*/

const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'
const hex = (cls) => `<svg class="${cls}" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}" /></svg>`
const pad = (n) => String(n).padStart(2, '0')
const swatch = (slug) => LINE.find((p) => p.id === slug)?.theme.swatch ?? 'var(--accent)'

/** Scheda statica: stessi dati della scheda di WooCommerce (nome, breve descrizione, foto), senza disponibilita'. */
const staticProduct = (p) => ({ id: p.slug, slug: p.slug, name: p.name, summary: p.summary, type: 'simple', images: [], categories: [], stock: null })

/** Schede dei prodotti di tutta la linea (key = 'tutti') o di una categoria. */
export function staticGrid(key) {
  const cat = key === 'tutti' ? null : categoryBySlug(key)
  if (key !== 'tutti' && !cat) throw new Error(`SEO: categoria sconosciuta "${key}"`)
  return (cat ? productsIn(cat.slug) : PRODUCTS).map((p, i) => productCard(staticProduct(p), i, [])).join('\n')
}

/** Titolo grande della testata (una o due righe, l'esagono al posto del punto finale). */
function displayTitle(lines) {
  const rows = lines
    .map((line, i) => {
      const text = `<span data-split="chars"${i ? ` data-delay="${(0.12 * i).toFixed(2)}"` : ''} aria-hidden="true" data-i18n>${esc(line)}</span>`
      return `<span>${text}${i === lines.length - 1 ? hex('hexdot') : ''}</span>`
    })
    .join('\n            ')
  return `<h1 class="display phead__title" aria-label="${esc(lines.join(' '))}" data-i18n-attr="aria-label">
            ${rows}
          </h1>`
}

function categoryNav(active) {
  const links = [
    ['Tutti', SHOP.path, PRODUCTS.length, !active],
    ...CATEGORIES.map((c) => [c.name, categoryPath(c.slug), productsIn(c.slug).length, active === c.slug]),
  ]
  return `<nav class="cats" aria-label="Categorie di integratori" data-i18n-attr="aria-label">${links
    .map(([name, href, n, on]) => `<a class="chip mono" href="${href}"${on ? ' aria-current="page"' : ''}><span data-i18n>${esc(name)}</span><span class="chip__n">${pad(n)}</span></a>`)
    .join('')}</nav>`
}

function copyBlocks(sections) {
  if (!sections?.length) return ''
  return `<section class="seo-copy" aria-label="Guida alla scelta" data-i18n-attr="aria-label">${sections
    .map(([title, html]) => `<div class="seo-copy__block" data-rise><h2 class="display seo-copy__h" data-i18n>${esc(title)}</h2><div data-i18n>${html}</div></div>`)
    .join('')}</section>`
}

/** Contenuto di una pagina categoria (key = slug della categoria). */
export function catalogMain(key) {
  const cat = categoryBySlug(key)
  if (!cat) throw new Error(`SEO: categoria sconosciuta "${key}"`)
  const products = productsIn(cat.slug)
  const trail = [['Home', '/'], [SHOP.name, SHOP.path], [cat.name, categoryPath(cat.slug)]]
  return `<header class="phead">
          ${crumbsHtml(trail, { className: 'mono eyebrow', hex: true, attrs: 'data-reveal' })}
          ${displayTitle(cat.display)}
          <div class="phead__row">
            <p class="phead__lead" data-reveal data-delay="0.3" data-i18n>${cat.lead}</p>
          </div>
        </header>

        <div class="rule" data-rule></div>

        <div class="toolbar">
          ${categoryNav(cat.slug)}
          <p class="mono toolbar__count" aria-live="polite" data-count>${pad(products.length)} prodotti</p>
          <div class="filters" role="group" aria-label="Filtra per formato" data-i18n-attr="aria-label" data-filters></div>
        </div>

        <ul class="pgrid" data-grid aria-label="Prodotti" data-i18n-attr="aria-label" aria-busy="true">
${staticGrid(cat.slug)}
        </ul>

        ${copyBlocks(cat.sections)}
        ${faqHtml(cat.faq, { attrs: 'data-rise' })}`
}

/** Domande frequenti della pagina Integratori, sotto la griglia. */
export const shopFaq = () => faqHtml(SHOP.faq, { attrs: 'data-rise' })

/** Link alle categorie nella pagina Integratori: gli stessi delle pagine categoria, con "Tutti" attivo. */
export const shopCategories = () => categoryNav(null)

/** Sezione "La linea Nutrex Lab" della homepage: chi e' Nutrex Lab, categorie e i 12 prodotti. */
export function lineSection() {
  const groups = CATEGORIES.map((c, i) => {
    const items = productsIn(c.slug)
      .map(
        (p) =>
          `<li><a class="linea__item" href="${productPath(p.slug)}" style="--sw:${swatch(p.slug)}">${hex('linea__hex')}<span class="linea__name" data-i18n>${esc(p.label)}</span><span class="mono linea__note" data-i18n>${esc(p.note)}</span><span class="linea__arrow" aria-hidden="true">&rarr;</span></a></li>`,
      )
      .join('')
    return `<div class="linea__group">
            <h3 class="linea__cat"><a href="${categoryPath(c.slug)}"><span class="mono linea__num">${pad(i + 1)}</span><span data-i18n>${esc(c.name)}</span></a></h3>
            <p class="linea__catline" data-i18n>${esc(c.line)}</p>
            <ul class="linea__list">${items}</ul>
          </div>`
  }).join('\n          ')
  return `<section class="linea" id="linea" aria-labelledby="linea-titolo">
        <svg class="linea__cap" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0Q50 20 100 0V10.6H0z" /></svg>
        <div class="linea__body">
          <div class="linea__head">
            <p class="mono linea__eyebrow">${hex('linea__eyehex')}<span data-i18n>La linea Nutrex Lab &middot; ${PRODUCTS.length} integratori</span></p>
            <h2 class="display linea__title" id="linea-titolo" data-i18n>Integratori alimentari<br /><em>made in Italy.</em></h2>
            <p class="linea__lead" data-i18n>
              Nutrex Lab è una linea di integratori alimentari prodotti in Italia: collagene idrolizzato, vitamine e
              minerali, estratti vegetali titolati. Formule chiare, con dosi e valori di riferimento dichiarati in etichetta,
              standard di qualità GMP / ISO 9001 e il sigillo di garanzia su ogni confezione.
            </p>
          </div>
          <div class="linea__groups">
          ${groups}
          </div>
          <div class="linea__foot">
            <a class="btn btn--xl linea__cta" href="${SHOP.path}" data-magnetic><span class="btn__label" data-i18n>Tutti gli integratori</span><span class="btn__icon" aria-hidden="true">&rarr;</span></a>
            <a class="link mono linea__link" href="/chi-siamo" data-i18n>Chi siamo</a>
            <a class="link mono linea__link" href="/spedizioni-e-resi" data-i18n>Spedizioni e resi</a>
          </div>
        </div>
      </section>`
}
