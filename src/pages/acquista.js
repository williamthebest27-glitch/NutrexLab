import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { initPage, rise, reduced } from './common.js'
import { api } from '../shop/api.js'
import { initDock } from './dock.js'
import { pad, esc } from '../shop/themes.js'
import { productCard } from '../shop/card.js'
import { CATEGORIES, PRODUCTS as CATALOG, categoryBySlug, productsIn } from '../seo/catalog.js'
import { lang, t, tp, onLang } from '../i18n/index.js'
import { localizeProduct, catalogProduct } from '../i18n/data.js'

gsap.registerPlugin(Flip)

/*
  Integratori (/integratori) e categorie (/integratori/<categoria>, <main data-catalog="...">).
  Le schede dei prodotti sono gia' nella pagina (build, src/seo/build.js: le leggono anche i motori di
  ricerca e gli assistenti AI senza JavaScript); qui si aggiornano con i dati di WooCommerce
  (disponibilita', offerte, nomi e descrizioni attuali, nell'ordine scelto nel pannello), si aggiungono i
  prodotti nuovi e si tolgono quelli non piu' in vendita. In una categoria restano solo i suoi prodotti.
  Se WooCommerce non risponde restano le schede della pagina. Niente prezzi qui: si vedono nella pagina
  del prodotto, dove si sceglie la variante e si aggiunge al carrello.
*/

const { ready } = initPage()

const category = categoryBySlug(document.querySelector('[data-catalog]')?.dataset.catalog)
const own = category ? new Set(productsIn(category.slug).map((p) => p.slug)) : null
/** Prodotto della pagina: tutti, oppure quelli della categoria (anche i nuovi messi in WooCommerce nella
 *  sottocategoria di "Nutrex Lab" con lo stesso slug, es. collagene). */
const belongs = (p) => !category || own.has(p.slug) || p.categories.some((c) => c.slug === category.slug)
/** Filtri per formato: nelle categorie non si ripetono le sottocategorie che sono gia' le categorie del sito. */
const formatFilters = (categories) => (category ? categories.filter((c) => !CATEGORIES.some((k) => k.slug === c.slug)) : categories)
const grid = document.querySelector('[data-grid]')
const filters = document.querySelector('[data-filters]')
const countEl = document.querySelector('[data-count]')
let cards = [...grid.querySelectorAll('.pcard')]
let current = 'all'

// le schede salgono a gruppi entrando nello schermo (anche quelle aggiunte dopo)
const reveal = rise(cards, { stagger: 0.07, after: ready })

function setCount() {
  const n = cards.filter((c) => !c.classList.contains('is-out')).length
  countEl.textContent = `${pad(n)} / ${pad(cards.length)} ${tp(cards.length, 'prodotto', 'prodotti')}`
}

// ---------------------------------------------------------------------------
// Filtri per formato (sottocategorie di WooCommerce, se ci sono): le schede si ridispongono scivolando
function renderFilters(categories, total) {
  const options = [['all', t('Tutti'), total], ...categories.map((c) => [String(c.id), t(c.name), c.count])]
  filters.innerHTML = options
    .map(
      ([key, label, n]) =>
        `<button class="chip mono" type="button" data-filter="${esc(key)}" aria-pressed="${key === current}">${esc(label)}<span class="chip__n">${pad(n)}</span></button>`,
    )
    .join('')
  filters.hidden = categories.length < 2
}

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]')
  if (!btn || btn.dataset.filter === current) return
  current = btn.dataset.filter
  filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
  const state = Flip.getState(cards)
  cards.forEach((c) => c.classList.toggle('is-out', current !== 'all' && !c.dataset.cats.split(',').includes(current)))
  setCount()
  if (reduced) return
  Flip.from(state, {
    duration: 0.75,
    ease: 'expo.inOut',
    absolute: true,
    onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'power3.out', delay: 0.15 }),
    onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.92, duration: 0.35, ease: 'power2.in' }),
  })
})

// ---------------------------------------------------------------------------
const toElement = (html) => {
  const tpl = document.createElement('template')
  tpl.innerHTML = html.trim()
  return tpl.content.firstElementChild
}

