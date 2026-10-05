/**
 * Menu prodotti della hero: pannello a destra con il titolo PRODOTTI e una voce per
 * prodotto (esagono nel colore del barattolo, nome, numero). onSelect al click;
 * onIntent al primo segnale di interesse (mouse sopra, focus, tocco) per scaricare
 * il modello in anticipo.
 * Su mobile il pannello non c'e': il pulsante PRODOTTI (sotto "Acquista ora") lo apre
 * come tendina, che si chiude scegliendo un prodotto, toccando fuori, con Esc o scorrendo.
 */
const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z' // stesso esagono del logo e del punto di QUOTIDIANO

const pad = (n) => String(n).padStart(2, '0')
const hex = (cls) => `<svg class="${cls}" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>`

export function createProductMenu(root, products, { activeId, onSelect, onIntent }) {
  root.innerHTML =
    `<button type="button" class="pmenu__toggle" aria-expanded="false" aria-controls="pmenu-panel">` +
    `${hex('pmenu__toggle-hex')}<span class="pmenu__toggle-label">Prodotti</span>` +
    `<svg class="pmenu__chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.75 6 6.25l4.5-4.5"/></svg>` +
    `</button>` +
    `<div class="pmenu__panel" id="pmenu-panel">` +
    `<div class="pmenu__card">` +
    `<p class="pmenu__head" aria-hidden="true">${hex('pmenu__icon')}<span class="pmenu__title">Prodotti</span>` +
    `<span class="pmenu__count mono">${pad(products.length)}</span></p>` +
    `<ul class="pmenu__list" data-lenis-prevent>${products
      .map(
        (p, i) =>
          `<li style="--i:${i}"><button type="button" class="pmenu__item" data-product="${p.id}" aria-pressed="false" aria-label="${[p.name, p.note].filter(Boolean).join(', ')}" style="--swatch:${p.theme.swatch}">` +
          hex('pmenu__hex') +
          `<span class="pmenu__name" aria-hidden="true">${p.name}${p.note ? `<small class="pmenu__note">${p.note}</small>` : ''}</span>` +
          `<span class="pmenu__num mono" aria-hidden="true">${pad(i + 1)}</span>` +
          `</button></li>`,
      )
      .join('')}</ul>` +
    `</div>` +
    `</div>`

  const toggle = root.querySelector('.pmenu__toggle')
  const list = root.querySelector('.pmenu__list')
  const items = [...root.querySelectorAll('.pmenu__item')]

  // lista piu' lunga della scheda (schermi bassi): sfumature dove ci sono altre voci
  // e voce attiva sempre visibile
  function edges() {
    const max = list.scrollHeight - list.clientHeight
    list.classList.toggle('has-above', max > 1 && list.scrollTop > 1)
    list.classList.toggle('has-below', max > 1 && list.scrollTop < max - 1)
  }
  function reveal(behavior = 'smooth') {
    const btn = items.find((b) => b.getAttribute('aria-pressed') === 'true')
    if (btn && list.scrollHeight > list.clientHeight + 1) {
      const l = list.getBoundingClientRect()
      const b = btn.getBoundingClientRect()
      const pad = 30
      const dy = b.top < l.top + pad ? b.top - l.top - pad : b.bottom > l.bottom - pad ? b.bottom - l.bottom + pad : 0
      if (dy) list.scrollBy({ top: dy, behavior })
    }
    edges()
  }
  list.addEventListener('scroll', edges, { passive: true })
  window.addEventListener('resize', () => reveal('auto'))

  // tendina (mobile): sul desktop il pulsante non si vede e la classe non cambia nulla
  let open = false
  let openY = 0
  function setOpen(value) {
    if (open === value) return
    open = value
    openY = window.scrollY
    root.classList.toggle('is-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    if (open) reveal('auto')
  }
  toggle.addEventListener('click', () => setOpen(!open))
  document.addEventListener('pointerdown', (e) => {
    if (open && !root.contains(e.target)) setOpen(false)
  })
  document.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return
    setOpen(false)
    toggle.focus()
  })
  window.addEventListener('scroll', () => open && Math.abs(window.scrollY - openY) > 40 && setOpen(false), { passive: true })

  for (const btn of items) {
    const id = btn.dataset.product
    btn.addEventListener('click', () => {
      onSelect(id)
      setOpen(false)
    })
    const intent = () => onIntent?.(id)
    btn.addEventListener('pointerenter', intent)
    btn.addEventListener('focus', intent)
    btn.addEventListener('touchstart', intent, { passive: true })
  }

  function setActive(id) {
    for (const btn of items) btn.setAttribute('aria-pressed', String(btn.dataset.product === id))
    reveal()
  }
  setActive(activeId)

  return {
    root,
    toggle,
    card: root.querySelector('.pmenu__card'),
    head: root.querySelector('.pmenu__head'),
    items,
    setActive,
    reveal,
    close: () => setOpen(false),
  }
}
