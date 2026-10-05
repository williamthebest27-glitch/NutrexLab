import gsap from 'gsap'
import { initPage, rise, reduced, esc } from './common.js'
import { CATALOG, itemById, colorVars, money, pieces, totals } from '../shop/catalog.js'
import { cart, MAX_QTY } from '../shop/cart.js'
import { SHOP } from '../shop/config.js'

/*
  Carrello: righe con foto nei colori del prodotto, quantita' (- numero +), rimozione animata e
  riepilogo sempre visibile. Si aggiorna anche se il carrello cambia in un'altra scheda.
  Vuoto: invito al negozio e un prodotto per ogni formato da aggiungere subito.
*/

const { ready } = initPage()

const cartEl = document.querySelector('[data-cart]')
const emptyEl = document.querySelector('[data-empty]')
const linesEl = document.querySelector('[data-lines]')
const totalsEl = document.querySelector('[data-totals]')
const noteEl = document.querySelector('[data-summary-note]')
const piecesEl = document.querySelector('[data-cart-pieces]')
const picksEl = document.querySelector('[data-picks]')
const rows = new Map()
let entered = false // dopo l'ingresso le righe nuove entrano con la loro animazione
let pending = null // ultimo - o + premuto: direzione dell'animazione del numero

const ICON = {
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12h11"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v11M6.5 12h11"/></svg>',
  x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>',
}

// ---------------------------------------------------------------------------
// Righe
function createRow(id) {
  const item = itemById(id)
  const name = esc(item.name)
  const row = document.createElement('article')
  row.className = 'cline'
  row.dataset.id = id
  row.style.cssText = colorVars(item)
  row.innerHTML = `
    <a class="thumb cline__media" href="${item.href}" aria-label="Scopri ${name}">
      <img src="${item.image}" alt="Barattolo di ${name} Nutrex Lab" width="800" height="1000" decoding="async" />
    </a>
    <div class="cline__info">
      <p class="mono cline__form">${esc(item.formLabel)}${item.detail ? ` &middot; ${esc(item.detail)}` : ''}</p>
      <h3 class="display cline__name">${name}</h3>
      <p class="cline__meta">${item.pack.map(esc).join(' &middot; ')}</p>
      <button class="mono cline__remove" type="button" data-remove aria-label="Rimuovi ${name} dal carrello">${ICON.x} Rimuovi</button>
    </div>
    <div class="cline__qty qty" role="group" aria-label="Quantit&agrave; di ${name}">
      <button class="icon-btn" type="button" data-step="-1" aria-label="Una confezione in meno">${ICON.minus}</button>
      <span class="qty__n" aria-live="polite"><span></span></span>
      <button class="icon-btn" type="button" data-step="1" aria-label="Una confezione in piu'">${ICON.plus}</button>
    </div>
    <div class="cline__price" data-line-price></div>`
  rows.set(id, row)
  return row
}

/** Numero della quantita': il vecchio esce, il nuovo entra (su se aumenta, giu' se cala). */
function setQty(row, qty, dir) {
  const box = row.querySelector('.qty__n')
  const cur = box.lastElementChild
  if (cur.textContent === String(qty)) return
  if (reduced || !dir || !cur.textContent) {
    cur.textContent = qty
    return
  }
  const next = document.createElement('span')
  next.textContent = qty
  box.appendChild(next)
  gsap.fromTo(next, { yPercent: 100 * dir }, { yPercent: 0, duration: 0.5, ease: 'expo.out' })
  gsap.to(cur, { yPercent: -100 * dir, duration: 0.5, ease: 'expo.out', onComplete: () => cur.remove() })
}

function updateRow(row, line, dir = 0) {
  const item = itemById(line.id)
  setQty(row, line.qty, dir)
  row.querySelector('[data-step="-1"]').disabled = line.qty <= 1
  row.querySelector('[data-step="1"]').disabled = line.qty >= MAX_QTY
  const price = row.querySelector('[data-line-price]')
  price.innerHTML =
    item.price != null
      ? `<p class="price"><b>${money(item.price * line.qty)}</b></p>${line.qty > 1 ? `<small class="mono">${money(item.price)} cad.</small>` : ''}`
      : '<p class="mono price price--soon">Prezzo in arrivo</p>'
}

function removeRow(row) {
  rows.delete(row.dataset.id)
  if (reduced) return row.remove()
  const h = row.offsetHeight
  gsap
    .timeline({ onComplete: () => row.remove() })
    .to(row, { autoAlpha: 0, x: -40, duration: 0.35, ease: 'power2.in' })
    .fromTo(
      row,
      { height: h },
      { height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, duration: 0.5, ease: 'power3.inOut' },
      0.18,
    )
}

