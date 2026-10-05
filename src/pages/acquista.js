import gsap from 'gsap'
import { Flip } from 'gsap/Flip'
import { initPage, rise, reduced, esc } from './common.js'
import { CATALOG, FORMS, colorVars, money, pad, pieces, itemById } from '../shop/catalog.js'
import { cart } from '../shop/cart.js'

gsap.registerPlugin(Flip)

/*
  Acquista: i 12 prodotti della linea (stesso ordine del menu prodotti della homepage).
  Ogni scheda ha i colori della sua etichetta; "Aggiungi" mette il prodotto nel carrello,
  la foto e il nome portano al racconto 3D del prodotto nella homepage.
*/

const { ready } = initPage()

const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'
const grid = document.querySelector('[data-grid]')
const swatches = document.querySelector('[data-swatches]')
const filters = document.querySelector('[data-filters]')
const countEl = document.querySelector('[data-count]')

// ---------------------------------------------------------------------------
// Schede
// "Idrolizzato, tipo I" -> "idrolizzato, tipo I" (sigle e numeri romani restano maiuscoli)
const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1)

function card(item) {
  const name = esc(item.name)
  const price = money(item.price)
  const dose = item.dose
    ? `<p class="pcard__dose"><b>${esc(item.dose.value)}<small>${esc(item.dose.unit)}</small></b><span>${esc(item.dose.name)}${item.dose.sub ? `, ${esc(lowerFirst(item.dose.sub))}` : ''}</span></p>`
    : ''
  return `<li class="pcard" id="p-${item.id}" data-form="${item.form}" style="${colorVars(item)}">
    <a class="pcard__media" href="${item.href}" aria-label="Scopri ${name}: il prodotto nella homepage">
      <svg class="pcard__hex" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
      <svg class="pcard__hex pcard__hex--in" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
      <span class="pcard__floor" aria-hidden="true"></span>
      <img class="pcard__img" src="${item.image}" alt="Barattolo di ${name} Nutrex Lab" width="800" height="1000" loading="lazy" decoding="async" />
      <span class="mono pcard__idx" aria-hidden="true">${pad(item.index)}</span>
      <span class="mono pcard__form">${esc(item.formLabel)}</span>
    </a>
    <div class="pcard__body">
      <div class="pcard__top">
        <h2 class="display pcard__name"><a href="${item.href}">${name}</a></h2>
        ${item.detail ? `<p class="mono pcard__note">${esc(item.detail)}</p>` : ''}
      </div>
      <p class="pcard__line">${esc(item.line)}</p>
      ${dose}
      <p class="mono pcard__pack">${item.pack.map(esc).join(' &middot; ')}</p>
      <div class="pcard__foot">
        ${price ? `<p class="price"><b>${price}</b></p>` : '<p class="mono price price--soon">Prezzo in arrivo</p>'}
        <div class="pcard__actions">
          <a class="link mono pcard__more" href="${item.href}">Scopri</a>
          <button class="btn btn--sm pcard__add" type="button" data-add="${item.id}" aria-label="Aggiungi ${name} al carrello">
            <span class="btn__label">Aggiungi</span><span class="btn__icon" aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </div>
  </li>`
}

grid.innerHTML = CATALOG.map(card).join('')
const cards = [...grid.querySelectorAll('.pcard')]

// esagoni della linea nella testata
swatches.innerHTML = CATALOG.map(
  (item) =>
    `<a class="swatch" href="#p-${item.id}" style="${colorVars(item)}" aria-label="${esc(item.name)}, ${esc(item.note)}">` +
    `<svg viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>` +
    `<span class="mono swatch__tip" aria-hidden="true">${esc(item.name)}</span></a>`,
).join('')

// ---------------------------------------------------------------------------
// Filtri per formato (le schede si ridispongono scivolando al loro posto)
const counts = CATALOG.reduce((m, x) => ((m[x.form] = (m[x.form] ?? 0) + 1), m), {})
const options = [['all', 'Tutti', CATALOG.length], ...Object.entries(FORMS).filter(([k]) => counts[k]).map(([k, v]) => [k, v, counts[k]])]
filters.innerHTML = options
  .map(
    ([key, label, n]) =>
      `<button class="chip mono" type="button" data-filter="${key}" aria-pressed="${key === 'all'}">${label}<span class="chip__n">${pad(n)}</span></button>`,
  )
  .join('')

let current = 'all'
function setCount() {
  const n = cards.filter((c) => !c.classList.contains('is-out')).length
  countEl.textContent = `${pad(n)} / ${pad(CATALOG.length)} prodotti`
}
setCount()

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-filter]')
  if (!btn || btn.dataset.filter === current) return
  current = btn.dataset.filter
  filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
  const state = Flip.getState(cards)
  cards.forEach((c) => c.classList.toggle('is-out', current !== 'all' && c.dataset.form !== current))
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
// Aggiungi al carrello
grid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add]')
  if (!btn) return
  cart.add(btn.dataset.add)
  const label = btn.querySelector('.btn__label')
  const icon = btn.querySelector('.btn__icon')
  btn.classList.add('is-added')
  label.textContent = 'Aggiunto'
  icon.textContent = '✓'
  if (!reduced) gsap.fromTo(icon, { scale: 0.3, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.6)' })
  clearTimeout(btn._reset)
  btn._reset = setTimeout(() => {
    btn.classList.remove('is-added')
    label.textContent = 'Aggiungi'
    icon.textContent = '+'
  }, 1800)
  showDock(btn.dataset.add)
})

// ---------------------------------------------------------------------------
// Carrello in basso: compare con il primo prodotto, si nasconde sopra il footer
const dock = document.querySelector('[data-dock]')
const thumbs = dock.querySelector('[data-dock-thumbs]')
const dockLabel = dock.querySelector('[data-dock-label]')
const dockWhat = dock.querySelector('[data-dock-what]')
let footerIn = false
let lastAdded = null
let labelTimer = 0

function renderDock() {
  const items = cart.items
  const n = cart.count
  const on = n > 0 && !footerIn
  dock.classList.toggle('is-on', on)
  dock.inert = !on
  thumbs.innerHTML = items
    .slice(-3)
    .map((l) => {
      const item = itemById(l.id)
      return `<span class="dock__thumb" style="${colorVars(item)}"><img src="${item.image}" alt="" loading="lazy" /></span>`
    })
    .join('')
  dockWhat.textContent = lastAdded ? `${itemById(lastAdded).name}` : pieces(n)
}

function showDock(id) {
  lastAdded = id
  dockLabel.textContent = 'Aggiunto al carrello'
  renderDock()
  dock.classList.remove('is-bump')
  void dock.offsetWidth
  dock.classList.add('is-bump')
  clearTimeout(labelTimer)
  labelTimer = setTimeout(() => {
    lastAdded = null
    dockLabel.textContent = 'Carrello'
    renderDock()
  }, 2200)
}

cart.subscribe((change) => change.type !== 'add' && renderDock())
new IntersectionObserver(([e]) => {
  footerIn = e.isIntersecting
  renderDock()
}).observe(document.querySelector('[data-footer]'))
renderDock()

// ---------------------------------------------------------------------------
// Ingresso: filetto, poi le schede salgono a gruppi entrando nello schermo
ready.then(() => {
  if (!reduced) gsap.fromTo('[data-rule]', { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.inOut', delay: 0.3 })
  rise(cards, { stagger: 0.09 })
  rise(document.querySelectorAll('.toolbar > *'), { y: 24 })
  // arrivando con #p-id (dagli esagoni o da un link) la scheda e' gia' al suo posto
})
