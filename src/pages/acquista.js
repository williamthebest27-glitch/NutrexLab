import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { initPage, rise, reduced } from './common.js'
import { api } from '../shop/api.js'
import { initDock } from './dock.js'
import { colorVars, productUrl, pad, esc, availability } from '../shop/themes.js'
import { discountPercent } from '../shop/money.js'
import { productCard } from '../shop/card.js'

gsap.registerPlugin(Flip)

/*
  Acquista: i prodotti pubblicati in WooCommerce (nell'ordine scelto nel pannello), con i colori del
  sito per i prodotti della linea. Niente prezzi qui: si vedono nella pagina del prodotto, dove si
  sceglie la variante e si aggiunge al carrello.
*/

const { ready } = initPage()

const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'
const grid = document.querySelector('[data-grid]')
const filters = document.querySelector('[data-filters]')
const countEl = document.querySelector('[data-count]')
let cards = []
let current = 'all'

// ---------------------------------------------------------------------------
// Schede (src/shop/card.js: la stessa dei prodotti correlati nella pagina prodotto)
const card = (p, i, categories) => productCard(p, i, categories)

function skeleton(n = 8) {
  const one = `<li class="pcard pcard--skel" aria-hidden="true">
    <div class="pcard__media skel"></div>
    <div class="pcard__body"><div class="skel skel-line skel-line--title"></div><div class="skel skel-line"></div><div class="skel skel-line skel-line--short"></div></div>
  </li>`
  grid.innerHTML = one.repeat(n)
}

function showError(err) {
  grid.setAttribute('aria-busy', 'false')
  grid.innerHTML = `<li class="alert" style="grid-column: 1 / -1">
    <p class="alert__title">Prodotti non disponibili</p>
    <p class="alert__text">${esc(err?.message || 'Il negozio non risponde in questo momento.')}</p>
    <button class="btn btn--sm" type="button" data-retry><span class="btn__label">Riprova</span><span class="btn__icon" aria-hidden="true">&#8635;</span></button>
  </li>`
  grid.querySelector('[data-retry]').addEventListener('click', load)
}

// ---------------------------------------------------------------------------
// Filtri per categoria (le schede si ridispongono scivolando al loro posto)
function setCount() {
  const n = cards.filter((c) => !c.classList.contains('is-out')).length
  countEl.textContent = `${pad(n)} / ${pad(cards.length)} ${cards.length === 1 ? 'prodotto' : 'prodotti'}`
}

function renderFilters(categories, total) {
  const options = [['all', 'Tutti', total], ...categories.map((c) => [String(c.id), c.name, c.count])]
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
async function load() {
  skeleton()
  grid.setAttribute('aria-busy', 'true')
  try {
    const data = await api.products({ per_page: 48 })
    const categories = data.categories ?? []
    grid.innerHTML = data.products.map((p, i) => card(p, i, categories)).join('')
    grid.setAttribute('aria-busy', 'false')
    cards = [...grid.querySelectorAll('.pcard')]
    if (!cards.length) {
      grid.innerHTML = `<li class="alert" style="grid-column: 1 / -1"><p class="alert__title">Presto disponibili</p><p class="alert__text">I prodotti saranno pubblicati a breve.</p></li>`
    }
    renderFilters(categories, data.products.length)
    setCount()
    rise(cards, { stagger: 0.07, after: ready })
  } catch (err) {
    showError(err)
  }
}
load()

// carrello sempre a portata in basso
initDock()

// ingresso: con i titoli si disegna il filetto, poi le schede salgono a gruppi entrando nello schermo
if (!reduced) gsap.set('[data-rule]', { scaleX: 0 })
rise(document.querySelectorAll('.toolbar > *'), { y: 24, after: ready })
ready.then(() => {
  if (!reduced) gsap.to('[data-rule]', { scaleX: 1, duration: 1.6, ease: 'expo.inOut', delay: 0.3 })
})
