import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { initPage, rise, reduced, isPhone } from './common.js'
import { PRODUCTS, productById, tableYaw } from '../products.js'
import { applyCssTheme } from '../theme.js'
import { createProductMenu } from '../ui/productMenu.js'
import { createMenuMorph } from '../ui/menuMorph.js'
import { syncProductLinks } from '../ui/productLinks.js'
import { show } from '../ui/text.js'
import { api } from '../shop/api.js'
import { availability } from '../shop/themes.js'
import { priceHtml } from '../shop/money.js'
import { localizeProduct } from '../i18n/data.js'
import { t, onLang } from '../i18n/index.js'
import '../styles/pmenu.css'
import '../styles/benefici.css'

gsap.registerPlugin(ScrollTrigger)

/*
  Pagina Benefici (/benefici), come la homepage: un prodotto alla volta. Il contenuto di tutti i prodotti
  e' gia' nell'HTML (src/seo/benefici-page.js: per ogni prodotto la sua parte della hero e la sua vista,
  [data-view]); qui:
  - il menu PRODOTTI della homepage (scheda a destra che scorrendo si chiude nel pulsante accanto ad
    "Acquista ora"; su mobile pulsante con tendina) e ?prodotto= nell'indirizzo;
  - cambiando prodotto si torna in cima: il barattolo gira e lascia il posto al nuovo con un'esplosione
    di colori, i colori di tutta la pagina sfumano in quelli del prodotto, foto e testi del prodotto entrano;
  - un barattolo 3D su una tela fissa: segue lo spazio [data-jar-slot] al centro dello schermo (hero,
    benefici, formula), vola dall'uno all'altro e gira piano con lo scroll. three.js arriva dopo il primo
    disegno; in memoria restano il barattolo in scena e quello di prima;
  - dati di WooCommerce (nomi attuali, disponibilita').
  Movimento ridotto: niente rotazioni, voli ed esplosioni; i cambi sono immediati.
*/

// come la homepage: si parte sempre dalla hero del prodotto (lo scroll ricordato dal browser cadeva a
// meta' di un altro prodotto)
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

const { lenis, ready } = initPage()
const html = document.documentElement
const main = document.querySelector('.bx-main')
const parts = [...document.querySelectorAll('[data-view]')]
const FIRST = PRODUCTS[0]

/** Il prodotto ha la sua vista nella pagina? */
const hasView = (p) => !!p && parts.some((el) => el.dataset.view === p.id)

// prodotto mostrato (il primo della linea; ?prodotto=id apre direttamente un prodotto, come nella homepage)
let product = productById(new URLSearchParams(location.search).get('prodotto'))
if (!hasView(product)) product = FIRST

/** Mostra le parti di un prodotto (hero, foto, vista) e nasconde quelle degli altri. */
function showParts(id) {
  for (const el of parts) el.hidden = el.dataset.view !== id
}

/** Colori del prodotto su tutta la pagina (fondo, testi, accenti, sezione scura). */
function paint(theme, animate) {
  applyCssTheme(theme, { animate, duration: 1.4 })
}

paint(product.theme, false)
showParts(product.id)
syncProductLinks(product.id, FIRST.id)

// ---------------------------------------------------------------------------
// Testi che rientrano: tornando a un prodotto gia' visto, i suoi titoli e testi compaiono di nuovo
// entrando nello schermo (la prima volta li fa comparire initPage)

/** Riporta un testo gia' comparso allo stato nascosto (come prima della prima comparsa). */
function conceal(el) {
  if (el._state !== 'shown') return
  el._state = 'hidden'
  const s = el._split
  const list = s ? (s.chars?.length ? s.chars : s.lines) : null
  gsap.killTweensOf(list ?? el)
  if (!list) gsap.set(el, { autoAlpha: 0 })
  else if (reduced || el.dataset.mask === 'none') gsap.set(list, { autoAlpha: 0 })
  else gsap.set(list, { yPercent: 112, visibility: 'hidden' })
  const dot = el.parentElement?.querySelector(':scope > .hexdot')
  if (dot && !reduced) gsap.set(dot, { scale: 0 })
}