// ---------------------------------------------------------------------------
// Riepilogo
const soon = (text) => `<span class="soon">${text}</span>`

function renderTotals() {
  const t = totals(cart.items)
  const shipping = t.shipping == null ? soon('Da definire') : t.shipping === 0 ? 'Gratuita' : money(t.shipping)
  totalsEl.innerHTML =
    `<div><dt>Prodotti</dt><dd>${pieces(t.count)}</dd></div>` +
    `<div><dt>Subtotale</dt><dd>${t.subtotal == null ? soon('Prezzi in arrivo') : money(t.subtotal)}</dd></div>` +
    `<div><dt>Spedizione</dt><dd>${shipping}</dd></div>` +
    `<div class="summary__total"><dt>Totale</dt><dd>${t.total == null ? soon('In arrivo') : money(t.total)}</dd></div>`
  const free = SHOP.shipping.freeFrom
  noteEl.textContent =
    t.subtotal == null
      ? 'I prezzi saranno pubblicati a breve: il totale si aggiornerà da solo.'
      : free != null && t.subtotal < free
        ? `Ti mancano ${money(free - t.subtotal)} per la spedizione gratuita.`
        : ''
  noteEl.hidden = !noteEl.textContent
  piecesEl.textContent = pieces(t.count)
}

// ---------------------------------------------------------------------------
let wasEmpty = null

function render(change = { type: 'init' }) {
  const lines = cart.items
  const empty = lines.length === 0

  if (empty !== wasEmpty) {
    cartEl.hidden = empty
    emptyEl.hidden = !empty
    if (wasEmpty !== null && !reduced) {
      // passaggio tra carrello pieno e vuoto: la parte nuova sale
      gsap.fromTo(empty ? emptyEl : cartEl, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', clearProps: 'transform' })
    }
    wasEmpty = empty
  }

  for (const row of [...rows.values()]) {
    if (!lines.some((l) => l.id === row.dataset.id)) removeRow(row)
  }
  for (const line of lines) {
    let row = rows.get(line.id)
    if (!row) {
      row = createRow(line.id)
      linesEl.appendChild(row)
      updateRow(row, line)
      if (entered && !reduced) gsap.fromTo(row, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' })
    } else {
      updateRow(row, line, change.id === line.id ? change.dir ?? 0 : 0)
    }
  }
  renderTotals()
}

linesEl.addEventListener('click', (e) => {
  const row = e.target.closest('.cline')
  if (!row) return
  const id = row.dataset.id
  const step = e.target.closest('[data-step]')
  if (step) {
    const dir = Number(step.dataset.step)
    pending = { id, dir }
    cart.set(id, cart.qty(id) + dir)
  } else if (e.target.closest('[data-remove]')) {
    cart.remove(id)
  }
})

cart.subscribe((change) => {
  const dir = pending && pending.id === change.id ? pending.dir : 0
  pending = null
  render({ ...change, dir })
})

// ---------------------------------------------------------------------------
// Carrello vuoto: un prodotto per ogni formato (polvere, compresse, capsule)
const picks = ['powder', 'tablet', 'capsule'].map((f) => CATALOG.find((x) => x.form === f)).filter(Boolean)
picksEl.innerHTML = picks
  .map(
    (item) => `<div class="pick" style="${colorVars(item)}">
      <a class="thumb" href="/acquista#p-${item.id}" aria-label="${esc(item.name)} nel negozio">
        <img src="${item.image}" alt="" width="800" height="1000" loading="lazy" decoding="async" />
      </a>
      <p class="pick__name">${esc(item.name)}<small class="mono">${esc(item.formLabel)}</small></p>
      <button class="btn btn--sm" type="button" data-pick="${item.id}" aria-label="Aggiungi ${esc(item.name)} al carrello">
        <span class="btn__label">Aggiungi</span><span class="btn__icon" aria-hidden="true">+</span>
      </button>
    </div>`,
  )
  .join('')
picksEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pick]')
  if (btn) cart.add(btn.dataset.pick)
})

render()

// ingresso: righe e riepilogo, o il carrello vuoto, nascosti da subito e saliti con i titoli (si
// preparano entrambi: il carrello puo' cambiare da un'altra scheda e mostrare l'altro)
rise([...rows.values(), document.querySelector('.summary')], { y: 40, stagger: 0.08, after: ready })
rise([...emptyEl.children].filter((el) => el !== picksEl), { y: 30, stagger: 0.07, after: ready })
rise(picksEl.children, { y: 40, stagger: 0.08, after: ready })
ready.then(() => (entered = true))
