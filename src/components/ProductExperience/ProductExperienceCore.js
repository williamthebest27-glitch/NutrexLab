import { addTrack, addLines, addFade, createScrollAnimation, gsap, LINE_BELOW, LINE_ABOVE } from './ScrollAnimation.js'
import { currentLayout, detectQuality, webglAvailable } from './quality.js'
import { stepsFor, resolveCopy } from './copy.js'

/*
  ProductExperience: sezione pinnata con la scena 3D del prodotto (bicchiere d'acqua + misurino,
  capsula o compressa), guidata dallo scroll.

    const exp = new ProductExperience(section, { type: 'powder', productName: 'Collagene marino' })
    exp.setProduct({ type: 'capsule', theme, copy })   // cambio prodotto (il tipo sceglie l'animazione)
    exp.destroy()

  Il tipo (powder | capsule | tablet) sceglie automaticamente l'esperienza: ognuna e' un modulo a
  parte, caricato solo quando serve, come il suo modello 3D. La parte WebGL parte quando la sezione
  si avvicina allo schermo (lazy) e disegna solo mentre e' visibile. Senza WebGL resta un'immagine
  statica del prodotto con gli stessi testi animati.
*/

const EXPERIENCES = {
  powder: () => import('./PowderExperience.js').then((m) => m.PowderExperience),
  capsule: () => import('./CapsuleExperience.js').then((m) => m.CapsuleExperience),
  tablet: () => import('./TabletExperience.js').then((m) => m.TabletExperience),
}

/** Tempi (progresso 0..1) di testi, etichette e sequenza: polvere / capsula e compressa. */
const TIMING = {
  powder: {
    titleAOut: 0.16,
    titleBIn: 0.905, // quando la camera, allontanandosi, ha liberato lo spazio del titolo
    pins: { dose: [0.255, 0.5], water: [0.885, 1.01] },
    steps: [0, 0.2, 0.45, 0.66, 0.86],
  },
  showcase: {
    titleAOut: 0.16,
    titleBIn: 0.875,
    // l'etichetta del prodotto sparisce prima che il bicchiere rientri nell'inquadratura (0.8);
    // i tre benefici della macro (al posto della dose) compaiono uno dopo l'altro; quella dei pezzi
    // a parte (aside) compare quando si posano
    pins: {
      dose: [0.645, 0.76],
      b1: [0.645, 0.76],
      b2: [0.665, 0.76],
      b3: [0.685, 0.76],
      water: [0.905, 1.01],
      aside: [0.965, 1.01],
    },
    steps: [0, 0.18, 0.5, 0.66, 0.86],
  },
}
const timingFor = (type) => (type === 'powder' ? TIMING.powder : TIMING.showcase)

/**
 * Etichette agganciate al 3D [chiave, classe]: dose (sul prodotto), water (sul bicchiere), aside
 * (sui pezzi a parte), b1-b3 (i benefici attorno al prodotto nella macro di capsule e compresse).
 */
const PINS = [
  ['dose', ''],
  ['water', 'pe__pin--left'],
  ['aside', ''],
  ['b1', 'pe__pin--benefit'],
  ['b2', 'pe__pin--benefit'],
  ['b3', 'pe__pin--benefit'],
]

const DEFAULT_THEME = {
  bgLow: '#0b0a0d',
  bgGlow: '#2a2329',
  pool: '#1a181c',
  cloud: '#d6d4d0',
  rim: '#ffd9ea',
  accent: '#d45c95',
  powder: '#d79ab3',
  capsuleBody: '#f3f0e8',
  tablet: '#ede7dc',
  speckle: '#c45a90',
}

const POSTERS = { powder: 'esperienza-polvere', capsule: 'esperienza-capsula', tablet: 'esperienza-compressa' }

/** Esposizione dello studio (tone mapping AgX). */
const EXPOSURE = 1.35