/**
 * Scheda gia' nella pagina -> dati di WooCommerce. Si cambia solo quello che e' diverso (testi, bollini,
 * disponibilita'): la scheda resta la stessa (animazione d'ingresso intatta) e la foto non si ricarica.
 */
function patch(el, fresh) {
  el.classList.toggle('is-soldout', fresh.classList.contains('is-soldout'))
  el.dataset.cats = fresh.dataset.cats
  for (const sel of ['.pcard__body', '.badges', '.pcard__idx']) {
    const a = el.querySelector(sel)
    const b = fresh.querySelector(sel)
    if (a && b && a.outerHTML !== b.outerHTML) a.replaceWith(b)
  }
  const a = el.querySelector('.pcard__img')
  const b = fresh.querySelector('.pcard__img')
  if (a && b && a.getAttribute('src') !== b.getAttribute('src')) a.replaceWith(b)
}

function showEmpty() {
  grid.innerHTML = `<li class="alert" style="grid-column: 1 / -1"><p class="alert__title">${t('Presto disponibili')}</p><p class="alert__text">${t('I prodotti saranno pubblicati a breve.')}</p></li>`
  cards = []
}

/*
  Lingua del sito (src/i18n): le schede si riscrivono nella lingua scelta, con i dati di WooCommerce se
  sono gia' arrivati, altrimenti con quelli del catalogo del sito (le stesse schede gia' nella pagina).
*/
let lastData = null

/** Schede gia' nella pagina (senza i dati di WooCommerce) nella lingua del sito. */
function renderStatic() {
  cards.forEach((el, i) => {
    const slug = el.id.replace(/^p-/, '')
    const c = catalogProduct(slug)
    if (!c || !CATALOG.some((p) => p.slug === slug)) return
    const p = { id: slug, slug, name: c.name, summary: c.summary, type: 'simple', images: [], categories: [], stock: null }
    patch(el, toElement(productCard(p, i, [])))
  })
}

async function load() {
  grid.setAttribute('aria-busy', 'true')
  try {
    const data = (lastData = await api.products({ per_page: 48 }))
    render(data)
  } catch {
    // WooCommerce non risponde: restano le schede della pagina (senza disponibilita'), tutte cliccabili
  } finally {
    grid.setAttribute('aria-busy', 'false')
    if (cards.length) setCount()
  }
}

/** Schede e filtri dai dati di WooCommerce, nella lingua del sito. */
function render(data) {
  const categories = formatFilters(data.categories ?? []).map((c) => ({ ...c, name: t(c.name) }))
  const products = data.products.filter(belongs).map(localizeProduct)
  if (!products.length) {
    showEmpty()
  } else {
    const next = products.map((p, i) => {
      const fresh = toElement(productCard(p, i, categories))
      const old = cards.find((c) => c.id === fresh.id)
      if (old) {
        patch(old, fresh)
        return old
      }
      reveal.observe(fresh)
      return fresh
    })
    cards.filter((c) => !next.includes(c)).forEach((c) => c.remove())
    next.forEach((el) => grid.appendChild(el)) // ordine del pannello di WooCommerce
    cards = next
  }
  renderFilters(categories, cards.length)
}

if (lang() !== 'it') renderStatic()
load()
onLang(() => {
  if (lastData) render(lastData)
  else renderStatic()
  if (cards.length) setCount()
})

// carrello sempre a portata in basso
initDock()

// ingresso: con i titoli si disegna il filetto, poi strumenti, testi e domande frequenti salgono entrando in scena
if (!reduced) gsap.set('[data-rule]', { scaleX: 0 })
rise(document.querySelectorAll('.toolbar > *'), { y: 24, after: ready })
rise(document.querySelectorAll('[data-rise]'), { y: 30, stagger: 0.06, after: ready })
ready.then(() => {
  if (!reduced) gsap.to('[data-rule]', { scaleX: 1, duration: 1.6, ease: 'expo.inOut', delay: 0.3 })
})
