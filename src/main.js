import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/cormorant-garamond/latin-300.css'
import './styles/base.css'
import './styles/sections.css'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'

import { MEDIA, currentLayout, sectionTops, applySectionSteps } from './config.js'
import { PRODUCTS, productById } from './products.js'
import { applyCssTheme, setLiquid } from './theme.js'
import { Stage } from './webgl/Stage.js'
import { Silk } from './webgl/Silk.js'
import { buildTrack, buildMaster, buildReveals, gotoMap, CURTAIN } from './choreography.js'
import { prepareText } from './ui/text.js'
import { initPointer } from './ui/pointer.js'
import { createStageUI } from './ui/stageUI.js'
import { mountLogos, composeLogo, LOGO_ORIGIN } from './ui/logo.js'
import { initNavLinks } from './ui/navLinks.js'
import { initNavMenu } from './ui/navMenu.js'
import { createProductMenu } from './ui/productMenu.js'
import { createMenuMorph } from './ui/menuMorph.js'
import { createMobileMenu } from './ui/mobileMenu.js'
import { initCookieNotice } from './ui/cookieNotice.js'
import { makeGrain } from './ui/grain.js'
import { bindCartCount } from './shop/cart.js'
import { applyCopy, fitIngredients, fitScience, fitHeroTitle } from './ui/copy.js'
import { LOGO } from './ui/logo-paths.js'
import { COPY } from './content.js'
import MODEL_VERSIONS from './model-versions.json'
import { createProductExperience, themeFromSite } from './components/ProductExperience/index.js'
import { ready as i18nReady, localize, t, formatNumber, onLang, translateDom } from './i18n/index.js'
import { DEFAULT_COPY, stepsFor } from './components/ProductExperience/copy.js'
import { initLangPicker } from './i18n/picker.js'

gsap.registerPlugin(ScrollTrigger, SplitText)

const html = document.documentElement
const reduced = matchMedia(MEDIA.reduced).matches
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const devFast = import.meta.env.DEV && new URLSearchParams(location.search).has('fast')

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

// lingua del sito scelta dal visitatore (src/i18n): i testi si scrivono gia' tradotti
await i18nReady

// Il preload parte subito: il logo vettoriale si compone mentre il resto carica
mountLogos()
initNavLinks()
initNavMenu() // pagina corrente e sottomenu di Acquista (Negozio, Carrello)
initLangPicker() // bandiera e tendina delle lingue nella navbar
bindCartCount()
const loaderLogo = document.querySelector('.loader .logo')
// il preload (il logo si compone, poi la camera ci entra) solo alla prima apertura della homepage in
// questa scheda: tornando alla homepage dalle altre pagine, o ricaricandola, si entra subito
const firstIntro = (() => {
  try {
    if (sessionStorage.getItem('nx_intro')) return false
    sessionStorage.setItem('nx_intro', '1')
  } catch {
    // archiviazione non disponibile: il preload si vede ogni volta
  }
  return true
})()
if (!firstIntro) gsap.set(loaderLogo, { autoAlpha: 0 })
const logoIn = firstIntro ? composeLogo(loaderLogo, { reduced, speed: devFast ? 20 : 1 }).play() : Promise.resolve()

// ---------------------------------------------------------------------------
// Misure: ogni sezione e' alta (passi + 1) viewport. L'altezza di riferimento
// cambia solo se cambia davvero lo schermo (non con la barra del browser mobile).
let vw = window.innerWidth
let vh = window.innerHeight
const getVh = () => vh
const setVh = () => html.style.setProperty('--vh', `${vh}px`)
// (sul telefono la storia ha meno passi, data-steps-mobile: cambiando layout, misure e testi si rifanno)
let stepsLayout = currentLayout()
applySectionSteps(stepsLayout)
setVh()
const T = sectionTops(stepsLayout)

makeGrain()

// ---------------------------------------------------------------------------
// Smooth scroll
const lenis = reduced
  ? null
  : new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, touchMultiplier: 1.15, autoRaf: false, anchors: false })
lenis?.on('scroll', ScrollTrigger.update)
lenis?.stop()
gsap.ticker.lagSmoothing(0)

const scrollY = () => (lenis ? lenis.animatedScroll : window.scrollY)
const currentT = () => scrollY() / vh

// prodotto mostrato (il primo della linea all'apertura): barattolo e colori di tutto il sito
// (?prodotto=id apre direttamente un prodotto: ogni prodotto ha il suo link)
let product = productById(new URLSearchParams(location.search).get('prodotto')) ?? PRODUCTS[0]
applyCssTheme(product.theme)
setLiquid(product.theme)
applyCopy(product.id) // testi del prodotto, prima che SplitText li divida
html.classList.toggle('no-lines', !product.labelAnchors)

// ---------------------------------------------------------------------------
// WebGL
const canvas = document.querySelector('.webgl')
let layout = currentLayout()
let reveals = null // entrate/uscite dei testi allo scroll (buildReveals)
let stage = null
try {
  stage = new Stage(canvas, {
    reduced,
    tier: layout === 'mobile' ? 'low' : layout === 'tablet' ? 'mid' : 'high',
    theme: product.theme,
  })
  stage.productScale = product.heroScale ?? 1
  // i barattoli tengono sempre l'etichetta italiana del modello, in ogni lingua del sito: sono
  // prodotti italiani (richiesta del 2026-10-09). L'etichetta tradotta si vede nella scheda prodotto.
} catch (err) {
  console.warn('WebGL non disponibile, uso l\'immagine statica.', err)
  useFallback()
}

// raso della hero: canvas separato a bassa risoluzione (se manca WebGL2 resta il gradiente CSS)
let silk = null
try {
  silk = new Silk(document.querySelector('.silk__c'), product.theme)
} catch (err) {
  console.warn('Sfondo animato non disponibile', err)
}

