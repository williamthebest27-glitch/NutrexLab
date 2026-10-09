import gsap from 'gsap'
import data from './labels.json'
import { lang, t, LANG_INFO } from '../i18n/index.js'
import { esc } from './themes.js'

/*
  Etichetta del prodotto nella lingua del sito: nella pagina prodotto, sotto la foto, la miniatura con
  la bandierina della lingua; toccandola si apre l'etichetta grande da leggere (un tocco o un clic la
  ingrandisce in quel punto, poi si scorre trascinando). Cambiando lingua si vede solo l'etichetta di
  quella lingua.
  Immagini in public/images/etichette/<slug>-<lingua>.webp (3200 px) e <slug>-<lingua>-mini.webp,
  esportate dalle etichette originali con prodotti/_strumenti/traduzione-etichette/esporta_sito.py,
  che scrive anche labels.json (misure e versione dei file, messa nell'indirizzo: cambiando
  un'etichetta nessuno vede la copia vecchia rimasta in cache).
*/

const flag = (l, cls) => `<svg class="${cls}" viewBox="0 0 30 20" aria-hidden="true"><use href="#flag-${l}"></use></svg>`
const ICON = {
  zoomIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 20 20M10.5 7.8v5.4M7.8 10.5h5.4"/></svg>',
  zoomOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 20 20M7.8 10.5h5.4"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
}

/** Etichetta di un prodotto in una lingua (null se il prodotto non ne ha una). */
export function labelFor(slug, l = lang()) {
  const size = data.labels[slug]
  if (!size) return null
  const [width, height, miniWidth, miniHeight] = size
  const file = (suffix) => `/images/etichette/${slug}-${l}${suffix}.webp?v=${data.version}`
  return { slug, lang: l, src: file(''), width, height, mini: file('-mini'), miniWidth, miniHeight }
}

/** Miniatura dell'etichetta con la bandierina (pulsante che apre l'etichetta grande). '' se non c'e'. */
export function labelThumbHtml(slug) {
  const label = labelFor(slug)
  if (!label) return ''
  const name = LANG_INFO[label.lang].name
  return `<button type="button" class="pp__label" data-label aria-haspopup="dialog" aria-label="${esc(t("Leggi l'etichetta ({lingua})", { lingua: name }))}">
    <span class="pp__label-img"><img src="${label.mini}" alt="" width="${label.miniWidth}" height="${label.miniHeight}" decoding="async" /><span class="pp__label-flag">${flag(label.lang, '')}</span></span>
    <span class="mono pp__label-k"><span>${esc(t('Etichetta'))}</span><b>${esc(name)}</b></span>
  </button>`
}

// ---------------------------------------------------------------------------
// etichetta grande (finestra sopra la pagina, creata la prima volta che si apre)

const html = document.documentElement
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const finePointer = matchMedia('(hover: hover) and (pointer: fine)')
let box = null
let view = null
let img = null
let state = null // { slug, name, label, zoom, lenis, opener }

function hint() {
  const mouse = finePointer.matches
  if (state.zoom) return mouse ? t("Trascina per scorrere, clicca per vederla intera") : t('Scorri con il dito, tocca per vederla intera')
  return mouse ? t("Clicca sull'etichetta per ingrandirla") : t("Tocca l'etichetta per ingrandirla")
}

/** Testi e pulsanti della finestra nella lingua del sito. */
function paint() {
  const { label, name } = state
  box.querySelector('[data-lbox-title]').innerHTML =
    `<span class="lbox__flag">${flag(label.lang, '')}</span><span class="lbox__name">${esc(name)}</span><span class="mono lbox__lang">${esc(t('Etichetta'))} &middot; ${esc(LANG_INFO[label.lang].name)}</span>`
  const zoom = box.querySelector('[data-lbox-zoom]')
  zoom.innerHTML = state.zoom ? ICON.zoomOut : ICON.zoomIn
  zoom.setAttribute('aria-label', state.zoom ? t("Vedi l'etichetta intera") : t("Ingrandisci l'etichetta"))
  zoom.setAttribute('aria-pressed', String(state.zoom))
  box.querySelector('[data-lbox-close]').setAttribute('aria-label', t('Chiudi'))
  box.querySelector('[data-lbox-hint]').textContent = hint()
  view.classList.toggle('is-zoom', state.zoom)
  img.alt = t('Etichetta di {nome} ({lingua})', { nome: name, lingua: LANG_INFO[label.lang].name })
}

/** Larghezza dell'etichetta: intera nello schermo, oppure ingrandita (fino alla misura vera del file). */
function widthFor(zoom) {
  const { label } = state
  const pad = view.clientWidth < 700 ? 16 : 56
  const fit = Math.max(120, Math.min(view.clientWidth - pad * 2, (view.clientHeight - pad * 2) * (label.width / label.height)))
  return zoom ? Math.round(Math.min(label.width, Math.max(fit * 2.2, 1100))) : Math.round(fit)
}

/**
 * Ingrandisce o rimpicciolisce tenendo fermo il punto toccato (x, y sullo schermo; senza punto il
 * centro), con un passaggio morbido dalla misura di prima a quella nuova.
 */
