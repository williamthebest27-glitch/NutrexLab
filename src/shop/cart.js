import { api } from './api.js'

/*
  Carrello nel browser: e' una vista del carrello di WooCommerce (Store API), che resta l'unico
  carrello vero. La sessione la tiene il server del negozio in un cookie httpOnly; qui c'e' solo
  l'ultimo stato ricevuto, per disegnare le pagine.

  cart.state    ultimo carrello ricevuto da WooCommerce (null finche' non lo si chiede)
  cart.count    quanti prodotti: dal cookie nx_count, subito, senza chiedere a WooCommerce
  cart.load() / add(id, qty) / update(key, qty) / remove(key) / coupon(code) / removeCoupon(code) / clear()
  cart.subscribe(fn(change))  a ogni cambiamento (anche da un'altra scheda)

  [data-cart-count] mostra quanti prodotti ci sono (nascosto a zero, tranne data-cart-count="always").
*/

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('nutrex-cart') : null
const subs = new Set()
let state = null
let queue = Promise.resolve()

function cookieCount() {
  const m = /(?:^|;\s*)nx_count=(\d+)/.exec(document.cookie)
  return m ? Number(m[1]) : 0
}

function emit(change) {
  for (const fn of subs) fn(change)
}

function apply(next, change) {
  state = next
  emit(change)
  if (change.type !== 'load' && change.type !== 'sync') channel?.postMessage({ type: 'changed' })
  return next
}

/** Le operazioni sul carrello vanno a WooCommerce una alla volta, nell'ordine in cui arrivano. */
function serial(task) {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

const act = (type, action, payload) => serial(async () => apply((await api.cartAction(action, payload)).cart, { type, ...payload }))

export const cart = {
  get state() {
    return state
  },
  get count() {
    return state ? state.count : cookieCount()
  },
  load: () => serial(async () => apply((await api.cart()).cart, { type: 'load' })),
  add: (id, quantity = 1) => act('add', 'add', { id, quantity }),
  update: (key, quantity) => act('update', 'update', { key, quantity }),
  remove: (key) => act('remove', 'remove', { key }),
  coupon: (code) => act('coupon', 'coupon', { code }),
  removeCoupon: (code) => act('coupon', 'remove-coupon', { code }),
  clear: () => act('clear', 'clear', {}),
  /** Stato arrivato da un'altra risposta (es. checkout). */
  set: (next) => apply(next, { type: 'sync' }),
  subscribe(fn) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
}

// un'altra scheda ha cambiato il carrello: si aggiorna lo stato (se la pagina lo usa) e i numeri
channel?.addEventListener('message', () => {
  if (state) cart.load().catch(() => {})
  else emit({ type: 'sync' })
})
// tornando su una scheda (o con il tasto indietro) i numeri si rileggono dal cookie
document.addEventListener('visibilitychange', () => !document.hidden && emit({ type: 'sync' }))
window.addEventListener('pageshow', (e) => e.persisted && emit({ type: 'sync' }))

/** Tiene aggiornati i numeri del carrello nella pagina ([data-cart-count]). */
export function bindCartCount() {
  const update = (bump) => {
    const n = cart.count
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      const text = n > 99 ? '99+' : String(n)
      const changed = el.textContent !== text
      el.textContent = text
      if (el.dataset.cartCount !== 'always') el.hidden = n === 0
      if (bump && changed && n > 0 && !el.hidden) {
        el.classList.remove('is-bump')
        void el.offsetWidth // riparte l'animazione
        el.classList.add('is-bump')
      }
    })
  }
  update(false)
  cart.subscribe((change) => update(change.type === 'add'))
}