// menu prodotti della hero (le voci entrano con l'intro)
const menuRoot = document.querySelector('[data-pmenu]')
/** Le voci del menu prodotti con nome e nota nella lingua del sito. */
const menuProducts = () => PRODUCTS.map((p) => ({ ...p, name: t(p.name), note: t(p.note) }))
const menu =
  menuRoot &&
  createProductMenu(menuRoot, menuProducts(), {
    activeId: product.id,
    onSelect: (id) => switchProduct(id),
    onIntent: (id) => preloadProduct(id),
  })
if (menu) gsap.set([menu.toggle, menu.card, menu.head, ...menu.items], { autoAlpha: 0 })
if (!stage) menuRoot?.setAttribute('hidden', '')
// desktop: la scheda si richiude nel pulsante PRODOTTI (e si riapre) con un'animazione
const morph = menu && createMenuMorph(menu)

// RITUALE: l'onda del liquido deve continuare da una lettera all'altra
const ritualWord = document.querySelector('.hero-ritual__word')
ritualWord?.addEventListener('split', (e) => {
  const chars = e.detail.chars
  const x0 = chars[0]?.offsetLeft ?? 0
  for (const c of chars) c.style.setProperty('--bx', `${x0 - c.offsetLeft}px`)
})

let track = null
let master = null
let ui = null
let mobileMenu = null // menu hamburger (solo mobile)
// animazioni infinite della hero (onda di RITUALE, freccia): in pausa quando la hero non si vede
const heroLoops = []
let heroLoopsOn = true
const heroLoop = (tw) => heroLoops.push(tw.paused(!heroLoopsOn))
const target = {}
let debugPose = null // solo in sviluppo: posa forzata per tarare le inquadrature

function fitFor(lay) {
  const a = vw / vh
  return lay === 'mobile' ? clamp(a / 0.462, 0.82, 1.15) : clamp(a / 1.6, 0.64, 1)
}

function rebuild() {
  layout = currentLayout()
  // telefono <-> altri layout: cambiano i passi delle sezioni, quindi la mappa T e i tempi dei testi
  if ((layout === 'mobile') !== (stepsLayout === 'mobile')) {
    stepsLayout = layout
    applySectionSteps(layout)
    Object.assign(T, sectionTops(layout))
    if (reveals) {
      reveals.kill()
      reveals = buildReveals(T, { reduced, getVh, layout, hooks: ui.hooks })
    }
  }
  stage?.setLayout(layout)
  track = buildTrack(T, layout, fitFor(layout), vw / vh, product.geo)
  rebuildMaster()
}

function rebuildMaster() {
  // revert, non kill: riporta titoli, sipario e fondi allo stato di partenza prima di ricostruire.
  // Le tween nuove memorizzano come "prima dell'animazione" lo stato che trovano: con kill, dopo un
  // cambio prodotto o un resize a pagina scesa, tornando in cima i titoli della hero restavano
  // usciti (nascosti, sfocati, spostati)
  master?.revert()
  const p = product.theme.palette
  master = buildMaster(T, layout, p)
  const t = currentT()
  // in cima alla pagina la timeline nuova non ridisegna (il tempo non cambia): colori di partenza a mano
  if (t <= 0) gsap.set(html, { '--bg': p.paper, '--fg': p.ink, '--accent': p.berry })
  master.time(t)
}

// ---------------------------------------------------------------------------
// Rituale in un bicchiere: sezione 3D pinnata tra Scienza e La durata
// (src/components/ProductExperience). L'animazione segue il formato del prodotto: misurino e
// polvere che si scioglie nell'acqua, oppure capsula / compressa che gira attorno al bicchiere.
const ritualEl = document.querySelector('[data-product-experience]')
const ritualSteps = ritualEl ? parseFloat(ritualEl.dataset.steps) : 0
let ritual = null

// Benefici del prodotto (src/seo/catalog.js, gli stessi della pagina prodotto): nella macro della
// sezione, tre attorno alla capsula o alla compressa; per la polvere tre attorno al bicchiere, alla
// fine. Il catalogo si scarica a parte dopo l'avvio
// (alla homepage non serve altro); se arriva a sezione gia' creata, si aggiorna in un momento libero.
let benefitsOf = () => null
import('./seo/catalog.js')
  .then(({ productBySlug }) => {
    benefitsOf = (id) => productBySlug(id)?.benefits?.slice(0, 3).map(([, title, text]) => [title, text]) ?? null
    if (ritual) idle(() => ritual.setProduct(ritualOptions(product)))
  })
  .catch(() => {}) // senza catalogo resta il dettaglio della dose

const fact = (f) => (f ? [`${formatNumber(f.value)} ${f.unit}`.trim(), f.text] : null)

/**
 * Testi della sezione per un prodotto: dai dati gia' nel sito (dosi dell'etichetta in content.js),
 * eventuali testi propri in COPY[id].experience. Polvere: misurino e bicchiere d'acqua, alla fine
 * tre benefici attorno al bicchiere; capsule e compresse: nella macro tre benefici (il dettaglio
 * della dose se il catalogo non c'e'),
 * alla fine quante al giorno (e accanto al bicchiere se ne posano altrettante: perDay in
 * products.js; con maintenance anche quelle del mantenimento, a parte, con la loro etichetta).
 */
