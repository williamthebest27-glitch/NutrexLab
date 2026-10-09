import { lang, setLang, onLang, t, LANG_INFO } from './index.js'

/*
  Scelta della lingua nella navbar (src/partials/nav.html): bandiera e sigla della lingua attiva,
  toccando si apre la tendina con le cinque lingue (su mobile accanto ad "Acquista ora", sul desktop
  prima di "Acquista ora"). Scegliendo una lingua la pagina si traduce subito, senza ricaricare.
  Si chiude toccando fuori, con Esc o scegliendo; da tastiera frecce su/giu' tra le lingue.
*/
export function initLangPicker() {
  const root = document.querySelector('[data-lang-picker]')
  if (!root || root._ready) return
  root._ready = true
  const btn = root.querySelector('.lang__btn')
  const flag = root.querySelector('[data-lang-flag]')
  const code = root.querySelector('[data-lang-code]')
  const opts = [...root.querySelectorAll('.lang__opt')]
  let open = false

  function paint() {
    const l = lang()
    flag?.setAttribute('href', `#flag-${l}`)
    if (code) code.textContent = LANG_INFO[l].short
    btn.setAttribute('aria-label', t('Lingua del sito: {lingua}. Cambia lingua', { lingua: LANG_INFO[l].name }))
    for (const o of opts) {
      const on = o.dataset.lang === l
      o.setAttribute('aria-current', on ? 'true' : 'false')
      o.classList.toggle('is-on', on)
    }
  }

  function set(value) {
    if (open === value) return
    open = value
    root.classList.toggle('is-open', open)
    btn.setAttribute('aria-expanded', String(open))
  }

  btn.addEventListener('click', () => {
    set(!open)
    if (open) (opts.find((o) => o.classList.contains('is-on')) ?? opts[0])?.focus({ preventScroll: true })
  })
  for (const o of opts) {
    o.addEventListener('click', async () => {
      set(false)
      btn.focus({ preventScroll: true })
      root.classList.add('is-busy')
      try {
        await setLang(o.dataset.lang)
      } finally {
        root.classList.remove('is-busy')
      }
    })
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      set(false)
      btn.focus()
      return
    }
    if (!open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    e.preventDefault()
    const i = opts.indexOf(document.activeElement)
    const next = opts[(i + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]
    next?.focus()
  })
  document.addEventListener('pointerdown', (e) => open && !root.contains(e.target) && set(false))
  // da tastiera (Tab) la tendina si chiude quando il fuoco esce. Solo se il fuoco va davvero altrove:
  // in Safari (iPhone) toccando un pulsante il fuoco cade nel vuoto (relatedTarget nullo) e la tendina
  // si chiudeva prima che il tocco arrivasse alla lingua scelta
  root.addEventListener('focusout', (e) => open && e.relatedTarget && !root.contains(e.relatedTarget) && set(false))
  // la tendina segue lo scroll della pagina finche' resta aperta: chiusa se si scorre molto
  let y0 = 0
  window.addEventListener(
    'scroll',
    () => {
      if (!open) return (y0 = window.scrollY)
      if (Math.abs(window.scrollY - y0) > 60) set(false)
    },
    { passive: true },
  )

  paint()
  onLang(paint)
}