/** Fa comparire un testo (e l'esagono del suo titolo). */
function reveal(el, delay = 0) {
  show(el, { delay, reduced })
  const dot = el.parentElement?.querySelector(':scope > .hexdot')
  if (dot && !reduced) gsap.fromTo(dot, { scale: 0, rotation: -140 }, { scale: 1, rotation: 0, duration: 1, ease: 'back.out(2.6)', delay: delay + 0.45 })
}

const again = new IntersectionObserver(
  (entries) => {
    let i = 0
    for (const e of entries) {
      if (!e.isIntersecting) continue
      again.unobserve(e.target)
      reveal(e.target, parseFloat(e.target.dataset.delay || '0') + Math.min(i++ * 0.08, 0.4))
    }
  },
  { rootMargin: '0px 0px -6% 0px' },
)

/** Testi di un prodotto che si lascia: torneranno a comparire entrando nello schermo. */
function rearm(id) {
  for (const root of parts) {
    if (root.dataset.view !== id) continue
    for (const el of root.querySelectorAll('[data-split], [data-reveal]')) {
      if (el._state !== 'shown') continue
      conceal(el)
      again.observe(el)
    }
  }
}

// ---------------------------------------------------------------------------
// Menu prodotti (lo stesso della homepage)
const menuRoot = document.querySelector('[data-pmenu]')
/** Le voci del menu con nome e nota nella lingua del sito. */
const menuProducts = () => PRODUCTS.filter(hasView).map((p) => ({ ...p, name: t(p.name), note: t(p.note) }))
const menu =
  menuRoot &&
  createProductMenu(menuRoot, menuProducts(), {
    activeId: product.id,
    onSelect: (id) => switchProduct(id),
    onIntent: (id) => jar?.preload(id),
  })
const morph = menu && createMenuMorph(menu)

// nella hero (desktop) la scheda a destra; appena si scorre si chiude nel pulsante PRODOTTI in alto a
// destra. Su mobile sempre pulsante: nella hero sotto "Acquista ora", poi in basso a destra
let menuDrop = null
let menuDock = null
function dockMenu(scrolled) {
  if (!menu) return
  const mobile = isPhone()
  const drop = mobile || scrolled
  const dock = mobile && scrolled
  if (drop === menuDrop && dock === menuDock) return
  const cl = menuRoot.classList
  cl.remove('was-dock')
  if (menuDock && !dock && mobile) cl.add('was-dock')
  cl.toggle('is-dock', dock)
  html.classList.toggle('menu-docked', drop && !mobile) // navbar: spazio per il pulsante (schermi medi)
  menu.close()
  if (!mobile && !reduced && menuDrop !== null) morph.to(drop)
  else morph.settle(drop)
  menuDrop = drop
  menuDock = dock
}

/** Larghezza del gruppo a destra della navbar: il pulsante PRODOTTI (desktop) gli si affianca. */
function measureCta() {
  const right = document.querySelector('.nav__right') ?? document.querySelector('.nav__cta')
  if (right) html.style.setProperty('--cta-w', `${right.offsetWidth}px`)
}