function ritualOptions(p) {
  // testi nella lingua del sito (src/i18n): quelli del prodotto e quelli di default della sezione
  const c = localize(COPY[p.id] ?? {})
  const base = localize(DEFAULT_COPY[p.form] ?? DEFAULT_COPY.powder)
  const facts = c.daily?.facts ?? []
  const pins =
    p.form === 'powder'
      ? { dose: fact(facts[0]), water: fact(facts[1]) }
      : { dose: c.pins?.dose, water: fact(facts[0]), aside: p.maintenance ? fact(facts[1]) : null }
  for (const k of Object.keys(pins)) if (!pins[k]) delete pins[k]
  // benefici nella lingua del sito (titolo e testo del catalogo tradotti)
  const benefits = benefitsOf(p.id)?.map(([title, text]) => [t(title), t(text)])
  const own = c.experience ?? {}
  return {
    type: p.form,
    shape: p.shape ?? null,
    count: p.perDay ?? 1,
    aside: p.maintenance ?? 0,
    productName: t(p.name),
    productNote: t(p.note),
    stepNames: (type) => stepsFor(type).map((name) => t(name)),
    posterAlt: (name) => t("{nome}: bicchiere d'acqua", { nome: name }),
    // studio scuro: il bicchiere e' il render di Blender (sezione bicchiere/blender/bicchiere_3d.py)
    theme: themeFromSite(p.theme, { studio: 'scuro' }),
    copy: { ...base, ...own, ...(benefits ? { benefits } : {}), pins: { ...base.pins, ...pins, ...(own.pins ?? {}) } },
    // immagine statica con i colori del prodotto (senza WebGL e mentre la scena 3D si carica),
    // versionata come i modelli: rifatte le immagini, la cache non mostra quelle vecchie
    poster: (layout) =>
      `/images/nutrexlab/esperienza-${p.id}${layout === 'mobile' ? '-mobile' : ''}.webp?v=${MODEL_VERSIONS['images/nutrexlab/esperienza'] ?? 0}`,
  }
}

function createRitual() {
  if (!ritualEl) return null
  return createProductExperience(ritualEl, {
    ...ritualOptions(product),
    steps: ritualSteps,
    getVh,
    etch: LOGO, // logo NUTREX LAB inciso sul bicchiere
    // modelli versionati come i barattoli (scripts/sync-model.mjs): la cache non mostra mai un file vecchio
    resolveModel: (file) => `/models/nutrexlab/${file}?v=${MODEL_VERSIONS[`nutrexlab/${file.replace(/\.glb$/, '')}`] ?? 0}`,
    // di solito e' gia' pronta (preload dopo l'intro); se si arriva prima, si completa da qui
    lazyMargin: '300%',
    calm: calmMoment,
  })
}

/**
 * Risolve in un momento tranquillo: nessuno scroll da almeno 0.4 s e il browser libero.
 * Il lavoro pesante (preparazione della sezione del bicchiere) si fa solo li': mai durante lo scroll.
 * La calma si conta da quando la pagina si e' fermata, non da quando la si chiede: a pagina ferma
 * i passi della preparazione si susseguono senza attese.
 */
let lastBusy = 0
lenis?.on('scroll', () => (lastBusy = performance.now()))
function calmMoment() {
  return new Promise((resolve) => {
    const check = () => {
      // fermo = nessuno scroll e nessun cambio prodotto in corso (barattolo che gira, colori che sfumano)
      const now = performance.now()
      if (lenis?.isScrolling || switching || now - lastSwitch < 2200) lastBusy = now
      if (now - lastBusy < 400) return setTimeout(check, 100)
      if (window.requestIdleCallback) requestIdleCallback(() => resolve(), { timeout: 400 })
      else resolve()
    }
    check()
  })
}

// ---------------------------------------------------------------------------
// Loop unico: Lenis -> scroll -> coreografia -> 3D -> UI
function tick(time, deltaMs) {
  lenis?.raf(time * 1000)
  const dt = Math.min(0.05, deltaMs / 1000)
  const t = currentT()
  if (track) track.sample(t, target)
  if (import.meta.env.DEV && debugPose) Object.assign(target, debugPose)
  master?.time(t)
  // mentre la sezione del bicchiere (o il menu mobile aperto) copre tutto lo schermo il barattolo
  // non si vede: niente rendering
  const covered = (ritual && t > T.ritual + 0.02 && t < T.ritual + ritualSteps - 0.02) || !!mobileMenu?.covers
  if (stage?.model && track && !covered) {
    stage.update(dt, time, target)
    stage.render()
    stage.adapt(dt)
  }
  if (silk) {
    // dopo la hero il raso e' coperto dal sipario (o dal menu mobile): smette di disegnare
    silk.active = t < T.story + CURTAIN.rise[1] + 0.05 && !mobileMenu?.covers
    silk.render(reduced ? 6 : time)
  }
  ui?.update(t, scrollY())
  if (menuRoot) dockMenu(scrollY() > 40) // come la navbar compatta
  // (i titoli della hero sono usciti a t ~0.75: oltre, l'onda e la freccia lavorerebbero per niente)
  const loopsOn = t < 0.9
  if (loopsOn !== heroLoopsOn) {
    heroLoopsOn = loopsOn
    for (const tw of heroLoops) tw.paused(!loopsOn)
  }
}

// Menu prodotti: nella hero (desktop) la scheda a destra; appena si inizia a scorrere si chiude in un
// pulsante PRODOTTI in alto a destra, sempre visibile, che apre la lista. Su mobile il pulsante c'e'
// sempre: nella hero sotto "Acquista ora", poi in basso a destra.
let menuDrop = null
let menuDock = null
function dockMenu(scrolled) {
  const mobile = layout === 'mobile'
  const drop = mobile || scrolled
  const dock = mobile && scrolled
  if (drop === menuDrop && dock === menuDock) return
  const cl = menuRoot.classList
  cl.remove('was-dock')
  if (menuDock && !dock && mobile) cl.add('was-dock')
  cl.toggle('is-dock', dock)
  html.classList.toggle('menu-docked', drop && !mobile) // navbar: spazio per il pulsante (schermi medi)
  menu?.close()
  // desktop: viaggio animato tra scheda e pulsante; mobile, movimento ridotto e primo frame: subito
  if (!mobile && !reduced && menuDrop !== null) morph.to(drop)
  else morph.settle(drop)
  menuDrop = drop
  menuDock = dock
}