export class ProductExperience {
  constructor(section, options = {}) {
    this.section = section
    this.o = {
      type: 'powder',
      steps: 4,
      productName: '',
      productNote: '',
      chapter: '',
      model: null, // URL del modello del prodotto al posto di quello del tipo (es. scoop.glb)
      shape: null, // forma del prodotto, se il tipo ne ha piu' d'una: 'oval' = compressa ovale
      count: 1, // capsule o compresse della dose del giorno: alla fine si posano tutte accanto al bicchiere
      aside: 0, // pezzi a parte, accanto alla dose, con la loro etichetta (copy.pins.aside): es. il mantenimento
      resolveModel: null, // (file) => URL, per esempio con la versione del file nell'indirizzo
      modelsPath: '/models/nutrexlab/',
      postersPath: '/images/nutrexlab/',
      poster: null, // immagine statica del prodotto: URL o (layout) => URL; senza, quella del tipo
      dracoPath: '/draco/',
      theme: DEFAULT_THEME,
      copy: {},
      etch: null, // logo da incidere sul bicchiere (formato di src/ui/logo-paths.js del sito)
      etchOptions: {},
      getVh: () => window.innerHeight,
      scrub: true,
      lazyMargin: '150%',
      ...options,
    }
    this.type = this.o.type in EXPERIENCES ? this.o.type : 'powder'
    this.theme = { ...DEFAULT_THEME, ...this.o.theme }
    this.copy = resolveCopy(this.type, this.o.copy)
    this.layout = currentLayout()
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.quality = { ...detectQuality(this.layout), ...(this.o.quality ?? {}) }
    this.ui = { exposure: 1 } // (e la visibilita' di ogni etichetta: pinDose, pinWater...)
    this.size = { w: 1, h: 1 }
    this.ready = false
    this.active = false
    this.stepIndex = -1
    this._pin = { x: 0, y: 0, visible: true }
    this._body = { x: 0, y: 0, visible: true }

    this.buildDom()
    this.renderCopy()
    this.applyCssTheme()
    this.rebuild()
    this.observe()
    // con i font definitivi cambiano le misure di titoli ed etichette
    document.fonts?.ready.then(() => {
      if (this.destroyed) return
      this.pins.forEach((pin) => (pin.textW = 0))
      this.fitTitles()
    })
    this._onResize = () => this.onResize()
    window.addEventListener('resize', this._onResize)
    // la larghezza della sezione puo' cambiare senza resize della finestra (la barra di scorrimento
    // compare a fine caricamento): il pin fissa la larghezza quando misura, va rimisurato
    if ('ResizeObserver' in window) {
      let width = 0
      let winW = window.innerWidth
      this._ro = new ResizeObserver((entries) => {
        const w = Math.round(entries[entries.length - 1].contentRect.width)
        if (!width || w === width) return void (width = w)
        width = w
        // (se e' cambiata la finestra ci pensa il resize del sito, che rimisura tutto)
        if (window.innerWidth !== winW) return void (winW = window.innerWidth)
        this.scroll?.triggers[0].refresh()
        if (this.scene) this.resize()
      })
      this._ro.observe(this.section)
    }
    this._onPointer = (e) => this.onPointer(e)
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) window.addEventListener('pointermove', this._onPointer, { passive: true })
  }

  // ---------------------------------------------------------------------------
  // DOM
  buildDom() {
    const s = this.section
    s.classList.add('pe')
    s.style.setProperty('--pe-steps', this.o.steps)
    s.innerHTML = `
      <div class="pe__stage">
        <img class="pe__poster" alt="" decoding="async" />
        <canvas class="pe__canvas" aria-hidden="true"></canvas>
        <div class="pe__fade" aria-hidden="true"></div>
        <div class="pe__copy pe__copy--a">
          <p class="pe__eyebrow"><span class="pe__eyebrow-n"></span><i aria-hidden="true"></i><span class="pe__eyebrow-t"></span></p>
          <h2 class="pe__title pe__title--a"></h2>
        </div>
        <div class="pe__copy pe__copy--b"><h2 class="pe__title pe__title--b"></h2></div>
        <ol class="pe__steps" aria-label="Sequenza" data-i18n-attr="aria-label"><span class="pe__steps-track" aria-hidden="true"><span class="pe__steps-bar"></span></span></ol>
        <p class="pe__product"></p>
        ${PINS.map(
          ([key, cls]) => `<div class="pe__pin${cls ? ` ${cls}` : ''}" data-pin="${key}" aria-hidden="true"><div class="pe__pin-body">
          <span class="pe__pin-dot"></span><span class="pe__pin-line"></span><span class="pe__pin-text"><b></b><span></span></span>
        </div></div>`,
        ).join('')}
      </div>`
    const q = (sel) => s.querySelector(sel)
    this.stage = q('.pe__stage')
    this.canvas = q('.pe__canvas')
    this.poster = q('.pe__poster')
    this.el = {
      eyebrowN: q('.pe__eyebrow-n'),
      eyebrowT: q('.pe__eyebrow-t'),
      eyebrow: q('.pe__eyebrow'),
      titleA: q('.pe__title--a'),
      titleB: q('.pe__title--b'),
      steps: q('.pe__steps'),
      stepsBar: q('.pe__steps-bar'),
      product: q('.pe__product'),
    }
    this.pins = [...s.querySelectorAll('.pe__pin')].map((el) => ({
      el,
      key: el.dataset.pin,
      prop: `pin${el.dataset.pin[0].toUpperCase()}${el.dataset.pin.slice(1)}`, // pinDose, pinB1...
      text: el.querySelector('.pe__pin-text'),
      // lato del testo: quello dell'HTML, o quello che preferisce l'esperienza (pinSides)
      sideHtml: el.classList.contains('pe__pin--left') ? 'left' : 'right',
      side0: el.classList.contains('pe__pin--left') ? 'left' : 'right',
      side: el.classList.contains('pe__pin--left') ? 'left' : 'right',
      textW: 0,
      wrap: 0,
      // sopra o sotto l'oggetto il testo si apre dalla parte del pallino (i benefici: due etichette
      // sopra lo stesso prodotto non si incrociano)
      outward: el.classList.contains('pe__pin--benefit'),
    }))
    for (const pin of this.pins) this.ui[pin.prop] = 0
    this.steps = [0, 1, 2, 3, 4].map((i) => {
      const li = document.createElement('li')
      li.className = 'pe__step'
      li.innerHTML = `<span class="pe__step-n">${String(i + 1).padStart(2, '0')}</span><span class="pe__step-t"></span>`
      this.el.steps.appendChild(li)
      return li
    })
  }

  /**
   * Testi del prodotto attuale (righe mascherate per le entrate allo scroll). Due livelli dentro la
   * maschera: il testo (__txt) entra con l'ingresso della sezione, il contenitore (__in) esce con il
   * pin. Ogni timeline anima i suoi elementi: tornando indietro non si contendono la stessa proprieta'.
   */
  renderCopy() {
    const c = this.copy
    const lines = (arr) =>
      arr.map((t) => `<span class="pe-line"><span class="pe-line__in"><span class="pe-line__txt">${t}</span></span></span>`).join('')
    this.el.titleA.innerHTML = lines(c.titleA)
    this.el.titleA.setAttribute('aria-label', c.titleA.join(' '))
    this.el.titleB.innerHTML = lines(c.titleB)
    this.el.titleB.setAttribute('aria-label', c.titleB.join(' '))
    this.el.eyebrowN.textContent = this.o.chapter || ''
    this.el.eyebrowT.textContent = c.eyebrow
    this.el.eyebrow.classList.toggle('has-n', !!this.o.chapter)
    this.el.eyebrow.hidden = !c.eyebrow && !this.o.chapter // senza frase ne' numero non compare
    const name = [this.o.productName, this.o.productNote].filter(Boolean).join(' · ')
    this.el.product.textContent = name
    for (const pin of this.pins) {
      pin.el.classList.toggle('pe__pin--row', pin.key === 'b1' && this.layout === 'mobile')
      const [b, t, accent] = this.pinCopy(pin.key) ?? ['', '']
      pin.el.classList.toggle('pe__pin--accent', !!accent) // titolo evidenziato nel colore d'accento
      pin.el.querySelector('b').textContent = b
      pin.el.querySelector('.pe__pin-text > span').textContent = t
      pin.textW = 0 // testo nuovo: larghezza da rimisurare
      pin.fixed = null
    }
    // nomi dei passi: quelli del sito (nella sua lingua) se li passa, altrimenti quelli di copy.js
    ;(this.o.stepNames?.(this.type) ?? stepsFor(this.type)).forEach((name, i) => {
      this.steps[i].querySelector('.pe__step-t').textContent = name
    })
    this.fitTitles()
    // immagine del prodotto, se manca (prodotto nuovo senza immagine) quella del tipo
    const own = typeof this.o.poster === 'function' ? this.o.poster(this.layout) : this.o.poster
    const byType = `${this.o.postersPath}${POSTERS[this.type]}${this.layout === 'mobile' ? '-mobile' : ''}.webp`
    this.poster.onerror = own ? () => this.poster.getAttribute('src') !== byType && this.poster.setAttribute('src', byType) : null
    this.poster.setAttribute('src', own || byType)
    this.poster.alt = this.o.productName ? (this.o.posterAlt?.(this.o.productName) ?? `${this.o.productName}: bicchiere d'acqua`) : ''
  }

  /**
   * Testo di un'etichetta: i benefici (b1-b3) da copy.benefits, le altre da copy.pins. Sul telefono
   * una riga sola (b1) con i tre benefici insieme: i titoli, ognuno intero.
   */
  pinCopy(key) {
    const c = this.copy
    const n = /^b(\d)$/.exec(key)
    if (n && this.layout === 'mobile') {
      return n[1] === '1' && c.benefits?.length ? [c.benefits.map(([t]) => t.replace(/ /g, '\u00a0')).join(' · '), ''] : null
    }
    if (n) return c.benefits?.[n[1] - 1] ?? null
    // nella macro di capsule e compresse i benefici prendono il posto della dose
    if (key === 'dose' && c.benefits?.length && timingFor(this.type).pins.b1) return null
    return c.pins[key] ?? null
  }

  /**
   * I titoli restano grandi ma non invadono la scena: su desktop e tablet ciascuno sta in poco meno
   * di meta' schermo (il set 3D e' dall'altra parte) e finisce sopra la sequenza in basso a sinistra;
   * sul telefono stanno nella larghezza dello schermo e nella parte alta. Si riducono solo quando
   * serve (parole lunghe, schermi bassi).
   */
  fitTitles() {
    const W = this.stage.clientWidth || window.innerWidth
    const H = this.stage.clientHeight || window.innerHeight
    if (!W || !H) return
    const mobile = this.layout === 'mobile'
    const g = this.el.titleA.parentElement.offsetLeft || 16
    const steps = this.el.steps
    const stepsTop = getComputedStyle(steps).display === 'none' ? H : steps.offsetTop
    for (const title of [this.el.titleA, this.el.titleB]) {
      title.style.removeProperty('--pe-fit')
      const top = title.offsetTop + title.parentElement.offsetTop
      const maxW = mobile ? W - 2 * g : W * 0.44
      const maxH = mobile ? H * 0.4 - top : Math.min(title === this.el.titleB ? H : H * 0.6, stepsTop - 24 - top)
      const k = Math.min(1, maxW / title.scrollWidth, maxH / title.scrollHeight)
      if (k < 0.999) title.style.setProperty('--pe-fit', Math.max(0.5, k).toFixed(3))
    }
    this.pinBounds = null
  }

  applyCssTheme() {
    // (studio scuro: il fondo nero come la parete sullo schermo, non il grigio del render)
    this.section.style.setProperty('--pe-bg', this.theme.cssBg ?? this.theme.bgLow)
    this.section.style.setProperty('--pe-accent', this.theme.accent)
  }

  // ---------------------------------------------------------------------------
  // Timeline e scroll
  rebuild() {
    this.main?.kill()
    this.intro?.kill()

    const linesA = [...this.el.titleA.querySelectorAll('.pe-line__in')]
    const textA = [...this.el.titleA.querySelectorAll('.pe-line__txt')]
    const linesB = [...this.el.titleB.querySelectorAll('.pe-line__txt')]
    const copyA = this.el.titleA.parentElement
    // stato iniziale (le timeline qui sotto non disegnano finche' lo scroll non le raggiunge)
    gsap.set(linesB, { yPercent: LINE_BELOW })
    gsap.set(linesA, { yPercent: 0 })
    gsap.set(copyA, { autoAlpha: 1 })
    gsap.set([this.el.eyebrow, this.el.steps, this.el.product], { autoAlpha: 0 })

    // lato preferito di ogni etichetta: quello dell'esperienza per questo layout, poi quello dell'HTML
    const sides = this.exp?.pinSides
    for (const pin of this.pins) pin.side0 = sides?.[this.layout]?.[pin.key] ?? sides?.[pin.key] ?? pin.sideHtml
    this.pinBounds = null

    const timing = (this.timing = timingFor(this.type))
    const main = (this.main = gsap.timeline({ paused: true, defaults: { ease: 'none' } }))
    main.set({}, {}, 1) // durata 1 = tutta la sezione
    if (this.exp) {
      this.cam.follow = null
      for (const tr of this.exp.tracks(this.layout)) {
        const camera = tr.target === 'camera'
        if (camera && tr.follow) this.cam.follow = tr.follow
        addTrack(main, camera ? this.cam.state : tr.target, tr.keys)
      }
    }
    // titolo A: e' gia' entrato con l'ingresso della sezione, esce all'inizio del pin
    main.fromTo(linesA, { yPercent: 0 }, { yPercent: LINE_ABOVE, duration: 0.05, ease: 'power2.in', stagger: 0.008, immediateRender: false }, timing.titleAOut)
    main.fromTo(copyA, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.04, immediateRender: false }, timing.titleAOut + 0.02)
    addLines(main, linesB, { at: timing.titleBIn, dur: 0.05, stagger: 0.01 })
    for (const pin of this.pins) {
      // tutte spente: la timeline nuova le riaccende fin dove e' arrivato lo scroll (con valori
      // rimasti dalla timeline di prima, un'etichetta poteva comparire prima del suo momento)
      this.ui[pin.prop] = 0
      // etichetta senza tempi (polvere) o senza testo (prodotto senza pezzi a parte o senza
      // benefici; la dose quando ci sono i benefici): resta spenta
      if (!timing.pins[pin.key] || !this.pinCopy(pin.key)) continue
      const [a, b] = timing.pins[pin.key]
      main.fromTo(this.ui, { [pin.prop]: 0 }, { [pin.prop]: 1, duration: 0.035, immediateRender: false }, a)
      if (b < 1) main.fromTo(this.ui, { [pin.prop]: 1 }, { [pin.prop]: 0, duration: 0.03, immediateRender: false }, b)
    }

    // ingresso (prima del pin): luci dello studio che si accendono, titolo A, sequenza
    const intro = (this.intro = gsap.timeline({ paused: true, defaults: { ease: 'none' } }))
    intro.fromTo(this.ui, { exposure: 0.35 }, { exposure: 1, duration: 1, ease: 'power1.out' }, 0)
    intro.fromTo(textA, { yPercent: LINE_BELOW }, { yPercent: 0, duration: 0.4, ease: 'power3.out', stagger: 0.07 }, 0.42)
    addFade(intro, this.el.eyebrow, { at: 0.36, dur: 0.3 })
    addFade(intro, this.el.steps, { at: 0.55, dur: 0.3, y: 0 })
    addFade(intro, this.el.product, { at: 0.6, dur: 0.3, y: 0 })

    this.exp?.prepare?.(main)

    // i trigger si creano una volta sola e leggono sempre le timeline attuali (this.main, this.intro)
    this.scroll ??= createScrollAnimation({
      section: this.section,
      stage: this.stage,
      steps: this.o.steps,
      getVh: this.o.getVh,
      scrub: this.o.scrub,
      timelines: () => this,
      onActive: (on) => this.setActive(on),
      onUpdate: (self) => this.updateSteps(self.progress),
    })
    // le timeline nuove partono dal punto in cui si trova lo scroll
    main.progress(this.scroll.progress)
    intro.progress(this.scroll.introProgress)
    this.updateSteps(main.progress())
  }

  updateSteps(p) {
    let idx = 0
    ;(this.timing ?? timingFor(this.type)).steps.forEach((t, i) => {
      if (p >= t) idx = i
    })
    if (idx !== this.stepIndex) {
      this.stepIndex = idx
      this.steps.forEach((li, i) => {
        li.classList.toggle('is-active', i === idx)
        li.classList.toggle('is-done', i < idx)
      })
    }
    this.el.stepsBar.style.transform = `scaleY(${p.toFixed(4)})`
  }

  // ---------------------------------------------------------------------------
  // WebGL (pigro)
  observe() {
    if (!('IntersectionObserver' in window)) return this.init3D()
    const m = this.o.lazyMargin
    this.io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          this.io.disconnect()
          this.init3D()
        }
      },
      { rootMargin: `${m} 0px ${m} 0px` },
    )
    this.io.observe(this.section)
  }

  /** Indirizzo di un modello: `model` (solo per quello del prodotto), `resolveModel(file)` o la cartella. */
  modelUrl(file, primary = false) {
    if (primary && this.o.model) return this.o.model
    if (this.o.resolveModel) return this.o.resolveModel(file)
    return `${this.o.modelsPath}${file}`
  }

  /**
   * Prepara la scena 3D in anticipo, senza disturbare: ogni passo aspetta un momento tranquillo
   * (options.calm, per esempio "nessuno sta scorrendo"; di base il browser inattivo). Se intanto
   * la sezione si avvicina allo schermo, init3D() la completa subito.
   */
  preload() {
    if (!this.initing && !this.ready && !this.destroyed) this.polite = true
    return this.init3D()
  }

  /** Pausa tra i passi della preparazione: un fotogramma libero, o un momento tranquillo se e' anticipata. */
  breath() {
    const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
    if (!this.polite) return frame()
    const calm = this.o.calm?.() ?? new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 200)))
    // la sezione si sta avvicinando (init3D chiamato dall'osservatore): basta aspettare un fotogramma
    return Promise.race([calm, new Promise((r) => (this._hurry = r))]).then(frame)
  }

  async init3D() {
    if (this.initing) {
      // gia' in preparazione in anticipo e la sezione si avvicina: si completa senza piu' attese
      if (this.polite) {
        this.polite = false
        this._hurry?.()
      }
      return this.initing
    }
    if (this.ready || this.destroyed) return this.initing
    if (!webglAvailable()) return this.useFallback()
    // a piccoli passi, con una pausa tra l'uno e l'altro: nessun fotogramma lungo mentre si scorre.
    // Dopo ogni attesa: se nel frattempo la sezione e' stata smontata (destroy) ci si ferma
    this.initing = (async () => {
      try {
        const [{ ProductScene }, { ProductCamera }, { loadModel }, Exp] = await Promise.all([
          import('./ProductScene.js'),
          import('./ProductCamera.js'),
          import('./assets.js'),
          EXPERIENCES[this.type](),
        ])
        // modelli: download e decodifica (Draco, nei suoi worker) mentre si prepara il renderer
        const load = { dracoPath: this.o.dracoPath }
        const models = Promise.all([
          loadModel(this.modelUrl('glass.glb'), load),
          ...this.modelFiles(Exp).map((file, i) => loadModel(this.modelUrl(file, i === 0), load)),
          this.o.etch ? import('./etching.js') : null,
        ])
        models.catch(() => {}) // (l'errore arriva con l'await qui sotto)
        await this.breath()
        if (this.destroyed) return
        // contesto WebGL, gia' alla misura dello stage (cambiarla dopo fa aspettare la GPU)
        const scene = new ProductScene(this.canvas, this.quality, this.stageSize())
        scene.resolveUrl = (file) => this.modelUrl(file) // (immagini del bicchiere renderizzato)
        this.canvas.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          if (!this.destroyed) this.useFallback()
        })
        await this.breath()
        if (this.destroyed) return scene.dispose()
        await scene.prepare(() => this.breath()) // programmi dell'ambiente, in parallelo
        await this.breath()
        if (this.destroyed) return scene.dispose()
        scene.buildStudio() // riflessi dello studio (PMREM)
        await this.breath()
        if (this.destroyed) return scene.dispose()
        scene.init() // buffer, fondale, passate finali
        this.scene = scene
        this.cam = new ProductCamera(this.scene.camera)
        this.cam.live = this.reduced ? 0 : 1
        this.scene.setTheme(this.theme)
        const loaded = await models
        await this.breath()
        if (this.destroyed) return
        this.scene.setGlass(loaded[0])
        const etching = loaded[loaded.length - 1]
        if (etching) this.scene.setEtch(etching.createEtchTexture(this.o.etch), this.o.etchOptions)
        const type = this.type // (se nel frattempo e' cambiato, il modello si scarica adesso)
        const variant = this.variant()
        const exp = await this.createExperience(type)
        await this.breath()
        if (this.destroyed) return exp.dispose()
        this.attachExperience(exp, variant)
        // il lavoro pesante dell'esperienza (i granelli della polvere) va in un worker, intanto il resto
        const heavy = exp.prepareAsync?.()
        await this.breath()
        if (this.destroyed) return
        this.resize()
        await this.breath()
        if (this.destroyed) return
        this.rebuild()
        await heavy
        await this.breath()
        if (this.destroyed) return
        await this.scene.warmup(() => this.breath())
        // primo uso della GPU (buffer di rendering, geometrie, texture) un pezzo per fotogramma, a
        // canvas ancora nascosto: il primo fotogramma vero non ha piu' niente da preparare
        for (const step of this.scene.primeSteps()) {
          await this.breath()
          if (this.destroyed) return
          step()
        }
        await this.breath()
        if (this.destroyed) return
        this.ready = true
        this.polite = false
        this.renderFrame(gsap.ticker.time, 0)
        this.section.classList.add('is-live')
        this.setActive(this.active)
        // il prodotto e' cambiato tipo durante la preparazione (se il cambio non riesce resta il precedente)
        this.swapExperience().catch((err) => console.warn('ProductExperience: cambio prodotto non riuscito.', err))
      } catch (err) {
        if (this.destroyed) return
        console.warn('ProductExperience: uso l\'immagine statica.', err)
        this.useFallback()
      }
    })()
    return this.initing
  }

  /** Esperienza e modello che servono: il tipo e, se ne ha piu' d'una, la forma. */
  variant() {
    return `${this.type}:${this.o.shape ?? ''}`
  }

  /** Modelli dell'esperienza per la forma attuale (il primo e' quello del prodotto). */
  modelFiles(Exp) {
    return Exp.modelsFor?.(this.o.shape) ?? Exp.models
  }

  async createExperience(type) {
    const Exp = await EXPERIENCES[type]()
    const files = this.modelFiles(Exp)
    const exp = new Exp({
      scene: this.scene,
      quality: this.quality,
      reduced: this.reduced,
      shape: this.o.shape,
      files,
      modelUrl: (file) => this.modelUrl(file, file === files[0]),
      loadOptions: { dracoPath: this.o.dracoPath },
    })
    await exp.load()
    return exp
  }

  attachExperience(exp, variant) {
    this.exp?.dispose()
    this.exp = exp
    this.expVariant = variant
    exp.setCount?.(this.o.count, this.o.aside)
    exp.build()
    exp.setTheme(this.theme)
  }

  useFallback() {
    this.ready = false
    this.section.classList.add('is-fallback')
    this.setActive(false)
  }

  setActive(on) {
    this.active = on
    if (on) this._swapHurry?.() // la sezione compare: il cambio di prodotto in attesa si completa ora
    const run = on && this.ready
    if (run && !this._ticking) {
      this._ticking = true
      this._tick ??= (time, deltaMs) => this.renderFrame(time, deltaMs)
      gsap.ticker.add(this._tick)
    } else if (!run && this._ticking) {
      this._ticking = false
      gsap.ticker.remove(this._tick)
    }
  }

  renderFrame(time, deltaMs) {
    if (!this.ready) return
    const dt = Math.min(0.05, deltaMs / 1000)
    // prima il prodotto (la camera puo' seguirlo), poi la camera, poi cio' che dipende dalla camera
    this.exp.update(time, dt)
    this.cam.update(dt, time, this.size)
    this.exp.updateView?.()
    this.scene.renderer.toneMappingExposure = this.ui.exposure * EXPOSURE
    this.scene.render(time)
    this.updatePins()
    if (dt > 0) this.scene.adapt(dt)
  }

  /**
   * Etichette agganciate al 3D, come quelle del sito (src/ui/stageUI.js): il pallino sta sul punto,
   * la linea esce dalla sagoma dell'oggetto (bodies dell'esperienza) e il testo non copre mai
   * prodotto, bicchiere, titoli, la sequenza in basso a sinistra o un'altra etichetta, e resta
   * nello schermo.
   */
  updatePins() {
    const a = this._pin
    const mobile = this.layout === 'mobile'
    const k = {
      b: this.pinBounds ?? this.measurePinBounds(),
      pad: mobile ? 10 : 18, // distanza minima tra le sagome e il testo
      minLine: mobile ? 18 : 28,
      minText: mobile ? 120 : 150, // colonna minima per il testo su piu' righe
      prefLine: mobile ? 30 : Math.min(92, Math.max(44, this.size.w * 0.054)),
      obstacles: null,
    }
    // nella macro di capsule e compresse: centro del prodotto, fin dove arriva girando, suoi bordi
    const view = this.exp.calloutView?.(this.size) ?? null
    if (!view) this._calloutGlass = null
    for (const pin of this.pins) {
      const vis = this.ui[pin.prop]
      let place = null
      if (pin.outward) {
        // benefici: il testo resta fermo per tutta la macro (posto una volta, fuori da dove arriva il
        // prodotto girando); il pallino scorre sul bordo del prodotto e la linea lo segue
        if (view && vis >= 0.005) {
          k.obstacles ??= this.pinObstacles()
          pin.fixed ??= this.placeCallout(pin, view, k)
          if (pin.fixed) place = this.calloutAt(pin.fixed, view, a)
        } else pin.fixed = null
      } else {
        const anchor = this.exp.anchors?.[pin.key]
        if (anchor && vis >= 0.005) {
          this.cam.project(anchor, this.size, a)
          if (a.visible && a.x > 0 && a.x < this.size.w && a.y > 0 && a.y < this.size.h) {
            k.obstacles ??= this.pinObstacles()
            place = this.placePin(pin, a, k)
          }
        }
      }
      if (place) {
        // le etichette successive non coprono ne' il testo ne' la linea di questa
        const r = place.rect
        const line =
          place.side === 'below' || place.side === 'above'
            ? { l: place.x - 3, r: place.x + 3, t: Math.min(a.y, r.b), b: Math.max(a.y, r.t) }
            : { l: Math.min(place.x, r.r), r: Math.max(place.x, r.l), t: a.y - 3, b: a.y + 3 }
        k.obstacles.push(r, line)
        this.wrapPin(pin, place.w)
        if (place.side !== pin.side) {
          pin.side = place.side
          for (const s of ['left', 'below', 'above']) pin.el.classList.toggle(`pe__pin--${s}`, s === place.side)
        }
        pin.text.style.transform = place.dx ? `translateX(${place.dx.toFixed(1)}px)` : ''
        pin.el.style.transform = `translate3d(${place.x.toFixed(1)}px, ${a.y.toFixed(1)}px, 0)`
        pin.el.style.setProperty('--pe-line', `${place.len.toFixed(0)}px`)
        pin.el.style.setProperty('--pe-pin', vis.toFixed(3))
        pin.el.style.opacity = vis.toFixed(3)
        pin.shown = true
      } else if (pin.shown) {
        pin.el.style.opacity = '0'
        pin.shown = false
      }
    }
  }

  /**
   * Dove va un'etichetta. In ordine: la posizione del fotogramma prima, se ancora libera (niente
   * salti); dal suo lato su una riga, o su piu' righe se la colonna e' ampia; dall'altro lato;
   * su piu' righe nella colonna libera; sotto l'oggetto; sopra. Se il testo tocca un ostacolo la
   * linea si allunga quanto basta per superarlo. null se non c'e' posto da nessuna parte: meglio
   * nessuna etichetta che una sopra il prodotto o fuori dallo schermo. only: prova solo quel lato.
   */
  placePin(pin, a0, { b, pad, minLine, minText, prefLine, obstacles }, only = null) {
    // sagoma del proprio oggetto attorno al punto
    let c = null
    let r = 0
    const shape = this.exp.bodies?.[pin.key]
    if (shape) {
      c = this.cam.project(shape.center, this.size, this._body)
      r = this.cam.pixelRadius(shape.center, shape.radius, this.size)
    }
    // di lato il pallino sta sul bordo dell'oggetto rivolto al testo: se il punto e' dalla parte
    // opposta si usa il suo speculare (bicchiere, prodotto e misurino sono simmetrici)
    const anchorFor = (side) => (c && ((side === 'right' && a0.x < c.x) || (side === 'left' && a0.x > c.x)) ? { x: 2 * c.x - a0.x, y: a0.y } : a0)
    const edges = (a) => ({
      eL: c ? Math.min(a.x, c.x - r) : a.x,
      eR: c ? Math.max(a.x, c.x + r) : a.x,
      eT: c ? Math.min(a.y, c.y - r) : a.y,
      eB: c ? Math.max(a.y, c.y + r) : a.y,
    })
    if (!pin.textW) {
      this.wrapPin(pin, 0)
      pin.textW = pin.text.offsetWidth // su una riga
      pin.textH = pin.text.offsetHeight
      // il titolo non va mai a capo: la colonna non puo' essere piu' stretta di lui (+ margine interno)
      const range = document.createRange()
      range.selectNodeContents(pin.text.querySelector('b'))
      pin.titleW = Math.ceil(range.getBoundingClientRect().width) + 15
    }
    const full = pin.textW
    const hit = (r) => obstacles.find((o) => r.l < o.r && o.l < r.r && r.t < o.b && o.t < r.b)
    const inside = (r) => r.l >= b.left && r.r <= b.right && r.t >= b.top && r.b <= b.bottom

    // posizione del testo largo w su un lato (o sotto/sopra), con la linea piu' corta possibile
    const at = (side, w) => {
      if (!(w > 0)) return null
      const vertical = side === 'below' || side === 'above'
      const a = vertical ? a0 : anchorFor(side)
      const { eL, eR, eT, eB } = edges(a)
      const h = pin.textH * Math.ceil(full / w - 0.01) + (vertical ? 10 : 0) // righe stimate
      const minLen = Math.max(minLine, { left: a.x - eL, right: eR - a.x, below: eB - a.y, above: a.y - eT }[side] + pad)
      // di lato: linea della lunghezza solita, accorciata se il testo uscirebbe dallo schermo
      const maxLen = vertical ? Infinity : side === 'left' ? a.x - 9 - w - b.left : b.right - a.x - 9 - w
      if (maxLen < minLen) return null
      let len = vertical ? minLen : Math.min(maxLen, Math.max(minLen, prefLine))
      // sopra o sotto: testo centrato sul pallino, o aperto dalla sua parte dell'oggetto (outward)
      const outward = pin.outward && c && Math.abs(a.x - c.x) > 1 && !pin.el.classList.contains('pe__pin--row')
      const cx = outward ? (a.x < c.x ? a.x - w + 24 : a.x - 24) : a.x - w / 2
      for (let i = 0; i < 4; i++) {
        const x0 = vertical ? Math.min(Math.max(cx, b.left), b.right - w) : side === 'left' ? a.x - 9 - len - w : a.x + 9 + len
        const y0 = !vertical ? a.y - h / 2 : side === 'below' ? a.y + 9 + len : a.y - 9 - len - h
        const rect = { l: x0, r: x0 + w, t: y0, b: y0 + h }
        if (!inside(rect)) return null
        const o = hit(rect)
        if (!o) return { side, w, len, x: a.x, dx: vertical ? x0 - (a.x - w / 2) : 0, rect }
        // sopra o sotto: se l'ostacolo e' di fianco basta spostare il testo di lato (la linea resta
        // sotto il testo, ad almeno 24 px dai suoi bordi), con lo spostamento piu' piccolo
        if (vertical) {
          const lo = Math.max(b.left, a.x - w + 24)
          const hi = Math.min(b.right - w, a.x - 24)
          const shifted = [o.r + pad, o.l - pad - w]
            .filter((nx) => nx >= lo && nx <= hi)
            .map((nx) => ({ ...rect, l: nx, r: nx + w }))
            .filter((r) => inside(r) && !hit(r))
            .sort((p, q) => Math.abs(p.l - x0) - Math.abs(q.l - x0))[0]
          if (shifted) return { side, w, len, x: a.x, dx: shifted.l - (a.x - w / 2), rect: shifted }
        }
        // allunga la linea quanto basta per superare l'ostacolo
        len += { left: rect.r - o.l, right: o.r - rect.l, below: o.b - rect.t, above: rect.b - o.t }[side] + pad
      }
      return null
    }

    // larghezza del testo: di lato quanto la colonna libera, sotto/sopra quanto lo schermo
    const vertical = (s) => s === 'below' || s === 'above'
    const room = (s) => {
      const a = anchorFor(s)
      const { eL, eR } = edges(a)
      return Math.floor((s === 'left' ? a.x - b.left : b.right - a.x) - 9 - Math.max(minLine, (s === 'left' ? a.x - eL : eR - a.x) + pad))
    }
    const wideCol = Math.min(full, Math.floor(b.right - b.left))
    const widthOn = (s) => (vertical(s) ? wideCol : Math.min(full, room(s)))
    // (il titolo, misurato con un margine, puo' superare di poco la larghezza su una riga: allora basta quella)
    const narrow = (s, w, min = minText) => w >= Math.max(Math.min(full, min), Math.min(pin.titleW, full)) && at(s, w)
    if (only) {
      const p = vertical(only) ? at(only, wideCol) : at(only, full) || narrow(only, widthOn(only))
      return p || null
    }
    const own = pin.side0
    const sides = own === 'right' ? ['right', 'left'] : ['left', 'right'] // prima il suo lato
    const tries = []
    // la posizione del fotogramma prima resta finche' il testo e' leggibile (niente salti)
    if (pin.shown) tries.push(() => narrow(pin.side, widthOn(pin.side), minText * 0.75))
    if (vertical(own)) tries.push(() => at(own, wideCol))
    for (const s of sides) {
      tries.push(() => at(s, full))
      if (s === own) tries.push(() => widthOn(s) >= full * 0.75 && narrow(s, widthOn(s)))
    }
    for (const s of sides) tries.push(() => narrow(s, widthOn(s)))
    for (const s of ['below', 'above']) if (s !== own) tries.push(() => at(s, wideCol))
    for (const t of tries) {
      const p = t()
      if (p) return p
    }
    return null
  }

  /**
   * Benefici: lato e posto del testo, una volta per tutta la macro. Si parte appena fuori da dove
   * arriva il prodotto girando su se stesso (view.reach): prima il lato preferito, poi sotto, sopra,
   * a sinistra, a destra.
   */
  placeCallout(pin, view, k) {
    const { c, reach } = view
    // alla fine della macro la camera gira e il bicchiere rientra da sinistra: anche li' niente testo
    this._calloutGlass ??= this.glassAt(Math.max(...['b1', 'b2', 'b3'].map((key) => this.timing.pins[key]?.[1] ?? 0)) + 0.03)
    if (this._calloutGlass) k = { ...k, obstacles: [...k.obstacles, this._calloutGlass] }
    const from = {
      left: { x: c.x - reach.left, y: c.y },
      right: { x: c.x + reach.right, y: c.y },
      below: { x: c.x, y: c.y + reach.bottom },
      above: { x: c.x, y: c.y - reach.top },
    }
    for (const side of new Set([pin.side0, 'below', 'above', 'left', 'right'])) {
      const place = this.placePin(pin, from[side], k, side)
      if (place) return place
    }
    return null
  }

  /**
   * Richiamo fermo in questo fotogramma: il pallino (a) sul bordo del prodotto lungo la linea per il
   * suo centro, la linea fino al testo, che resta dov'e'.
   */
  calloutAt(fixed, view, a) {
    const dot = view.edge[{ left: 'left', right: 'right', below: 'bottom', above: 'top' }[fixed.side]]
    a.x = dot.x
    a.y = dot.y
    const r = fixed.rect
    const len = Math.max(4, { left: dot.x - 9 - r.r, right: r.l - 9 - dot.x, below: r.t - 9 - dot.y, above: dot.y - 9 - r.b }[fixed.side])
    const vertical = fixed.side === 'below' || fixed.side === 'above'
    return { ...fixed, len, x: dot.x, dx: vertical ? r.l - (dot.x - fixed.w / 2) : 0 }
  }

  /** Il bicchiere sullo schermo (rettangolo, px) al progresso `at` della sezione; poi tutto torna com'era. */
  glassAt(at) {
    if (!this._glassPts) return null
    const keep = this.main.time()
    const time = gsap.ticker.time
    this.main.time(at, true)
    this.exp.update(time, 0)
    this.cam.update(0, time, this.size)
    const rect = this.cam.rectOf(this._glassPts, this.size)
    this.main.time(keep, true)
    this.exp.update(time, 0)
    this.cam.update(0, time, this.size)
    return rect
  }

  /** Ingombri sullo schermo (px) che il testo delle etichette non deve coprire. */
  pinObstacles() {
    const list = []
    const g = this.scene.glassInfo
    if (g) {
      // il bicchiere: i bordi del fondo e della bocca
      this._glassPts ??= Array.from({ length: 48 }, (_, i) => {
        const t = ((i % 24) / 24) * Math.PI * 2
        return { x: Math.cos(t) * g.rOut, y: i < 24 ? 0 : g.height, z: Math.sin(t) * g.rOut }
      })
      list.push(this.cam.rectOf(this._glassPts, this.size))
    }
    // sagome delle etichette che si vedono (gli oggetti stessi sono in exp.obstacles)
    for (const pin of this.pins) {
      const shape = this.exp.bodies?.[pin.key]
      if (!shape || this.ui[pin.prop] < 0.005) continue
      const c = this.cam.project(shape.center, this.size, {})
      const r = this.cam.pixelRadius(shape.center, shape.radius, this.size)
      list.push({ l: c.x - r, r: c.x + r, t: c.y - r, b: c.y + r })
    }
    for (const obj of this.exp.obstacles ?? []) list.push(this.cam.rectOfObject(obj, this.size))
    list.push(...(this.exp.screenObstacles?.(this.size) ?? []))
    // testi della pagina quando si vedono
    const p = this.main?.progress() ?? 0
    const t = this.timing ?? timingFor(this.type)
    const ui = this.pinUi ?? []
    if (p < t.titleAOut + 0.06 && ui[0]) list.push(ui[0])
    if (p > t.titleBIn - 0.01 && ui[1]) list.push(ui[1])
    if (ui[2]) list.push(ui[2])
    if (ui[3]) list.push(ui[3]) // la sequenza, in basso a sinistra
    return list
  }

  /** Larghezza del testo di un'etichetta: w < larghezza su una riga -> va a capo. */
  wrapPin(pin, w) {
    const wrap = w && w < pin.textW ? Math.floor(w) : 0
    if (wrap === pin.wrap) return
    pin.wrap = wrap
    pin.text.style.maxWidth = wrap ? `${wrap}px` : ''
    pin.text.style.whiteSpace = wrap ? 'normal' : ''
  }

  /**
   * Area libera per le etichette (margini della pagina) e rettangoli dei testi fissi: titolo A,
   * titolo B, nome del prodotto e sequenza (in basso a sinistra).
   */
  measurePinBounds() {
    const { w, h } = this.size
    const g = this.el.titleA.parentElement.offsetLeft || 16 // = --pe-gutter
    this.pinBounds = {
      left: g,
      right: w - g,
      top: g + 24,
      bottom: h - g - 24,
    }
    const s = this.stage.getBoundingClientRect()
    const rect = (el) => {
      if (getComputedStyle(el).display === 'none') return null
      const r = el.getBoundingClientRect()
      return { l: r.left - s.left - 12, r: r.right - s.left + 12, t: r.top - s.top - 12, b: r.bottom - s.top + 12 }
    }
    this.pinUi = [rect(this.el.titleA.parentElement), rect(this.el.titleB.parentElement), rect(this.el.product), rect(this.el.steps)]
    return this.pinBounds
  }

  // ---------------------------------------------------------------------------
  /** Misura dello stage (px CSS). */
  stageSize() {
    return { w: this.stage.clientWidth || window.innerWidth, h: this.stage.clientHeight || window.innerHeight }
  }

  resize() {
    const { w, h } = this.stageSize()
    this.size = { w, h }
    this.scene?.resize(w, h)
    for (const pin of this.pins) {
      pin.textW = 0
      pin.fixed = null
    }
    this.fitTitles()
  }

  onResize() {
    clearTimeout(this._resizeTimer)
    this._resizeTimer = setTimeout(() => {
      const layout = currentLayout()
      this.resize()
      if (layout !== this.layout) {
        this.layout = layout
        this.renderCopy()
        this.rebuild()
      }
    }, 180)
  }

  onPointer(e) {
    if (!this.cam) return
    this.cam.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    this.cam.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  }

  /**
   * Cambio prodotto: testi, colori, dose e, se cambia il tipo (o la forma), l'esperienza intera (il
   * modello nuovo viene scaricato solo adesso).
   */
  async setProduct({ type = this.type, theme, copy, productName, productNote, model, poster, shape, count, aside } = {}) {
    if (this.destroyed) return
    if (productName !== undefined) this.o.productName = productName
    if (productNote !== undefined) this.o.productNote = productNote
    if (model !== undefined) this.o.model = model
    if (poster !== undefined) this.o.poster = poster
    if (shape !== undefined) this.o.shape = shape
    if (count !== undefined) this.o.count = count
    if (aside !== undefined) this.o.aside = aside
    if (theme) this.theme = { ...DEFAULT_THEME, ...theme }
    if (type in EXPERIENCES) this.type = type
    this.copy = resolveCopy(this.type, copy)
    this.renderCopy()
    this.applyCssTheme()
    if (this.scene) this.scene.setTheme(this.theme)
    this.exp?.setTheme(this.theme)
    const swap = this.variant() !== this.expVariant
    if (!swap) this.exp?.setCount?.(this.o.count, this.o.aside)
    this.rebuild() // i testi nuovi entrano subito nelle timeline
    if (swap) await this.swapExperience()
  }

  /**
   * Il tipo (o la forma) e' cambiato: esperienza nuova (il suo modello si scarica solo adesso). Se
   * la scena 3D non e' ancora pronta non serve: init3D prepara gia' quella attuale (e alla fine
   * controlla che sia ancora lei).
   */
  async swapExperience() {
    if (!this.ready || this.expVariant === this.variant()) return
    const token = (this._swap = {})
    // cambio dalla hero, sezione lontana: il nuovo prodotto 3D si prepara in un momento
    // tranquillo, non durante l'animazione del cambio (se la sezione compare, subito)
    if (!this.active) {
      await Promise.race([
        this.o.calm?.() ?? new Promise((r) => setTimeout(r, 300)),
        new Promise((r) => (this._swapHurry = r)),
      ])
    }
    // nel frattempo e' arrivato un altro cambio, o la sezione e' stata smontata
    if (token !== this._swap || this.destroyed) return
    const type = this.type
    const variant = this.variant()
    const exp = await this.createExperience(type)
    if (token !== this._swap || this.destroyed) return exp.dispose()
    this.attachExperience(exp, variant)
    this.rebuild()
    await exp.prepareAsync?.()
    if (this.destroyed) return
    await this.scene.warmup(() => this.breath())
  }

  destroy() {
    this.destroyed = true
    this.setActive(false)
    this.io?.disconnect()
    this._ro?.disconnect()
    clearTimeout(this._resizeTimer)
    this.scroll?.kill()
    this.main?.kill()
    this.intro?.kill()
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('pointermove', this._onPointer)
    this.exp?.dispose()
    this.scene?.dispose()
    this.section.innerHTML = ''
    this.section.classList.remove('pe', 'is-live', 'is-fallback')
  }
}