if (menu) {
  measureCta()
  dockMenu(window.scrollY > 40)
  window.addEventListener('scroll', () => dockMenu(window.scrollY > 40), { passive: true })
  window.addEventListener('resize', () => {
    measureCta()
    dockMenu(window.scrollY > 40)
  })
  // entrata con i titoli: la scheda arriva da destra (sul telefono il pulsante)
  if (!reduced) gsap.set([menu.card, menu.toggle], { autoAlpha: 0 })
  ready.then(() => {
    menu.reveal('auto')
    if (reduced) return
    gsap.fromTo(menu.card, { x: 60, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', delay: 0.45, clearProps: 'transform,opacity,visibility' })
    gsap.fromTo(menu.toggle, { y: -12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: 'expo.out', delay: 0.6, clearProps: 'transform,opacity,visibility' })
  })
}

// ---------------------------------------------------------------------------
// Cambio prodotto
let switching = false
let queued = null

/** Torna in cima alla pagina (da lontano passando da una dissolvenza). */
function backToTop() {
  const y = window.scrollY
  if (y < 4) return Promise.resolve()
  // (Lenis allineato alla posizione vera: dopo uno scroll del browser il suo obiettivo puo' essere rimasto indietro)
  lenis?.reset()
  const top = () => {
    lenis?.scrollTo(0, { immediate: true, force: true })
    if (window.scrollY > 0) window.scrollTo(0, 0)
  }
  if (reduced || !lenis) {
    top()
    return Promise.resolve()
  }
  if (y < window.innerHeight * 1.4) {
    return new Promise((resolve) =>
      lenis.scrollTo(0, {
        duration: 0.9,
        force: true,
        onComplete: () => {
          top()
          resolve()
        },
      }),
    )
  }
  return new Promise((resolve) => {
    gsap.to(main, {
      autoAlpha: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        top()
        gsap.to(main, { autoAlpha: 1, duration: 0.5, ease: 'power2.out', delay: 0.05, clearProps: 'opacity,visibility' })
        resolve()
      },
    })
  })
}

/** La parte della hero del prodotto che si lascia esce (testi verso l'alto, foto che si chiude). */
function leaveHero(id) {
  if (reduced) return Promise.resolve()
  const block = document.querySelector(`.bx-hp[data-view="${id}"]`)
  const photo = document.querySelector(`.bx-hero__photo[data-view="${id}"]`)
  const tl = gsap.timeline()
  if (block) tl.to(block.children, { y: -26, autoAlpha: 0, duration: 0.4, ease: 'power2.in', stagger: 0.04 }, 0)
  if (photo) tl.to(photo, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.55, ease: 'power3.in' }, 0)
  return tl.then(() => {
    if (block) gsap.set(block.children, { clearProps: 'transform,opacity,visibility' })
    if (photo) gsap.set(photo, { clearProps: 'clipPath' })
  })
}

/** La parte della hero del nuovo prodotto entra: foto che si apre dal basso, nome lettera per lettera. */
function enterHero(id) {
  const block = document.querySelector(`.bx-hp[data-view="${id}"]`)
  const photo = document.querySelector(`.bx-hero__photo[data-view="${id}"]`)
  if (block) {
    const texts = [...block.querySelectorAll('[data-split], [data-reveal]')]
    texts.forEach(conceal)
    texts.forEach((el, i) => {
      again.unobserve(el)
      reveal(el, reduced ? 0 : 0.1 + i * 0.07)
    })
  }
  if (photo && !reduced) {
    gsap.fromTo(photo, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.out', delay: 0.05, clearProps: 'clipPath' })
    gsap.fromTo(photo.querySelector('img'), { scale: 1.18 }, { scale: 1, duration: 1.8, ease: 'expo.out', delay: 0.05 })
  }
}

/** Indirizzo con il prodotto (il primo senza parametro), come nella homepage. */
function setUrl(p) {
  const url = new URL(location.href)
  if (p === FIRST) url.searchParams.delete('prodotto')
  else url.searchParams.set('prodotto', p.id)
  url.hash = ''
  history.replaceState(history.state, '', url)
}

async function switchProduct(id) {
  const next = productById(id)
  if (!hasView(next)) return
  if (switching) {
    queued = id
    return
  }
  if (next === product) return
  switching = true
  menu?.setActive(next.id)
  const prev = product
  const loading = jar?.prepare(next) // il modello si scarica mentre la pagina torna in cima
  const out = jar?.out()
  await backToTop()
  await Promise.all([out, leaveHero(prev.id)])
  rearm(prev.id)
  product = next
  paint(next.theme, !reduced)
  showParts(next.id)
  setUrl(next)
  syncProductLinks(next.id, FIRST.id)
  enterHero(next.id)
  ScrollTrigger.refresh()
  if (html.classList.contains('bx-no3d')) heroFallback()
  await jar?.in(next, loading)
  switching = false
  const pending = queued
  queued = null
  if (pending && pending !== product.id) switchProduct(pending)
}

// ---------------------------------------------------------------------------
// Foto delle aree: leggera parallasse dentro la cornice
function initParallax() {
  if (reduced) return
  document.querySelectorAll('.bx-group__media').forEach((fig) => {
    const img = fig.querySelector('img')
    if (!img) return
    gsap.fromTo(img, { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } })
  })
}

