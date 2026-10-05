import { PRODUCTS } from '../products.js'

/*
  Carrello: resta nel browser (localStorage), uguale in tutte le pagine e le schede aperte.
  [data-cart-count] mostra quanti prodotti ci sono (nascosto a zero, tranne data-cart-count="always").
*/

const KEY = 'nutrex-lab:carrello'
export const MAX_QTY = 20
const known = new Set(PRODUCTS.map((p) => p.id))
const clampQty = (q) => Math.max(1, Math.min(MAX_QTY, Math.round(Number(q)) || 1))

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    const out = []
    for (const x of raw) {
      if (!known.has(x?.id)) continue
      const same = out.find((y) => y.id === x.id)
      if (same) same.qty = clampQty(same.qty + clampQty(x.qty))
      else out.push({ id: x.id, qty: clampQty(x.qty) })
    }
    return out
  } catch {
    return []
  }
}

let items = read()
const subs = new Set()

function emit(change) {
  for (const fn of subs) fn(change)
}

function save(change) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    // archiviazione non disponibile (navigazione privata): il carrello vale per questa pagina
  }
  emit(change)
}

export const cart = {
  /** righe del carrello: [{ id, qty }] (copie) */
  get items() {
    return items.map((x) => ({ ...x }))
  },
  /** numero totale di pezzi */
  get count() {
    return items.reduce((n, x) => n + x.qty, 0)
  },
  qty: (id) => items.find((x) => x.id === id)?.qty ?? 0,
  add(id, n = 1) {
    if (!known.has(id)) return
    const it = items.find((x) => x.id === id)
    if (it) it.qty = clampQty(it.qty + n)
    else items.push({ id, qty: clampQty(n) })
    save({ type: 'add', id })
  },
  set(id, qty) {
    const it = items.find((x) => x.id === id)
    if (!it) return
    if (qty < 1) return cart.remove(id)
    it.qty = clampQty(qty)
    save({ type: 'set', id })
  },
  remove(id) {
    items = items.filter((x) => x.id !== id)
    save({ type: 'remove', id })
  },
  clear() {
    items = []
    save({ type: 'clear' })
  },
  /** fn(change) a ogni modifica, anche da un'altra scheda; ritorna la funzione per smettere */
  subscribe(fn) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
}

function sync() {
  items = read()
  emit({ type: 'sync' })
}
// un'altra scheda ha cambiato il carrello
window.addEventListener('storage', (e) => (e.key === KEY || e.key === null) && sync())
// pagina ripresa dalla cache del browser (tasto indietro): il carrello puo' essere cambiato
window.addEventListener('pageshow', (e) => e.persisted && sync())

/** Tiene aggiornati i numeri del carrello nella pagina ([data-cart-count]). */
export function bindCartCount() {
  const update = (bump) => {
    const n = cart.count
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = n > 99 ? '99+' : String(n)
      if (el.dataset.cartCount !== 'always') el.hidden = n === 0
      if (bump && n > 0 && !el.hidden) {
        el.classList.remove('is-bump')
        void el.offsetWidth // riparte l'animazione
        el.classList.add('is-bump')
      }
    })
  }
  update(false)
  cart.subscribe((change) => update(change.type === 'add'))
}
