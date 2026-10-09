import gsap from 'gsap'
import { initPage, rise, reduced } from './common.js'
import { api } from '../shop/api.js'
import { cart } from '../shop/cart.js'
import { money } from '../shop/money.js'
import { colorVars, productUrl, pieces, esc } from '../shop/themes.js'
import { t, onLang } from '../i18n/index.js'
import { localizeCartItem, localizeProduct } from '../i18n/data.js'

/*
  Carrello: e' il carrello di WooCommerce (prezzi, sconti, coupon, limiti di stock calcolati da
  WooCommerce). Righe con le foto nei colori del prodotto, quantita' (- numero +), rimozione animata,
  codice sconto e riepilogo. "Procedi al pagamento" porta al checkout di WooCommerce con gli stessi
  prodotti. Si aggiorna anche se il carrello cambia in un'altra scheda.
  Nella lingua del sito (src/i18n): nomi dei prodotti e messaggi tradotti; cambiando lingua le righe si
  rifanno (senza animazione) e il riepilogo si riscrive.
*/

const { ready } = initPage()

const loadingEl = document.querySelector('[data-loading]')
const errorEl = document.querySelector('[data-error]')
const cartEl = document.querySelector('[data-cart]')
const emptyEl = document.querySelector('[data-empty]')
const linesEl = document.querySelector('[data-lines]')
const totalsEl = document.querySelector('[data-totals]')
const piecesEl = document.querySelector('[data-cart-pieces]')
const picksEl = document.querySelector('[data-picks]')
const couponForm = document.querySelector('[data-coupon]')
const couponMsg = document.querySelector('[data-coupon-msg]')
const couponsEl = document.querySelector('[data-coupons]')
const checkoutBtn = document.querySelector('[data-checkout]')
const checkoutMsg = document.querySelector('[data-checkout-msg]')
const rows = new Map()
let entered = false
let pending = null // ultimo - o + premuto: direzione dell'animazione del numero
let relabel = false // righe rifatte per il cambio di lingua: senza animazione d'ingresso

const ICON = {
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12h11"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v11M6.5 12h11"/></svg>',
  x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>',
}