// ---------------------------------------------------------------------------
// Barattolo 3D
const canvas = document.querySelector('[data-bx-webgl]')
const slots = [...document.querySelectorAll('[data-jar-slot]')]
let jar = null

/** Senza WebGL: la foto del barattolo del prodotto in ogni spazio (al posto del modello 3D). */
function fallback() {
  html.classList.add('bx-no3d')
  for (const s of slots) {
    const img = s.querySelector('.bx-slot__fallback')
    if (img) img.hidden = false
  }
  heroFallback()
}

/** Lo spazio della hero e' uno solo: la foto del barattolo segue il prodotto scelto. */
function heroFallback() {
  const img = document.querySelector('.bx-slot--hero .bx-slot__fallback')
  if (img) img.src = `/images/prodotti/${product.id}.webp`
}

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

async function initJar() {
  if (!canvas || !slots.length) return
  let Stage
  try {
    ;({ Stage } = await import('../webgl/Stage.js'))
  } catch {
    return fallback()
  }
  let stage
  let first = product
  try {
    stage = new Stage(canvas, { reduced, tier: isPhone() ? 'low' : 'high', theme: first.theme })
    stage.setLayout(isPhone() ? 'mobile' : 'desktop')
    stage.resize()
    await stage.load(first)
    // scelto un altro prodotto mentre three.js arrivava: il suo barattolo
    while (product !== first) {
      first = product
      const entry = await stage.loadProduct(first)
      stage.setProduct(entry)
      stage.setTheme(first.theme, first.theme, 1)
    }
  } catch (err) {
    console.warn('WebGL non disponibile, uso le foto dei barattoli.', err)
    return fallback()
  }
  html.classList.add('bx-3d')

  // posa: posizione e misura dallo spazio sullo schermo, luci da studio (stesse chiavi di choreography.js)
  const target = {
    sx: 0, sy: 0, size: 0.4, rotY: 0, rotX: 0.05, rotZ: 0, elev: 8,
    key: 1.12, rim: 0.85, env: 0.95, shadow: 0.42, aura: 0, spot: 0, uP: 0, ambient: 0, twist: 0, heroOut: 1,
  }
  let shown = first // barattolo in scena (quello di prima resta in memoria per tornarci subito)
  let active = null // { el, r } spazio al centro dello schermo
  let vis = 1 // 1 = in scena, 0 = chiuso (spazio fuori dallo schermo)
  let visTween = null
  let swapping = false // durante il cambio prodotto il barattolo lo muove switchProduct
  let glide = null // volo da uno spazio all'altro: { from: {sx, sy}, t0 }
  let cleared = false
  const at = { sx: 0, sy: 0 } // posizione disegnata

  /*
    Telefono: lo scroll e' quello nativo del browser, che sposta la pagina fuori dal JavaScript; una tela fissa
    che a ogni fotogramma insegue lo spazio del barattolo arriva sempre un attimo dopo la pagina e il barattolo
    trema. Qui la tela si aggancia allo spazio: sta nella pagina attorno a lui (con mezzo spazio di margine
    sopra e sotto per l'esplosione di colori) e scorre con il resto del contenuto, il barattolo resta fermo
    dentro di lei. Da uno spazio all'altro il barattolo si chiude e si riapre, senza volo.
  */
  const PAD = 0.5
  let anchored = false
  let anchor = null // { el, top, h, w }: tela nella pagina (px) attorno allo spazio el

  function setAnchored(on) {
    if (on === anchored) return
    anchored = on
    anchor = null
    glide = null
    canvas.classList.toggle('is-anchored', on)
    if (!on) for (const p of ['top', 'width', 'height']) canvas.style.removeProperty(p)
  }

  /** Porta la tela attorno allo spazio el (solo se lo spazio non e' gia' quello o ha cambiato posto o misura). */
  function anchorTo(el, r = el.getBoundingClientRect()) {
    const top = r.top + window.scrollY - r.height * PAD
    const h = Math.round(r.height * (1 + 2 * PAD))
    const w = html.clientWidth
    if (anchor?.el === el && Math.abs(anchor.top - top) < 1.5 && anchor.h === h && anchor.w === w) return
    const resized = anchor?.h !== h || anchor?.w !== w
    anchor = { el, top: Math.round(top), h, w }
    canvas.style.top = `${anchor.top}px`
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    if (resized) stage.resize()
  }

  /** Lo spazio in coordinate della tela (agganciata: la sua posizione nella pagina, che non cambia scorrendo). */
  const onCanvas = ({ el, r }) =>
    anchored ? { el, r: { left: r.left, top: r.top + window.scrollY - anchor.top, width: r.width, height: r.height } } : { el, r }

  /** Altezza dello schermo: quella della tela fissa, o della finestra se la tela e' agganciata. */
  const screenH = () => (anchored ? window.innerHeight : stage.size.h || window.innerHeight)

  setAnchored(isPhone())

  // ingresso nella hero
  if (!reduced) {
    gsap.fromTo(stage.intro, { scale: 0.62, rot: -1.5, lift: -0.12 }, { scale: 1, rot: 0, lift: 0, duration: 2.4, ease: 'expo.out', delay: 0.2 })
  }

  /** Apre (1) o chiude (0) il barattolo in scena. */
  function setVisible(v) {
    if (v === vis) return
    vis = v
    visTween?.kill()
    if (reduced) {
      stage.swap.scale = v
      return
    }
    visTween = gsap.to(stage.swap, { scale: v, duration: v ? 0.8 : 0.35, ease: v ? 'expo.out' : 'power2.in' })
  }

  /** Spazio piu' vicino al centro dello schermo (con un po' di isteresi per non saltare tra due). */
  function pick(vh) {
    let best = null
    let bestD = Infinity
    for (const el of slots) {
      if (el.closest('[hidden]')) continue
      const r = el.getBoundingClientRect()
      if (r.height < 20 || r.bottom < vh * 0.06 || r.top > vh * 0.94) continue
      let d = Math.abs(r.top + r.height / 2 - vh / 2)
      if (active && el === active.el) d *= 0.7
      if (d < bestD) {
        bestD = d
        best = { el, r }
      }
    }
    return best
  }

  /**
   * Posizione e misura del barattolo dentro lo spazio (r in coordinate della tela); rotazione legata allo
   * scroll della sezione (vh: altezza dello schermo). In "Cosa c'e' dentro" il barattolo si gira, si avvicina
   * e mostra la tabella nutrizionale dell'etichetta.
   */
  function pose({ el, r }, time, vh) {
    const w = stage.size.w
    const h = stage.size.h
    const section = el.closest('section')
    const box = section?.getBoundingClientRect() ?? el.getBoundingClientRect()
    const p = Math.min(1, Math.max(0, (vh - box.top) / (vh + box.height))) // 0 entra dal basso, 1 esce in alto
    const ratio = stage.jarW / stage.jarH
    const fit = Math.min(r.height * 0.92, (r.width * 0.9) / Math.max(0.3, ratio))
    target.sx = ((r.left + r.width / 2) / w) * 2 - 1
    target.sy = 1 - ((r.top + r.height / 2) / h) * 2
    if (section?.classList.contains('bx-inside')) {
      // entrando nella sezione (dal fondo dello schermo a un terzo dall'alto) il barattolo gira fino alla
      // tabella, appena verso i testi a sinistra, e cresce: la tabella resta al centro dello spazio
      const k = Math.min(1, Math.max(0, (vh - box.top) / (vh * 0.7)))
      const e = 1 - Math.pow(1 - k, 3)
      const zoom = 1 + (isPhone() ? 0.12 : 0.32) * e
      const jarH = fit * zoom
      // ingrandito non deve coprire i testi a sinistra: se esce dallo spazio si sposta a destra
      const half = (jarH * ratio) / 2
      const cx = Math.max(r.left + r.width / 2, r.left + 6 + half)
      target.sx = (cx / w) * 2 - 1
      target.size = jarH / h
      target.sy += ((jarH * 0.1) / h) * 2 * e // la tabella e' sotto la meta' dell'etichetta
      target.rotY = tableYaw(shown) - 0.14 - (1 - e) * 1.3 + (reduced ? 0 : Math.sin(time * 0.3) * 0.03)
      return
    }
    const breath = reduced ? 1 : 0.96 + 0.04 * Math.sin(p * Math.PI)
    target.size = (fit / h) * breath
    target.rotY = reduced ? -0.18 : -0.7 + p * 1.25 + Math.sin(time * 0.32) * 0.08
  }

  // il mouse inclina appena il barattolo (solo con il mouse)
  if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener(
      'pointermove',
      (e) => {
        stage.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
        stage.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
      },
      { passive: true },
    )
  }

  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(0.05, deltaMs / 1000)
    // telefono: la risoluzione si cambia prima di disegnare (la tela si svuota, il disegno di questo fotogramma resta)
    if (anchored) stage.adapt(dt)
    const vh = screenH()
    const next = pick(vh)
    if (next?.el !== active?.el) {
      // un altro spazio: il barattolo ci vola (se era in scena), altrimenti ci compare
      if (next && active && vis && !reduced && !anchored) glide = { from: { ...at }, t0: time }
      else glide = null
      active = next
    } else if (next) active = next
    // spazio in cui si disegna: con la tela agganciata il barattolo passa a un altro spazio solo da chiuso
    let slot = active
    if (anchored) {
      const leaving = anchor && active?.el !== anchor.el && stage.swap.scale > 0.01
      if (active && !leaving) anchorTo(active.el, active.r)
      slot = leaving ? { el: anchor.el, r: anchor.el.getBoundingClientRect() } : active
      if (!swapping) setVisible(active && !leaving ? 1 : 0)
    } else if (!swapping) setVisible(active ? 1 : 0)
    const showing = stage.swap.scale > 0.002
    if (!showing && !slot) {
      if (!cleared) {
        stage.renderer.clear()
        cleared = true
      }
      return
    }
    cleared = false
    if (slot) pose(onCanvas(slot), time, vh)
    // la posizione segue lo spazio senza ritardo (lo scroll e' gia' morbido); nei voli si sposta con una curva
    let sx = target.sx
    let sy = target.sy
    if (glide) {
      const k = Math.min(1, (time - glide.t0) / 0.85)
      const e = ease(k)
      sx = glide.from.sx + (sx - glide.from.sx) * e
      sy = glide.from.sy + (sy - glide.from.sy) * e
      if (k >= 1) glide = null
    }
    at.sx = sx
    at.sy = sy
    if (stage.cur) {
      stage.cur.sx = sx
      stage.cur.sy = sy
    }
    stage.update(dt, time, target)
    stage.render()
    if (!anchored) stage.adapt(dt)
  })

  // telefono: la barra del browser che compare e scompare non tocca la tela agganciata (si sposta solo se lo
  // spazio cambia posto o misura; ridimensionarla la svuoterebbe per un fotogramma)
  let resizeT = 0
  window.addEventListener('resize', () => {
    clearTimeout(resizeT)
    resizeT = setTimeout(() => {
      stage.setLayout(isPhone() ? 'mobile' : 'desktop')
      setAnchored(isPhone())
      if (!anchored) stage.resize()
      else if (anchor) anchorTo(anchor.el)
    }, 120)
  })

  jar = {
    /** Scarica in anticipo il barattolo di un prodotto (mouse sopra la voce del menu). */
    preload(id) {
      const p = productById(id)
      if (p) stage.loadProduct(p).catch(() => {})
    },
    prepare(p) {
      return stage.loadProduct(p).catch(() => null)
    },
    /** Il barattolo in scena accelera e si chiude. */
    out() {
      swapping = true
      visTween?.kill()
      if (reduced || stage.swap.scale < 0.01) {
        stage.swap.scale = 0
        return Promise.resolve()
      }
      return gsap
        .timeline()
        .to(stage.swap, { rot: stage.swap.rot + 2.4, duration: 0.55, ease: 'power2.in' }, 0)
        .to(stage.swap, { scale: 0, duration: 0.55, ease: 'power3.in' }, 0)
        .then()
    },
    /** Il nuovo barattolo arriva girando con un'esplosione di colori e si ferma di fronte. */
    async in(p, loading) {
      const entry = await loading
      const before = shown
      if (entry) {
        stage.setProduct(entry)
        stage.setTheme(p.theme, p.theme, 1)
        shown = p
        // in memoria restano il barattolo in scena e quello di prima
        for (const id of [...stage.entries.keys()]) if (id !== p.id && id !== before.id) stage.release(id)
      } else {
        console.error('Modello non caricato', p.model) // resta il barattolo di prima
      }
      glide = null
      if (anchored) {
        // telefono: la tela va subito attorno allo spazio della hero, dove arriva il nuovo barattolo
        active = pick(screenH()) ?? active
        if (active) anchorTo(active.el, active.r)
      }
      if (active) pose(onCanvas(active), performance.now() / 1000, screenH())
      stage.snap()
      vis = 1
      swapping = false
      if (reduced) {
        stage.swap.scale = 1
        stage.swap.rot = 0
        return
      }
      if (entry) stage.burstColors(p.theme)
      visTween = gsap.fromTo(stage.swap, { scale: 0.001, rot: -3.2 }, { scale: 1, rot: 0, duration: 1.4, ease: 'expo.out' })
      await visTween.then()
    },
  }
}

