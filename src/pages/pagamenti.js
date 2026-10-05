import gsap from 'gsap'
import { initPage, rise, reduced } from './common.js'
import { api } from '../shop/api.js'
import { cart } from '../shop/cart.js'
import { money } from '../shop/money.js'
import { colorVars, pieces, esc } from '../shop/themes.js'

/*
  Pagamenti: riepilogo del carrello WooCommerce e passaggio al checkout sicuro del negozio
  (WooCommerce), dove il cliente inserisce i dati, sceglie la spedizione e paga con i metodi attivi.
*/

const { ready } = initPage()

const loadingEl = document.querySelector('[data-loading]')
const errorEl = document.querySelector('[data-error]')
const checkoutEl = document.querySelector('[data-checkout]')
const emptyEl = document.querySelector('[data-empty]')
const miniEl = document.querySelector('[data-mini]')
const totalsEl = document.querySelector('[data-totals]')
const couponForm = document.querySelector('[data-coupon]')
const couponMsg = document.querySelector('[data-coupon-msg]')
const couponsEl = document.querySelector('[data-coupons]')
const goBtn = document.querySelector('[data-checkout-go]')
const goMsg = document.querySelector('[data-checkout-msg]')

function render() {
  const c = cart.state
  if (!c) return
  loadingEl.hidden = true
  errorEl.hidden = true
  const empty = c.items.length === 0
  checkoutEl.hidden = empty
  emptyEl.hidden = !empty
  const cur = c.totals.currency
  miniEl.innerHTML = c.items
    .map(
      (i) => `<div class="mini__line" style="${colorVars(i.slug)}">
        <span class="thumb">${i.image ? `<img src="${esc(i.image.thumbnail || i.image.src)}" alt="" width="800" height="1000" decoding="async" />` : ''}<span class="mini__qty">${i.quantity}</span></span>
        <p class="mini__name">${esc(i.name)}<small>${esc(i.variation.map((v) => v.value).join(', '))}</small></p>
        <p class="mini__price">${money(i.totals.total, cur)}</p>
      </div>`,
    )
    .join('')
  const out = [`<div><dt>Prodotti (${pieces(c.count)})</dt><dd>${money(c.totals.items, cur)}</dd></div>`]
  if (c.totals.discount > 0) out.push(`<div><dt>Sconto</dt><dd>${money(-c.totals.discount, cur)}</dd></div>`)
  out.push('<div><dt>Spedizione</dt><dd><span class="soon">Al pagamento</span></dd></div>')
  out.push(`<div class="summary__total"><dt>Totale</dt><dd>${money(c.totals.items - c.totals.discount, cur)}</dd></div>`)
  totalsEl.innerHTML = out.join('')
  couponsEl.innerHTML = c.coupons
    .map(
      (co) =>
        `<span class="mono coupon-tag">${esc(co.code)} &minus;${money(co.discount, cur)}<button type="button" data-remove-coupon="${esc(co.code)}" aria-label="Togli il codice ${esc(co.code)}">&times;</button></span>`,
    )
    .join('')
  goMsg.textContent = c.errors[0]?.message ?? ''
  goBtn.disabled = c.errors.length > 0
}

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
    couponMsg.textContent = err.message
  }
})

couponsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-coupon]')
  if (btn) cart.removeCoupon(btn.dataset.removeCoupon).catch((err) => (couponMsg.textContent = err.message))
})

goBtn.addEventListener('click', async () => {
  const label = goBtn.querySelector('.btn__label')
  goBtn.classList.add('is-busy')
  label.textContent = 'Ti porto al pagamento…'
  goMsg.textContent = ''
  try {
    const { url } = await api.checkoutUrl()
    window.location.assign(url)
  } catch (err) {
    goBtn.classList.remove('is-busy')
    label.textContent = 'Vai al pagamento sicuro'
    goMsg.textContent = err.message
  }
})

function showError(err) {
  loadingEl.hidden = true
  errorEl.hidden = false
  errorEl.innerHTML = `<p class="alert__title">Carrello non disponibile</p><p class="alert__text">${esc(err.message)}</p><button class="btn btn--sm" type="button" data-retry><span class="btn__label">Riprova</span><span class="btn__icon" aria-hidden="true">&#8635;</span></button>`
  errorEl.querySelector('[data-retry]').addEventListener('click', () => location.reload())
}

cart.subscribe(render)
cart.load().catch(showError)

rise(document.querySelectorAll('[data-checkout] [data-rise]'), { y: 40, stagger: 0.08, after: ready })
rise(emptyEl.children, { y: 30, stagger: 0.07, after: ready })
if (!reduced) gsap.set('.steps .step__line', { scaleX: 0 })
ready.then(() => {
  if (!reduced) gsap.to('.steps .step__line', { scaleX: 1, duration: 1, ease: 'expo.inOut', stagger: 0.15, delay: 0.5 })
})