function setZoom(zoom, x, y) {
  if (zoom === state.zoom) return
  const before = img.getBoundingClientRect()
  const vr = view.getBoundingClientRect()
  const px = x ?? vr.left + vr.width / 2
  const py = y ?? vr.top + vr.height / 2
  const rx = Math.min(1, Math.max(0, (px - before.left) / before.width))
  const ry = Math.min(1, Math.max(0, (py - before.top) / before.height))
  state.zoom = zoom
  gsap.killTweensOf(img)
  gsap.set(img, { clearProps: 'transform' })
  img.style.width = `${widthFor(zoom)}px`
  const mid = img.getBoundingClientRect()
  view.scrollLeft += mid.left + rx * mid.width - px
  view.scrollTop += mid.top + ry * mid.height - py
  paint()
  if (reduced) return
  const after = img.getBoundingClientRect()
  gsap.from(img, {
    x: before.left - after.left,
    y: before.top - after.top,
    scale: before.width / after.width,
    transformOrigin: '0 0',
    duration: 0.55,
    ease: 'expo.out',
    clearProps: 'transform',
  })
}

function build() {
  box = document.createElement('dialog')
  box.className = 'lbox'
  box.setAttribute('aria-labelledby', 'lbox-title')
  box.setAttribute('data-lenis-prevent', '')
  box.innerHTML = `
    <div class="lbox__bar">
      <p class="lbox__title" id="lbox-title" data-lbox-title></p>
      <div class="lbox__tools">
        <button class="icon-btn lbox__btn" type="button" data-lbox-zoom></button>
        <button class="icon-btn lbox__btn" type="button" data-lbox-close>${ICON.close}</button>
      </div>
    </div>
    <div class="lbox__view" data-lbox-view><img class="lbox__img" data-lbox-img alt="" draggable="false" decoding="async" /></div>
    <p class="mono lbox__hint" data-lbox-hint aria-live="polite"></p>`
  document.body.append(box)
  view = box.querySelector('[data-lbox-view]')
  img = box.querySelector('[data-lbox-img]')

  box.querySelector('[data-lbox-close]').addEventListener('click', closeLabel)
  box.querySelector('[data-lbox-zoom]').addEventListener('click', () => setZoom(!state.zoom))
  // Esc: chiusura con la stessa dissolvenza (anche dove il dialogo non manda "cancel")
  box.addEventListener('cancel', (e) => {
    e.preventDefault()
    closeLabel()
  })
  box.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    closeLabel()
  })

  // trascinare con il mouse per scorrere l'etichetta ingrandita (con il dito scorre da sola)
  let drag = null
  let dragged = false
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !state.zoom) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left: view.scrollLeft, top: view.scrollTop, moved: false }
  })
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 6) return
      drag.moved = true
      view.setPointerCapture(e.pointerId)
      view.classList.add('is-dragging')
    }
    view.scrollLeft = drag.left - dx
    view.scrollTop = drag.top - dy
  })
  const endDrag = () => {
    if (!drag) return
    dragged = drag.moved
    drag = null
    view.classList.remove('is-dragging')
    if (dragged) setTimeout(() => (dragged = false), 0)
  }
  view.addEventListener('pointerup', endDrag)
  view.addEventListener('pointercancel', endDrag)

  view.addEventListener('click', (e) => {
    if (dragged) return
    // tocco sull'etichetta: ingrandisce (o torna intera); fuori dall'etichetta: chiude
    if (e.target === img) setZoom(!state.zoom, e.clientX, e.clientY)
    else if (!state.zoom) closeLabel()
  })

  window.addEventListener('resize', () => {
    if (box.open) img.style.width = `${widthFor(state.zoom)}px`
  })
  finePointer.addEventListener?.('change', () => box.open && paint())
}

function show(label) {
  img.removeAttribute('src')
  img.width = label.width
  img.height = label.height
  img.src = label.src
}

/**
 * Apre l'etichetta grande. name: nome del prodotto (nella lingua del sito); opener: il pulsante che
 * l'ha aperta (ci torna il fuoco alla chiusura); lenis: lo scroll morbido della pagina, fermo intanto.
 */
export function openLabel(slug, { name, opener = null, lenis = null } = {}) {
  const label = labelFor(slug)
  if (!label) return
  if (!box) build()
  state = { slug, name, label, zoom: false, lenis, opener }
  show(label)
  paint()
  box.showModal()
  html.classList.add('lbox-open')
  lenis?.stop()
  img.style.width = `${widthFor(false)}px`
  view.scrollTo(0, 0)
  box.querySelector('[data-lbox-close]').focus({ preventScroll: true })
  if (!reduced) {
    gsap.fromTo(box, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' })
    gsap.fromTo(img, { y: 26, scale: 0.97 }, { y: 0, scale: 1, duration: 0.8, ease: 'expo.out', clearProps: 'transform' })
  }
}

export function closeLabel() {
  if (!box?.open) return
  const done = () => {
    box.close()
    gsap.set(box, { clearProps: 'opacity,visibility' })
    html.classList.remove('lbox-open')
    state.lenis?.start()
    const opener = state.opener?.isConnected ? state.opener : document.querySelector('[data-label]')
    opener?.focus({ preventScroll: true })
  }
  if (reduced) return done()
  gsap.to(box, { autoAlpha: 0, duration: 0.25, ease: 'power2.in', onComplete: done })
}

/** Cambio di lingua con l'etichetta aperta: si vede quella della nuova lingua (intera). */
export function refreshLabel({ name, opener } = {}) {
  if (!box?.open) return
  const label = labelFor(state.slug)
  if (!label) return closeLabel()
  Object.assign(state, { label, zoom: false }, name ? { name } : {}, opener ? { opener } : {})
  show(label)
  img.style.width = `${widthFor(false)}px`
  view.scrollTo(0, 0)
  paint()
}