// ---------------------------------------------------------------------------
// Righe
function createRow(raw) {
  const item = localizeCartItem(raw)
  const name = esc(item.name)
  const row = document.createElement('article')
  row.className = 'cline'
  row.dataset.key = item.key
  row.style.cssText = colorVars(item.slug)
  const details = [...item.variation.map((v) => t(v.value)), item.sku ? t('Cod. {codice}', { codice: item.sku }) : ''].filter(Boolean)
  row.innerHTML = `
    <a class="thumb cline__media" href="${productUrl(item.slug)}" aria-label="${name}">
      ${item.image ? `<img src="${esc(item.image.src)}" alt="${esc(item.image.alt || item.name)}" width="800" height="1000" decoding="async" />` : ''}
    </a>
    <div class="cline__info">
      ${details.length ? `<p class="mono cline__form">${details.map(esc).join(' &middot; ')}</p>` : ''}
      <h3 class="display cline__name"><a href="${productUrl(item.slug)}">${name}</a></h3>
      <p class="cline__meta" data-unit></p>
      <button class="mono cline__remove" type="button" data-remove aria-label="${esc(t('Rimuovi {nome} dal carrello', { nome: item.name }))}">${ICON.x} ${t('Rimuovi')}</button>
    </div>
    <div class="cline__qty qty" role="group" aria-label="${esc(t('Quantità di {nome}', { nome: item.name }))}"${item.limits.editable ? '' : ' hidden'}>
      <button class="icon-btn" type="button" data-step="-1" aria-label="${esc(t('Una confezione in meno'))}">${ICON.minus}</button>
      <span class="qty__n" aria-live="polite"><span></span></span>
      <button class="icon-btn" type="button" data-step="1" aria-label="${esc(t('Una confezione in più'))}">${ICON.plus}</button>
    </div>
    <div class="cline__price" data-line-price></div>`
  rows.set(item.key, row)
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

function updateRow(row, item, currency, dir = 0) {
  setQty(row, item.quantity, dir)
  row.querySelector('[data-step="-1"]').disabled = item.quantity <= item.limits.min
  row.querySelector('[data-step="1"]').disabled = item.quantity >= item.limits.max
  const sale = item.prices.price < item.prices.regular
  row.querySelector('[data-unit]').innerHTML =
    t('{prezzo} cad.', { prezzo: money(item.prices.price, currency) }) +
    (sale ? ` <del class="amount amount--old">${money(item.prices.regular, currency)}</del>` : '') +
    (item.lowStock ? ` &middot; <span class="stock stock--low mono">${t('Solo {n} disponibili', { n: item.lowStock })}</span>` : '')
  const discounted = item.totals.total < item.totals.subtotal
  row.querySelector('[data-line-price]').innerHTML =
    `<p class="price"><b>${money(item.totals.total, currency)}</b></p>` +
    (discounted ? `<small class="mono"><del>${money(item.totals.subtotal, currency)}</del></small>` : '')
}

function removeRow(row) {
  rows.delete(row.dataset.key)
  if (reduced) return row.remove()
  const h = row.offsetHeight
  gsap
    .timeline({ onComplete: () => row.remove() })
    .to(row, { autoAlpha: 0, x: -40, duration: 0.35, ease: 'power2.in' })
    .fromTo(row, { height: h }, { height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, duration: 0.5, ease: 'power3.inOut' }, 0.18)
}

// ---------------------------------------------------------------------------
// Riepilogo
function renderTotals(c) {
  const cur = c.totals.currency
  const products = c.totals.items
  // sconti di WooCommerce sui prodotti (offerte quantita', prezzi in offerta): la differenza tra prezzo pieno e prezzo pagato
  const saved = c.items.reduce((s, i) => s + Math.max(0, (i.prices.regular ?? 0) - (i.prices.price ?? 0)) * i.quantity, 0)
  const out = [`<div><dt>${t('Prodotti ({pezzi})', { pezzi: pieces(c.count) })}</dt><dd>${money(products + saved, cur)}</dd></div>`]
  if (saved > 0) out.push(`<div class="summary__off"><dt>${t('Sconto sui prodotti')}</dt><dd>${money(-saved, cur)}</dd></div>`)
  if (c.totals.discount > 0) out.push(`<div class="summary__off"><dt>${t('Codice sconto')}</dt><dd>${money(-c.totals.discount, cur)}</dd></div>`)
  out.push(`<div><dt>${t('Spedizione')}</dt><dd><span class="soon">${t('Al pagamento')}</span></dd></div>`)
  out.push(`<div class="summary__total"><dt>${t('Totale')}</dt><dd>${money(products - c.totals.discount, cur)}</dd></div>`)
  totalsEl.innerHTML = out.join('')
  couponsEl.innerHTML = c.coupons
    .map(
      (co) =>
        `<span class="mono coupon-tag">${esc(co.code)} &minus;${money(co.discount, cur)}<button type="button" data-remove-coupon="${esc(co.code)}" aria-label="${esc(t('Togli il codice {codice}', { codice: co.code }))}">&times;</button></span>`,
    )
    .join('')
  piecesEl.textContent = pieces(c.count)
}

// ---------------------------------------------------------------------------
let wasEmpty = null

function render() {
  const c = cart.state
  if (!c) return
  loadingEl.hidden = true
  errorEl.hidden = true
  const empty = c.items.length === 0
  if (empty !== wasEmpty) {
    cartEl.hidden = empty
    emptyEl.hidden = !empty
    if (wasEmpty !== null && !reduced) {
      gsap.fromTo(empty ? emptyEl : cartEl, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', clearProps: 'transform' })
    }
    wasEmpty = empty
    if (empty) loadPicks()
  }
  for (const row of [...rows.values()]) if (!c.items.some((i) => i.key === row.dataset.key)) removeRow(row)
  for (const item of c.items) {
    let row = rows.get(item.key)
    if (!row) {
      row = createRow(item)
      linesEl.appendChild(row)
      updateRow(row, item, c.totals.currency)
      if (entered && !reduced && !relabel) gsap.fromTo(row, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' })
    } else {
      updateRow(row, item, c.totals.currency, pending && pending.key === item.key ? pending.dir : 0)
    }
  }
  pending = null
  renderTotals(c)
  checkoutMsg.textContent = c.errors[0]?.message ? t(c.errors[0].message) : ''
  checkoutBtn.disabled = c.errors.length > 0
}

linesEl.addEventListener('click', async (e) => {
  const row = e.target.closest('.cline')
  if (!row) return
  const key = row.dataset.key
  const item = cart.state?.items.find((i) => i.key === key)
  if (!item) return
  const step = e.target.closest('[data-step]')
  try {
    if (step) {
      const dir = Number(step.dataset.step)
      pending = { key, dir }
      await cart.update(key, item.quantity + dir * (item.limits.step || 1))
    } else if (e.target.closest('[data-remove]')) {
      await cart.remove(key)
    }
  } catch (err) {
    checkoutMsg.textContent = t(err.message)
  }
})

couponForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = couponForm.elements.code
  const code = input.value.trim()
  if (!code) return
  couponMsg.textContent = ''
  try {
    await cart.coupon(code)
    input.value = ''
  } catch (err) {
    couponMsg.textContent = t(err.message)
  }
})

couponsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-coupon]')
  if (btn) cart.removeCoupon(btn.dataset.removeCoupon).catch((err) => (couponMsg.textContent = t(err.message)))
})