/** Larghezza del gruppo a destra della navbar ("Acquista ora" e, sul desktop, il pulsante dell'account):
 *  il pulsante PRODOTTI (desktop) gli si affianca. */
function measureCta() {
  const right = document.querySelector('.nav__right') ?? document.querySelector('.nav__cta')
  if (right) html.style.setProperty('--cta-w', `${right.offsetWidth}px`)
}

// ---------------------------------------------------------------------------
async function boot() {
  const fonts = document.fonts?.ready ?? Promise.resolve()
  const model = stage
    ? stage.load(product).catch((err) => {
        console.error('Modello non caricato', err)
        useFallback()
      })
    : Promise.resolve()
  await Promise.all([fonts, model])

  fitHeroTitle() // (prima della divisione in lettere: nelle altre lingue il titolo si allarga come in italiano)
  prepareText(reduced)
  fitIngredients() // (con i font caricati)
  fitScience()
  measureCta()
  rebuild()
  if (stage?.model) {
    stage.buildParticles(layout === 'mobile' ? 7000 : layout === 'tablet' ? 11000 : 16000, layout)
    // compila subito tutti gli shader (niente scatti alla prima dissolvenza)
    stage.particles.points.visible = true
    stage.renderer.compile(stage.scene, stage.camera)
    stage.particles.points.visible = false
  }
  ui = createStageUI({ T, stage, getLayout: () => layout, getProduct: () => product })
  reveals = buildReveals(T, { reduced, getVh, layout, hooks: ui.hooks })
  initPointer(stage, { reduced })
  // (prima di initNav: toccando una voce il menu si chiude e lo scroll riparte prima del salto)
  mobileMenu = createMobileMenu({ lenis, reduced, onOpen: () => menu?.close() })
  initNav()
  initBuy()
  initFooterLogo()
  initSeal()
  ritual = createRitual()
  if (ritualEl) translateDom(ritualEl) // (etichette accessibili della sezione nella lingua del sito)
  // cambio lingua (src/i18n): testi del prodotto, menu prodotti e sezione del bicchiere nella nuova lingua
  // (i barattoli 3D no: etichetta italiana sempre)
  onLang(() => {
    applyCopy(product.id)
    menu?.relabel(menuProducts())
    ui?.setProduct()
    if (ritual) {
      ritual.setProduct(ritualOptions(product))
      translateDom(ritualEl)
    }
    fitIngredients()
    fitScience()
    fitHeroTitle()
  })
  ScrollTrigger.refresh()
  gsap.ticker.add(tick)

  if (import.meta.env.DEV) {
    window.__site = { lenis, stage, T, jump, getVh, target, switchProduct, gsap, ritual, mobileMenu, setPose: (p) => (debugPose = p) }
  }

  // lo zoom parte solo a logo completamente composto (e con una brevissima pausa)
  if (firstIntro) {
    await logoIn
    if (!reduced && !devFast) await new Promise((r) => setTimeout(r, 280))
  }
  html.classList.add('is-ready')
  intro()
}

