import gsap from 'gsap'
import { initPage, rise, reduced, esc } from './common.js'
import { itemById, colorVars, money, totals } from '../shop/catalog.js'
import { cart } from '../shop/cart.js'
import { SHOP } from '../shop/config.js'

/*
  Pagamenti: contatti, spedizione e metodo di pagamento, con il riepilogo dell'ordine accanto.
  Finche' il pagamento online non e' collegato (SHOP.payments.active) nessun dato viene inviato:
  il pulsante resta "Pagamento in arrivo" e l'avviso in alto lo spiega. I dati scritti nel modulo
  restano solo nella pagina.
*/

const { ready } = initPage()

const checkout = document.querySelector('[data-checkout]')
const emptyEl = document.querySelector('[data-empty]')
const form = document.querySelector('[data-form]')
const methodsEl = document.querySelector('[data-methods]')
const miniEl = document.querySelector('[data-mini]')
const totalsEl = document.querySelector('[data-totals]')
const payBtn = document.querySelector('[data-pay]')
const steps = [...document.querySelectorAll('.steps .step')]

const ICONS = {
  carta: '<svg viewBox="0 0 24 24"><rect x="3" y="5.5" width="18" height="13" rx="2.6"/><path d="M3 10.2h18M6.8 14.8h4.4"/></svg>',
  paypal: '<svg viewBox="0 0 24 24"><path d="M4.5 8V7a2 2 0 0 1 2-2H17v3"/><rect x="4.5" y="8" width="15" height="11" rx="2.4"/><path d="M15.4 13.5h1.6"/></svg>',
  bonifico: '<svg viewBox="0 0 24 24"><path d="M3.5 9.4 12 4.6l8.5 4.8"/><path d="M5.5 10.4v7M9.8 10.4v7M14.2 10.4v7M18.5 10.4v7M3.5 19.4h17"/></svg>',
}

// ---------------------------------------------------------------------------
// Metodi di pagamento
methodsEl.innerHTML = SHOP.payments.methods
  .map(
    (m, i) => `<label class="method">
      <input type="radio" name="metodo" value="${esc(m.id)}"${i === 0 ? ' checked' : ''} />
      <span class="method__top"><span class="method__icon" aria-hidden="true">${ICONS[m.id] ?? ICONS.carta}</span><span class="method__radio" aria-hidden="true"></span></span>
      <span class="method__name">${esc(m.name)}</span>
      <span class="method__note">${esc(m.note)}</span>
      ${SHOP.payments.active ? '' : '<span class="mono method__tag">In attivazione</span>'}
    </label>`,
  )
  .join('')

if (!SHOP.payments.active) {
  payBtn.disabled = true
  payBtn.querySelector('.btn__label').textContent = 'Pagamento in arrivo'
  payBtn.querySelector('.btn__icon').hidden = true
} else {
  document.querySelector('[data-notice]')?.remove()
  document.querySelector('[data-pay-note]')?.remove()
}

// ---------------------------------------------------------------------------
// Riepilogo dell'ordine
const soon = (text) => `<span class="soon">${text}</span>`

function render() {
  const lines = cart.items
  const empty = lines.length === 0
  checkout.hidden = empty
  emptyEl.hidden = !empty
  miniEl.innerHTML = lines
    .map((l) => {
      const it = itemById(l.id)
      return `<div class="mini__line" style="${colorVars(it)}">
        <span class="thumb"><img src="${it.image}" alt="" width="800" height="1000" decoding="async" /><span class="mini__qty">${l.qty}</span></span>
        <p class="mini__name">${esc(it.name)}<small>${esc(it.detail || it.formLabel)}</small></p>
        <p class="mini__price">${it.price != null ? money(it.price * l.qty) : soon('In arrivo')}</p>
      </div>`
    })
    .join('')
  const t = totals(lines)
  const shipping = t.shipping == null ? soon('Da definire') : t.shipping === 0 ? 'Gratuita' : money(t.shipping)
  totalsEl.innerHTML =
    `<div><dt>Subtotale</dt><dd>${t.subtotal == null ? soon('Prezzi in arrivo') : money(t.subtotal)}</dd></div>` +
    `<div><dt>Spedizione${SHOP.shipping.time ? ` <small>(${esc(SHOP.shipping.time)})</small>` : ''}</dt><dd>${shipping}</dd></div>` +
    `<div class="summary__total"><dt>Totale</dt><dd>${t.total == null ? soon('In arrivo') : money(t.total)}</dd></div>`
}
render()
cart.subscribe(render)

// ---------------------------------------------------------------------------
// Controllo dei campi: all'uscita da un campo compilato, poi mentre si corregge
const RULES = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  nome: (v) => v.trim().length > 1,
  cognome: (v) => v.trim().length > 1,
  indirizzo: (v) => v.trim().length > 3,
  cap: (v) => /^\d{5}$/.test(v.trim()),
  provincia: (v) => /^[a-z]{2}$/i.test(v.trim()),
  citta: (v) => v.trim().length > 1,
}
const fields = Object.keys(RULES).map((name) => form.elements[name])

function check(input) {
  const ok = RULES[input.name](input.value)
  input.closest('.field').classList.toggle('is-invalid', !ok)
  input.setAttribute('aria-invalid', String(!ok))
  return ok
}

/** Con tutti i dati validi il passaggio 02 e' completo e si accende il 03. */
function progress() {
  const done = fields.every((f) => RULES[f.name](f.value))
  steps[1].classList.toggle('is-done', done)
  steps[1].classList.toggle('is-active', !done)
  steps[2].classList.toggle('is-active', done)
}

form.addEventListener('focusout', (e) => {
  if (e.target.name in RULES && e.target.value) check(e.target)
})
form.addEventListener('input', (e) => {
  const el = e.target
  if (el.name === 'provincia') el.value = el.value.replace(/[^a-z]/gi, '').toUpperCase()
  if (el.name === 'cap') el.value = el.value.replace(/\D/g, '')
  if (el.closest('.field')?.classList.contains('is-invalid')) check(el)
  progress()
})
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const bad = fields.filter((f) => !check(f))
  if (bad.length) {
    bad[0].focus()
    return
  }
  // (pagamento attivo) qui si passa al circuito di pagamento scelto: vedi README, "Negozio"
})

// ---------------------------------------------------------------------------
// ingresso: modulo e riepilogo, o il carrello vuoto, nascosti da subito e saliti con i titoli (si
// preparano entrambi: il carrello puo' cambiare da un'altra scheda e mostrare l'altro)
rise(form.querySelectorAll('.notice, [data-rise]'), { y: 40, stagger: 0.08, after: ready })
rise([document.querySelector('.summary')], { y: 40, after: ready })
rise(emptyEl.children, { y: 30, stagger: 0.07, after: ready })
if (!reduced) gsap.set('.steps .step__line', { scaleX: 0 })
ready.then(() => {
  if (!reduced) gsap.to('.steps .step__line', { scaleX: 1, duration: 1, ease: 'expo.inOut', stagger: 0.15, delay: 0.5 })
})
