import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { initPage, rise, reduced } from './common.js'
import { api } from '../shop/api.js'
import { initDock } from './dock.js'
import { colorVars, productUrl, pad, esc, availability } from '../shop/themes.js'
import { discountPercent } from '../shop/money.js'

gsap.registerPlugin(Flip)

/*
  Acquista: i prodotti pubblicati in WooCommerce (nell'ordine scelto nel pannello), con i colori del
  sito per i prodotti della linea. Niente prezzi qui: si vedono nella pagina del prodotto, dove si
  sceglie la variante e si aggiunge al carrello.
*/

const { ready } = initPage()

const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'
const grid = document.querySelector('[data-grid]')
const swatches = document.querySelector('[data-swatches]')
const filters = document.querySelector('[data-filters]')
const countEl = document.querySelector('[data-count]')
let cards = []
let current = 'all'

// ---------------------------------------------------------------------------
// Schede
function badges(p, categories) {
  const out = []
  const cat = p.categories.find((c) => categories.some((k) => k.id === c.id))
  if (cat) out.push(`<span class="mono badge">${esc(cat.name)}</span>`)
  if (!p.stock.inStock) out.push('<span class="mono badge badge--out">Esaurito</span>')
  else if (p.onSale) {
    const off = p.type === 'variable' ? 0 : discountPercent(p.prices)
    out.push(`<span class="mono badge badge--sale">${off ? `−${off}%` : 'Offerta'}</span>`)
  } else if (p.stock.low) out.push('<span class="mono badge badge--low">Ultimi pezzi</span>')
  return `<span class="badges">${out.join('')}</span>`
}

function card(p, i, categories) {
  const name = esc(p.name)
  const url = productUrl(p.slug)
  const img = p.images[0]
  const stock = availability(p.stock)
  const picture = img
    ? `<img class="pcard__img" src="${esc(img.src)}"${img.srcset ? ` srcset="${esc(img.srcset)}" sizes="(max-width: 767px) 46vw, (max-width: 1240px) 30vw, 22vw"` : ''} alt="${esc(img.alt || p.name)}" width="800" height="1000" loading="lazy" decoding="async" />`
    : `<svg class="pcard__noimg" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>`
  return `<li class="pcard${p.stock.inStock ? '' : ' is-soldout'}" id="p-${esc(p.slug)}" data-cats="${p.categories.map((c) => c.id).join(',')}" style="${colorVars(p.slug)}">
    <a class="pcard__media" href="${url}" aria-label="${name}">
      <svg class="pcard__hex" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
      <svg class="pcard__hex pcard__hex--in" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
      <span class="pcard__floor" aria-hidden="true"></span>
      ${picture}
      <span class="mono pcard__idx" aria-hidden="true">${pad(i + 1)}</span>
      ${badges(p, categories)}
    </a>
    <div class="pcard__body">
      <h2 class="display pcard__name"><a href="${url}">${name}</a></h2>
      ${p.summary ? `<p class="pcard__line">${esc(p.summary)}</p>` : ''}
      <div class="pcard__foot">
        <p class="mono stock stock--${stock.tone}">${esc(stock.text)}</p>
        <a class="btn btn--sm pcard__cta" href="${url}">
          <span class="btn__label">Scopri</span><span class="btn__icon" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  </li>`
}

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
    swatches.innerHTML = data.products
      .map(
        (p) =>
          `<a class="swatch" href="#p-${esc(p.slug)}" style="${colorVars(p.slug)}" aria-label="${esc(p.name)}">` +
          `<svg viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>` +
          `<span class="mono swatch__tip" aria-hidden="true">${esc(p.name)}</span></a>`,
      )
      .join('')
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