function intro() {
  const tl = gsap.timeline()
  if (devFast) tl.timeScale(40)
  else if (!firstIntro && !reduced) tl.timeScale(1.4) // senza preload anche l'ingresso e' piu' rapido
  const loader = document.querySelector('.loader')

  // 1) la camera "entra" nel monogramma: piccola anticipazione, poi zoom rapidissimo
  //    dentro la diagonale bianca della N, che diventa lo sfondo del sito
  //    (senza preload il fondo del caricamento si dissolve e basta)
  if (reduced) {
    tl.to(loader, { autoAlpha: 0, duration: 0.6 }, 0)
  } else if (!firstIntro) {
    tl.to(loader, { autoAlpha: 0, duration: 0.4, ease: 'power1.out' }, 0)
  } else {
    gsap.set(loaderLogo, { transformOrigin: LOGO_ORIGIN })
    tl.to(loaderLogo, { scale: 0.94, duration: 0.34, ease: 'power2.inOut' }, 0)
    tl.to(loaderLogo, { scale: 170, duration: 1.0, ease: 'expo.in' }, 0.3)
    tl.to(loader, { autoAlpha: 0, duration: 0.35, ease: 'power1.out' }, 1.08)
  }
  tl.add(() => html.classList.remove('is-loading'), firstIntro ? 0.4 : 0.05)
  tl.set(loader, { display: 'none' }, reduced ? 0.7 : firstIntro ? 1.5 : 0.45)

  const $ = (s) => document.querySelector(s)
  const chars = (s) => $(s)?._split?.chars ?? []
  const lines = (s) => $(s)?._split?.lines ?? []
  const heroTexts = ['.hero-il', '.hero-ritual__word', '.hero-quot__word', '.hero-lead__sub'].map($)
  const fx = stage?.heroFX
  const silkCanvas = $('.silk__c')

  if (reduced) {
    tl.to(silkCanvas, { autoAlpha: 1, duration: 0.8 }, 0.3)
    if (stage?.model) {
      Object.assign(fx.intro, { reveal: 1, burst: 1 })
      tl.to(canvas, { opacity: 1, duration: 0.8 }, 0.3)
    }
    const all = [...chars('.hero-il'), ...chars('.hero-ritual__word'), ...chars('.hero-quot__word'), ...lines('.hero-lead__sub')]
    tl.to(all, { autoAlpha: 1, yPercent: 0, duration: 0.8 }, 0.5)
    if (menu) tl.to([menu.toggle, menu.card, menu.head, ...menu.items], { autoAlpha: 1, duration: 0.8, onStart: () => menu.reveal('auto') }, 0.5)
    tl.add(() => heroTexts.forEach((el) => el && (el._state = 'shown')), 0.5)
    tl.add(() => lenis?.start(), 0.5)
    tl.add(() => ritual?.preload(), 1.5)
    tl.add(initCookieNotice, 1.5)
    return
  }

  // 2) sequenza d'ingresso: ogni elemento entra dopo il precedente, con un movimento diverso
  //    (senza preload parte subito)
  const at = (offset) => (firstIntro ? 1.0 : 0.1) + offset
  const navClear = { clearProps: 'transform,opacity,visibility' }

  // il raso si posa (leggero zoom indietro)
  tl.fromTo(silkCanvas, { autoAlpha: 0, scale: 1.14 }, { autoAlpha: 1, scale: 1, duration: 2.8, ease: 'power2.out' }, at(-0.15))

  if (stage?.model) {
    tl.set(canvas, { opacity: 1 }, at(0))
    // il nastro di liquido scende dall'alto
    tl.fromTo(fx.intro, { reveal: 0 }, { reveal: 1, duration: 2.3, ease: 'power2.inOut' }, at(0))
    // il barattolo sale da sotto ruotando su se stesso e resta sospeso
    tl.fromTo(
      stage.intro,
      { lift: -1.4, rot: -2.9, scale: 0.84 },
      { lift: 0, rot: 0, scale: 1, duration: 2.3, ease: 'expo.out' },
      at(0.2),
    )
    // all'arrivo: esplosione di polvere e schizzi
    tl.fromTo(fx.intro, { burst: 0 }, { burst: 1, duration: 2.2, ease: 'power3.out' }, at(0.62))
  }

  // IL TUO: le lettere salgono dalla maschera
  tl.fromTo(
    chars('.hero-il'),
    { yPercent: 112, rotation: 7, visibility: 'inherit' },
    { yPercent: 0, rotation: 0, duration: 1.2, ease: 'expo.out', stagger: 0.055 },
    at(0.75),
  )
  // RITUALE: le lettere si aprono in 3D da destra, poi si riempiono di liquido
  tl.fromTo(
    chars('.hero-ritual__word'),
    { autoAlpha: 0, rotationY: 100, transformOrigin: '100% 50%' },
    { autoAlpha: 1, rotationY: 0, duration: 1.4, ease: 'expo.out', stagger: { each: 0.07, from: 'end' } },
    at(1.0),
  )
  tl.fromTo(ritualWord, { '--level': '1.15em' }, { '--level': '0.5em', duration: 2.4, ease: 'power2.inOut' }, at(1.15))
  tl.add(() => {
    heroLoop(gsap.fromTo(ritualWord, { '--wave': '0em' }, { '--wave': '-2.4em', duration: 6, ease: 'none', repeat: -1 }))
  }, at(1.0))
  // QUOTIDIANO: le lettere arrivano dal fuori fuoco, dal centro verso i lati
  // (sul telefono senza sfocatura: il filtro animato va ridisegnato a ogni fotogramma)
  const quotBlur = layout === 'mobile' ? ['none', 'none'] : ['blur(16px)', 'blur(0px)']
  tl.fromTo(
    chars('.hero-quot__word'),
    { autoAlpha: 0, scale: 2.4, filter: quotBlur[0] },
    {
      autoAlpha: 1, scale: 1, filter: quotBlur[1], duration: 1.3, ease: 'expo.out',
      stagger: { each: 0.045, from: 'center' }, clearProps: 'filter',
    },
    at(1.3),
  )
  tl.fromTo(
    '.hero-quot__dot',
    { scale: 0, rotation: -140, transformOrigin: '50% 50%' },
    { scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(2.6)' },
    at(2.0),
  )
  // sottotitolo: le righe scorrono da sinistra
  tl.fromTo(
    lines('.hero-lead__sub'),
    { yPercent: 0, xPercent: -104, visibility: 'inherit' },
    { xPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1 },
    at(1.6),
  )
  // pulsante: la pillola si apre da sinistra, poi arriva il testo
  tl.fromTo(
    '.hero-lead__cta',
    { clipPath: 'inset(0% 100% 0% 0% round 999px)' },
    { clipPath: 'inset(0% 0% 0% 0% round 999px)', duration: 1.1, ease: 'expo.inOut', clearProps: 'clipPath' },
    at(1.85),
  )
  tl.fromTo(
    '.hero-lead__cta > *',
    { xPercent: -40, autoAlpha: 0 },
    { xPercent: 0, autoAlpha: 1, duration: 0.9, ease: 'expo.out', stagger: 0.08 },
    at(2.2),
  )
  // menu: logo da sinistra, voci dall'alto una alla volta, pulsante da destra
  // (tornando alla homepage dalle altre pagine il menu resta fermo al suo posto)
  if (firstIntro) {
    tl.fromTo('.nav__logo', { xPercent: -120, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', ...navClear }, at(2.1))
    tl.fromTo('.nav__links > *', { yPercent: -180, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.09, ...navClear }, at(2.25))
    tl.fromTo('.nav__cta', { xPercent: 120, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', ...navClear }, at(2.45))
    // il pulsante rotondo (account sul desktop, hamburger su mobile) arriva per ultimo, ruotando appena
    tl.fromTo('.nav__account, .nav__burger', { scale: 0.5, rotation: -90, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.1, ease: 'back.out(2)', ...navClear }, at(2.6))
  }
  // menu prodotti: la scheda entra da destra, poi titolo e voci una alla volta
  // (su mobile entra il pulsante PRODOTTI, sotto "Acquista ora", come quello da destra)
  if (menu) {
    tl.fromTo(menu.toggle, { xPercent: 120, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', clearProps: 'transform' }, at(2.6))
    tl.fromTo(menu.card, { x: 60, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.3, ease: 'expo.out', clearProps: 'transform' }, at(2.2))
    tl.fromTo(
      [menu.head, ...menu.items],
      { x: 24, autoAlpha: 0 },
      { x: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out', stagger: 0.09, clearProps: 'transform' },
      at(2.4),
    )
  }
  // il sipario sale dal fondo e la sua curva si assesta come un liquido
  tl.fromTo('.curtain__slide', { yPercent: 32 }, { yPercent: 0, duration: 1.8, ease: 'expo.out' }, at(2.0))
  tl.fromTo(
    '.curtain__cap svg',
    { scaleY: 2.4, transformOrigin: '50% 100%' },
    { scaleY: 1, duration: 2.0, ease: 'elastic.out(1, 0.55)' },
    at(2.15),
  )
  // invito allo scroll: il punto cade e disegna la linea, poi il testo
  tl.fromTo('.hero-cue__dot', { scale: 0 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' }, at(2.5))
  tl.fromTo('.hero-cue__line', { scaleY: 0 }, { scaleY: 1, duration: 1.2, ease: 'expo.inOut' }, at(2.6))
  tl.fromTo('.hero-cue__text', { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.9, ease: 'power3.out' }, at(3.0))
  // pulsante rotondo: compare ruotando, poi la freccia "respira"
  tl.fromTo('.hero-down__in', { scale: 0, rotation: -90 }, { scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(2.2)' }, at(2.7))
  tl.add(() => {
    heroLoop(gsap.to('.hero-down__icon', { y: 3, duration: 0.85, ease: 'sine.inOut', repeat: -1, yoyo: true }))
  }, at(3.6))

  tl.add(() => heroTexts.forEach((el) => el && (el._state = 'shown')), at(1.7))
  tl.add(() => menu?.reveal('auto'), at(2.2)) // prodotto aperto da link: visibile anche in fondo alla lista
  tl.add(() => lenis?.start(), at(1.7))
  // a intro finita la sezione del bicchiere si prepara in anticipo, nei momenti in cui non si scorre
  tl.add(() => ritual?.preload(), at(3.8))
  // avviso sui cookie a intro finita (non copre il preload e l'ingresso della hero)
  tl.add(initCookieNotice, at(3.4))
}

/** Pulsante finale ("Acquista il collagene"): la pagina del prodotto mostrato (prezzo, varianti, carrello). */
function initBuy() {
  document.querySelectorAll('[data-buy]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault()
      window.location.assign(`/prodotto/${encodeURIComponent(product.id)}`)
    }),
  )
}

/** Nel footer il logo si ricompone quando entra in scena. */
function initFooterLogo() {
  const svg = document.querySelector('.footer__brand .logo')
  if (!svg) return
  // sul telefono solo una dissolvenza: la composizione ridisegnava il grande logo a ogni fotogramma
  const tl = composeLogo(svg, { reduced: reduced || layout === 'mobile', speed: 1.15 })
  ScrollTrigger.create({
    trigger: '[data-footer]',
    start: 'top 55%',
    onEnter: () => tl.restart(),
    onLeaveBack: () => tl.reverse(),
  })
}

/** Sigillo Made in Italy: la scritta circolare gira solo mentre il sigillo e' sullo schermo. */
function initSeal() {
  const seal = document.querySelector('.cert__seal')
  if (!seal) return
  if (!('IntersectionObserver' in window)) return seal.classList.add('is-on')
  new IntersectionObserver((list) => seal.classList.toggle('is-on', list[list.length - 1].isIntersecting)).observe(seal)
}

// ---------------------------------------------------------------------------
// Cambio prodotto dal menu della hero: il barattolo attuale accelera ruotando, al
// massimo della velocita' viene sostituito e il nuovo rallenta fino a fermarsi di
// fronte. Intanto tutti i colori sfumano verso quelli del nuovo prodotto e il
// liquido di RITUALE si svuota e si riempie del nuovo colore.
// Scegliendo un prodotto piu' in basso nella pagina (pulsante PRODOTTI) si torna prima nella hero
// (backToHero) e l'animazione parte da li'.
const TAU = Math.PI * 2
const SPIN = 24 // rad/s: velocita' massima della rotazione (circa 4 giri al secondo)
let switching = false
let lastSwitch = -1e9 // ultimo cambio prodotto (performance.now): i lavori pesanti aspettano che finisca
let queued = null
let blend = null

function preloadProduct(id) {
  const p = productById(id)
  if (p && stage) stage.loadProduct(p).catch(() => {})
}

/**
 * Sfuma tutti i colori del sito dal tema a al tema b. css: false = solo le parti 3D (raso, barattolo,
 * effetti): i colori della pagina li cambia poi applyPageTheme.
 */
function blendTheme(a, b, duration, { css = true } = {}) {
  if (css) {
    // prima la timeline (fondi delle scene guidati dallo scroll con la nuova palette), poi i colori:
    // ricostruendola legge stili calcolati, e dopo il cambio dei colori quella lettura costringeva il
    // browser a ricalcolare subito tutta la pagina. La classe is-theming va messa prima, perche'
    // anche i colori impostati dalla timeline sfumino.
    html.classList.add('is-theming')
    rebuildMaster()
    applyCssTheme(b, { animate: true, duration })
  }
  blend?.kill()
  const mix = { k: 0 }
  const paint = () => {
    silk?.setTheme(a, b, mix.k)
    stage?.setTheme(a, b, mix.k)
  }
  blend = gsap.to(mix, { k: 1, duration, ease: 'power2.inOut', onUpdate: paint, onComplete: paint })
}

/** Il barattolo nuovo arriva alla velocita' massima e rallenta fino al fronte (giro intero). */
function spinIn() {
  const swap = stage.swap
  const from = swap.rot
  const to = Math.ceil((from + 12) / TAU) * TAU // almeno ~2 giri
  // power3.out parte con velocita' 4 * giri / durata: uguale a SPIN, nessuno strappo
  gsap.to(swap, {
    rot: to,
    duration: (4 * (to - from)) / SPIN,
    ease: 'power3.out',
    onComplete: () => (swap.rot = 0),
  })
  gsap.to(swap, { scale: 1, duration: 1.4, ease: 'expo.out' })
}

/**
 * Telefono: i colori della pagina (custom properties sulla radice) cambiano in un colpo solo, nel
 * momento in cui arriva il nuovo barattolo; sfumarli faceva ricalcolare lo stile di tutta la pagina a
 * ogni fotogramma per 1.6 s. Le parti 3D (raso, barattolo, nastro, particelle) sfumano comunque.
 */
const cssBlend = () => layout !== 'mobile'

function applyPageTheme(theme) {
  rebuildMaster() // (prima dei colori: vedi blendTheme)
  applyCssTheme(theme)
}

/** Esplosione al cambio prodotto (desktop e mobile), con la hero sullo schermo. */
const burstHere = () => !reduced && !!stage?.heroFX && currentT() < 0.35

let copyJob = 0
/**
 * Testi del nuovo prodotto. Quello che si vede si aggiorna subito, insieme al barattolo; le sezioni
 * lontane (ingredienti, scienza, la durata, shop e la sezione del bicchiere) appena finita
 * l'animazione del cambio, ciascuna in un momento libero del browser: tutte nello stesso
 * fotogramma del nuovo barattolo erano il lavoro piu' pesante del cambio, soprattutto sul telefono.
 */
function applyProductCopy(p) {
  const job = ++copyJob
  const t = currentT()
  const nearRest = t > T.ingredients - 1.5
  const nearRitual = !!ritual && t > T.ritual - 2.5 && t < T.ritual + ritualSteps + 1.5
  applyCopy(p.id, { animate: !reduced, parts: nearRest ? 'all' : 'top' })
  if (nearRitual) ritual.setProduct(ritualOptions(p))
  const later = []
  if (!nearRest) later.push(() => applyCopy(p.id, { parts: 'rest' }))
  if (ritual && !nearRitual) later.push(() => ritual.setProduct(ritualOptions(p)))
  const next = () => {
    if (job !== copyJob) return // nel frattempo un altro cambio prodotto: aggiorna lui
    later.shift()?.()
    if (later.length) idle(next)
  }
  if (!later.length) return
  if (reduced) later.splice(0).forEach((fn) => fn())
  else gsap.delayedCall(1.7, () => idle(next))
}

/** Prossimo momento libero del browser (al massimo dopo 0.8 s). */
function idle(fn) {
  if (window.requestIdleCallback) requestIdleCallback(() => fn(), { timeout: 800 })
  else setTimeout(fn, 60)
}

async function switchProduct(id) {
  const next = productById(id)
  if (!next || !stage?.model) return
  if (switching) {
    queued = id
    return
  }
  if (next === product) return
  switching = true
  lastSwitch = performance.now()
  menu?.setActive(next.id)
  const ready = stage.loadProduct(next) // (il modello si scarica anche mentre la pagina torna in cima)
  let entry = null
  ready.then((e) => (entry = e)).catch(() => {})
  // da qualsiasi sezione della homepage il cambio riparte dalla hero: prima si torna in cima, poi li'
  // il barattolo di prima gira e lascia il posto a quello scelto
  await backToHero()
  lastSwitch = performance.now()
  const prev = product
  product = next

  if (reduced) {
    await gsap.to(canvas, { opacity: 0, duration: 0.25 })
    entry = await ready.catch(() => null)
  } else {
    const swap = stage.swap
    gsap.killTweensOf(swap)
    // 1) il barattolo attuale accelera e si allontana appena
    const out = gsap
      .timeline()
      .to(swap, { rot: swap.rot + (SPIN * 0.6) / 3, duration: 0.6, ease: 'power2.in' }, 0)
      .to(swap, { scale: 0.9, duration: 0.6, ease: 'power2.in' }, 0)
    gsap.to(ritualWord, { '--level': '1.15em', duration: 0.55, ease: 'power2.in', overwrite: 'auto' })
    const css = cssBlend() // (telefono: i colori della pagina cambiano all'arrivo del barattolo)
    gsap.delayedCall(0.1, () => blendTheme(prev.theme, next.theme, 1.6, { css }))
    if (burstHere()) gsap.to(stage.heroFX.intro, { burst: 0.45, duration: 0.6, ease: 'power2.in', overwrite: 'auto' })
    await out
    // modello non ancora scaricato: continua a girare alla stessa velocita' finche' arriva
    if (!entry) {
      const spin = (time, deltaMs) => (swap.rot += (SPIN * Math.min(deltaMs, 50)) / 1000)
      gsap.ticker.add(spin)
      entry = await ready.catch(() => null)
      gsap.ticker.remove(spin)
    }
  }

  if (!entry) {
    // download fallito: resta il prodotto di prima
    console.error('Modello non caricato', next.model)
    product = prev
    menu?.setActive(prev.id)
    // i colori avevano gia' iniziato a cambiare (sul telefono solo quelli 3D)
    if (!reduced) blendTheme(next.theme, prev.theme, 0.8, { css: cssBlend() })
  } else {
    stage.setProduct(entry)
    if (!reduced && !cssBlend()) applyPageTheme(product.theme)
    html.classList.toggle('no-lines', !product.labelAnchors)
    setLiquid(product.theme)
    // inquadrature delle scene e dettagli agganciati al nuovo barattolo
    track = buildTrack(T, layout, fitFor(layout), vw / vh, product.geo)
    ui?.setProduct()
    // testi della pagina e sezione del bicchiere (quello che non si vede, subito dopo l'animazione);
    // dal fotogramma dopo, per non sommarli al nuovo barattolo e ai colori nello stesso fotogramma
    const shown = product
    if (reduced) applyProductCopy(shown)
    else requestAnimationFrame(() => product === shown && applyProductCopy(shown))
    const url = new URL(location.href)
    if (product === PRODUCTS[0]) url.searchParams.delete('prodotto')
    else url.searchParams.set('prodotto', product.id)
    history.replaceState(history.state, '', url)
    if (reduced) blendTheme(prev.theme, product.theme, 0.5)
  }

  // 2) il nuovo barattolo (o quello di prima, se il download e' fallito) torna di fronte,
  //    crescendo fino alla sua misura nella hero (heroScale)
  const heroScale = product.heroScale ?? 1
  if (reduced) {
    stage.productScale = heroScale
    gsap.to(canvas, { opacity: 1, duration: 0.4 })
  } else {
    gsap.to(stage, { productScale: heroScale, duration: 1.4, ease: 'expo.out', overwrite: 'auto' })
    spinIn()
    // desktop, nella hero: il nuovo barattolo arriva con un'esplosione di colori e la polvere riesplode
    if (entry && burstHere()) stage.burstColors(product.theme)
    if (stage.heroFX && stage.heroFX.intro.burst < 1) {
      gsap.to(stage.heroFX.intro, { burst: 1, duration: 1.8, ease: 'expo.out', overwrite: 'auto' })
    }
    gsap.to(ritualWord, { '--level': '0.5em', duration: 1.6, ease: 'power2.inOut', overwrite: 'auto' })
  }
  switching = false
  lastSwitch = performance.now() // il nuovo barattolo sta ancora rallentando: altri ~1.5 s di animazione
  const again = queued
  queued = null
  if (again && again !== product.id) switchProduct(again)
}

// ---------------------------------------------------------------------------
// Navigazione: salti brevi scorrono, salti lunghi passano da una dissolvenza
function initNav() {
  document.querySelectorAll('[data-goto]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault()
      jump(gotoMap(T)[a.dataset.goto] ?? 0) // (T puo' cambiare con il layout)
    })
  })
}

function jump(t) {
  const y = t * vh
  if (!lenis) {
    window.scrollTo(0, y)
    stage?.snap()
    return
  }
  if (Math.abs(currentT() - t) < 1.6) {
    lenis.scrollTo(y, { duration: 1.6 })
    return
  }
  const veil = document.querySelector('.veil')
  veil.style.background = getComputedStyle(document.body).backgroundColor // il fondo del momento (choreography.js)
  gsap
    .timeline()
    .to(veil, { opacity: 1, duration: 0.5, ease: 'power2.inOut' })
    .add(() => {
      lenis.scrollTo(y, { immediate: true, force: true })
      stage?.snap()
    })
    .to(veil, { opacity: 0, duration: 0.9, ease: 'power2.inOut', delay: 0.15 })
}

/**
 * Prima di un cambio prodotto: torna in cima alla homepage e risolve quando la hero e' di nuovo
 * sullo schermo. Appena scesi (sipario che sale) la pagina scorre su; piu' in basso passa dalla
 * dissolvenza del velo, come i salti lunghi della navigazione. Con movimento ridotto: subito.
 */
function backToHero() {
  if (scrollY() < 1) return Promise.resolve()
  if (!lenis) {
    window.scrollTo(0, 0)
    stage?.snap()
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const t = currentT()
    if (t < 1) {
      // (lock: niente scroll a mano finche' non si arriva in cima)
      const duration = 0.3 + 0.8 * t
      lenis.scrollTo(0, { duration, lock: true, force: true, onComplete: () => resolve() })
      gsap.delayedCall(duration + 0.3, resolve) // se un salto della navigazione interrompe lo scroll
      return
    }
    const veil = document.querySelector('.veil')
    veil.style.background = getComputedStyle(document.body).backgroundColor // il fondo del momento
    gsap
      .timeline()
      .to(veil, { opacity: 1, duration: 0.45, ease: 'power2.inOut' })
      .add(() => {
        lenis.scrollTo(0, { immediate: true, force: true })
        stage?.snap()
      })
      .to(veil, { opacity: 0, duration: 0.7, ease: 'power2.inOut', delay: 0.15 })
      // il barattolo di prima inizia a girare con la hero gia' quasi tutta visibile
      .add(() => resolve(), '-=0.25')
  })
}

// ---------------------------------------------------------------------------
let resizeTimer = 0
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    const w = window.innerWidth
    const h = window.innerHeight
    // su mobile ignora la sola comparsa/scomparsa della barra degli indirizzi
    if (w === vw && layout === 'mobile' && Math.abs(h - vh) < 160) return
    vw = w
    vh = h
    setVh()
    stage?.resize()
    silk?.resize()
    rebuild()
    ScrollTrigger.refresh()
    ui?.resize()
    fitIngredients()
    fitScience()
    measureCta()
  }, 160)
})

function useFallback() {
  html.classList.add('no-webgl')
  const img = document.querySelector('.fallback')
  if (img) img.hidden = false
  document.querySelector('[data-pmenu]')?.setAttribute('hidden', '') // senza 3D il menu non ha effetto
  stage = null
}

boot()