// al pagamento: il checkout di WooCommerce con gli stessi prodotti
checkoutBtn.addEventListener('click', async () => {
  const label = checkoutBtn.querySelector('.btn__label')
  checkoutBtn.classList.add('is-busy')
  label.textContent = t('Ti porto al pagamento…')
  checkoutMsg.textContent = ''
  try {
    const { url } = await api.checkoutUrl()
    window.location.assign(url)
  } catch (err) {
    checkoutBtn.classList.remove('is-busy')
    label.textContent = t('Procedi al pagamento')
    checkoutMsg.textContent = t(err.message)
  }
})

// ---------------------------------------------------------------------------
// Carrello vuoto: i primi prodotti del negozio
let picksLoaded = false
let picks = null

function renderPicks() {
  picksEl.innerHTML = (picks ?? [])
    .map(localizeProduct)
    .map(
      (p) => `<a class="pick" href="${productUrl(p.slug)}" style="${colorVars(p.slug)}">
          <span class="thumb">${p.images[0] ? `<img src="${esc(p.images[0].src)}" alt="" width="800" height="1000" loading="lazy" decoding="async" />` : ''}</span>
          <span class="pick__name">${esc(p.name)}<small class="mono">${t('Scopri')} &rarr;</small></span>
        </a>`,
    )
    .join('')
}

async function loadPicks() {
  if (picksLoaded) return
  picksLoaded = true
  try {
    picks = (await api.products({ per_page: 3 })).products
    renderPicks()
    if (!reduced) gsap.fromTo(picksEl.children, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 })
  } catch {
    picksEl.hidden = true
  }
}

let lastError = null
function showError(err) {
  lastError = err
  loadingEl.hidden = true
  errorEl.hidden = false
  errorEl.innerHTML = `<p class="alert__title">${t('Carrello non disponibile')}</p><p class="alert__text">${esc(t(err.message))}</p><button class="btn btn--sm" type="button" data-retry><span class="btn__label">${t('Riprova')}</span><span class="btn__icon" aria-hidden="true">&#8635;</span></button>`
  errorEl.querySelector('[data-retry]').addEventListener('click', () => {
    lastError = null
    errorEl.hidden = true
    loadingEl.hidden = false
    start()
  })
}

cart.subscribe(render)

// cambio di lingua: righe rifatte nella nuova lingua (stessi prodotti, senza animazione), riepilogo e consigli
onLang(() => {
  if (lastError && !errorEl.hidden) showError(lastError)
  if (picks) renderPicks()
  if (!cart.state) return
  for (const row of rows.values()) row.remove()
  rows.clear()
  relabel = true
  render()
  relabel = false
})

function start() {
  cart
    .load()
    .then(() => {
      if (entered) return
      rise([...rows.values(), document.querySelector('.summary')], { y: 40, stagger: 0.08, after: ready })
      ready.then(() => (entered = true))
    })
    .catch(showError)
}
start()