// ---------------------------------------------------------------------------
// WooCommerce: nomi attuali e disponibilita' (i prodotti non ancora in vendita: "Presto disponibile")
let woo = null

/** Testo di un titolo diviso in lettere (SplitText): si rifa' la divisione con il testo nuovo. */
function setSplitText(el, text) {
  if (!el || el.textContent === text) return
  const split = el._split
  if (split) {
    split.revert()
    el.textContent = text
    split.split()
  } else {
    el.textContent = text
  }
}

/**
 * Nomi, prezzi e disponibilita' di WooCommerce nelle parti di ogni prodotto (hero e vista). Un prodotto non
 * ancora in vendita: "Presto disponibile", senza pulsanti d'acquisto.
 */
function applyWoo() {
  if (!woo) return
  for (const view of document.querySelectorAll('.bx-view')) {
    const id = view.dataset.view
    const p = woo.get(id)
    const inside = (sel) => document.querySelectorAll(`[data-view="${id}"] ${sel}`)
    const s = p ? availability(localizeProduct(p).stock) : { text: t('Presto disponibile'), tone: 'back' }
    for (const el of inside('[data-stock]')) {
      el.textContent = s.text
      el.className = `mono stock bx-stock${s.tone ? ` stock--${s.tone}` : ''}`
    }
    for (const el of [...inside('.bx-hp__cta'), ...inside('.bx-cta .btn')]) el.hidden = !p
    if (!p) continue
    const lp = localizeProduct(p)
    for (const el of inside('[data-woo-name]')) setSplitText(el, lp.name)
    for (const el of inside('[data-price]')) el.innerHTML = priceHtml(p.prices)
  }
}

async function loadWoo() {
  const views = document.querySelectorAll('.bx-view')
  views.forEach((v) => v.setAttribute('aria-busy', 'true'))
  try {
    const data = await api.products({ per_page: 48 })
    woo = new Map((data.products ?? []).map((p) => [p.slug, p]))
    applyWoo()
  } catch {
    // WooCommerce non risponde: restano i testi della pagina (senza disponibilita'), tutti i link funzionano
  } finally {
    views.forEach((v) => v.removeAttribute('aria-busy'))
  }
}

// ---------------------------------------------------------------------------
rise(document.querySelectorAll('[data-rise]'), { y: 30, stagger: 0.06, after: ready })
ready.then(() => {
  initParallax()
  // three.js e il barattolo dopo il primo disegno dei testi
  requestAnimationFrame(() => initJar())
})
loadWoo()
onLang(() => {
  menu?.relabel(menuProducts())
  applyWoo()
})
