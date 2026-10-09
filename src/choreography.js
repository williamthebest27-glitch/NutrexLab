import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Track } from './webgl/Track.js'
import { COLORS } from './config.js'
import { show, hide } from './ui/text.js'

/*
  Unita' di tempo = "viewport scrollate" (t = scrollY / altezza viewport).
  Mappa (con i passi di index.html):
    story        0 .. 6   hero, scene 1-5          (sticky)   6 .. 7  transizione
    ingredients  7 .. 10                            (sticky)  10 .. 11
    science     11 .. 14                            (sticky)  14 .. 15
    ritual      15 .. 17.4  sezione del bicchiere   (pin)     17.4 .. 18.4
    daily       18.4 .. 20  la durata               (sticky)  20 .. 21
    shop        21 .. 22.2                          (sticky)  22.2 .. 23.2 entra il footer
*/

const BASE = {
  sx: 0, sy: 0, size: 0.5, rotY: 0, rotX: 0, rotZ: 0, elev: 7,
  key: 1, rim: 0.25, env: 1, shadow: 1, aura: 0, spot: 0,
  uP: 0, ambient: 0, twist: 0, heroOut: 0,
}

/*
  Sipario scuro della scena 2: a riposo spunta in fondo alla hero con il bordo curvo,
  con lo scroll sale fino a coprire tutto, poi esce verso l'alto scoprendo la scena 3.
*/
export const CURTAIN = { rise: [0.05, 1.0], exit: [1.92, 2.34] }

// sx/sy: posizione sullo schermo (-1..1), size: altezza del barattolo / altezza viewport
/*
  Rotazione del barattolo (rotY, radianti): 0 = fronte dell'etichetta verso la camera,
  negativo = il fronte gira verso sinistra, positivo verso destra.
  Nei momenti chiave il fronte "guarda" il testo della scena.
*/
const TAU = Math.PI * 2
const ROT = {
  hero: -0.12, // barattolo inclinato e sospeso, etichetta quasi di fronte
  s2: -0.42, // barattolo a destra sul sipario scuro, fronte verso "Collagene marino"
  s2b: -0.66,
  s3: 0.45, // barattolo a sinistra, fronte verso le parole a destra
  s4a: 0.25,
  s4: 0.08, // fronte pieno nella scena scura
  s5a: -0.45, // macro del tappo: dettagli a destra
  s5b: -0.95, // etichetta: dettagli a sinistra
  s6: -1.7,
  ing0: -2.4,
  // primo piano: la tabella nutrizionale (U 0.19 dell'etichetta, angolo -1.817) ruotata
  // di 0.3 rad verso la colonna dei testi a destra; sul mobile e' di fronte alla camera
  ing1: -4.166,
  ing2: -4.2,
  ingM: 1.817 - TAU,
  sci0: -5.0,
  sci1: -5.4,
  sci2: -5.8,
  day2: -TAU + 0.45, // la durata: barattolo a sinistra, fronte verso il titolo a destra
  day3: -TAU + 0.62,
  shop0: -TAU, // fronte, luce da campagna
  shop1: -TAU - 0.2,
}

/*
  Sezione del bicchiere (ritual, tra Scienza e La durata): e' opaca e copre tutto lo schermo mentre
  e' pinnata. L'elica continua a girare piano finche' la sezione la copre (t = ritual), il barattolo si
  ricompone di nascosto ed e' gia' nella posa della durata (a sinistra) quando la sezione esce (daily - 1).
*/
function ritualKeys(T, during, after) {
  if (T.ritual == null) return []
  return [{ t: T.ritual, ...during }, { t: T.daily - 1, ...after }]
}

function desktopKeys(T, R) {
  const s = T.story, i = T.ingredients, c = T.science, d = T.daily, p = T.shop, e = T.end
  const day = { sx: -0.45, sy: -0.03, size: 0.58, rotY: R.day2, elev: 8, uP: 0, ambient: 0, aura: 0.6, rim: 1.2, key: 1.05, env: 0.85 }
  return [
    // hero: barattolo sospeso e inclinato (si vede il tappo), tra la colonna dei titoli a sinistra
    // e il menu prodotti a destra (heroFit: la dimensione segue la composizione, tarata su schermi 3:2)
    { t: s, ...BASE, sx: 0.18, sy: 0.1, size: 0.44, heroFit: true, rotY: R.hero, rotX: 0.34, rotZ: -0.3, elev: 2, shadow: 0 },
    { t: s + 0.06, heroOut: 0 },
    // scena 2: sul sipario scuro, dritto a destra con luce di taglio (lascia spazio ai nomi lunghi)
    { t: s + 1.0, sx: 0.58, sy: -0.01, size: 0.62, rotY: R.s2, rotX: 0, rotZ: 0, elev: 7, key: 0.9, rim: 1.6, env: 0.75, heroOut: 1 },
    { t: s + 1.95, rotY: R.s2b },
    { t: s + 3, sx: -0.36, sy: 0.02, size: 0.68, rotY: R.s3, elev: 12, key: 1, rim: 0.25, env: 1, shadow: 1 },
    { t: s + 3.6, sx: 0.52, sy: -0.06, size: 0.92, rotY: R.s4a, elev: 8, key: 1.1, rim: 1.7, env: 0.7, shadow: 0, aura: 1 },
    { t: s + 4.05, sx: 0.58, sy: -0.08, size: 0.95, rotY: R.s4 },
    // (a sinistra: a destra c'e' spazio per i dettagli, con le scritte grandi)
    { t: s + 4.7, sx: -0.58, sy: -1.0, size: 1.34, rotY: R.s5a, rotX: 0.04, elev: 24, rim: 1.2, aura: 0.55 },
    { t: s + 5.3, sx: 0.36, sy: R.s5bY ?? S5B.sy, size: S5B.size, rotY: R.s5b, rotX: 0, elev: 11 },
    { t: s + 6, sx: 0, sy: -0.02, size: 0.52, rotY: R.s6, elev: 9, rim: 1.3, aura: 0.7 },
    { t: i, sx: -0.3, sy: -0.03, size: 0.5, rotY: R.ing0, elev: 10, key: 1, rim: 1.4, env: 0.8, aura: 0.55, ambient: 0.3 },
    // la camera entra sull'etichetta: la tabella nutrizionale, intera e leggibile, a sinistra
    { t: i + 0.8, sx: -0.66, sy: 0.8, size: 1.6, rotY: R.ing1, elev: 4, key: 1.05, rim: 0.8, env: 0.85, aura: 0, ambient: 0 },
    { t: i + 2.95, sx: -0.65, sy: 0.8, size: 1.63, rotY: R.ing2 },
    // (l'elica a sinistra e un po' in basso: a destra i testi grandi si leggono senza particelle sotto)
    { t: c, sx: -0.24, sy: -0.1, size: 0.44, rotY: R.sci0, elev: 8, key: 1, rim: 1.4, env: 0.8, aura: 0.25, ambient: 0.7 },
    { t: c + 0.2, uP: 0 },
    { t: c + 1.6, uP: 1, size: 0.4, rotY: R.sci1, twist: 0.6 },
    { t: c + 3, size: 0.42, rotY: R.sci2, twist: 2.2 },
    ...ritualKeys(T, { size: 0.42, rotY: R.sci2 - 0.25, twist: 2.6 }, day),
    { t: d, ...day },
    { t: d + 1.6, sx: -0.42, size: 0.6, rotY: R.day3 },
    { t: p, sx: 0, sy: -0.15, size: 0.44, rotY: R.shop0, elev: 7, key: 1.3, rim: 0.7, env: 1.05, shadow: 1, aura: 0, spot: 1 },
    { t: p + 1.2, sy: -0.14, size: 0.46, rotY: R.shop1, lin: true },
    // il footer spinge via la scena: il barattolo sale insieme alla pagina (1 viewport = 2 unita' di sy)
    { t: e, sy: 1.86 },
  ]
}

function mobileKeys(T, R) {
  const s = T.story, i = T.ingredients, c = T.science, d = T.daily, p = T.shop, e = T.end
  const day = { sx: 0, sy: 0.46, size: 0.26, rotY: -TAU, elev: 8, uP: 0, ambient: 0, aura: 0.6, rim: 1.2, key: 1.05, env: 0.85 }
  return [
    { t: s, ...BASE, sx: 0.04, sy: -0.17, size: 0.27, heroFit: true, rotY: R.hero, rotX: 0.34, rotZ: -0.3, elev: 2, shadow: 0 },
    { t: s + 0.06, heroOut: 0 },
    { t: s + 1.0, sx: 0, sy: -0.4, size: 0.36, rotY: 0.1, rotX: 0, rotZ: 0, elev: 8, key: 0.9, rim: 1.6, env: 0.75, heroOut: 1 },
    { t: s + 1.95, rotY: -0.14 },
    { t: s + 3, sy: -0.32, size: 0.4, rotY: -0.3, elev: 12, key: 1, rim: 0.25, env: 1, shadow: 1 },
    { t: s + 3.6, sy: -0.6, size: 0.66, rotY: R.s4a, elev: 8, key: 1.1, rim: 1.7, env: 0.7, shadow: 0, aura: 1 },
    { t: s + 4.05, sy: -0.64, size: 0.7, rotY: R.s4 },
    { t: s + 4.7, sx: -0.3, sy: -0.9, size: 1.0, rotY: R.s5a, rotX: 0.04, elev: 24, rim: 1.2, aura: 0.55 },
    { t: s + 5.3, sx: 0.3, sy: -0.2, size: 0.8, rotY: R.s5b, rotX: 0, elev: 11 },
    { t: s + 6, sx: 0, sy: 0, size: 0.36, rotY: R.s6, elev: 9, rim: 1.3, aura: 0.7 },
    { t: i, sx: 0.44, sy: 0.12, size: 0.22, rotY: R.ing0, elev: 10, key: 1, rim: 1.4, env: 0.8, aura: 0.55, ambient: 0.3 },
    // primo piano: la tabella intera, di fronte, nella meta' alta; la lista resta sotto sul fondo scuro
    { t: i + 0.8, sx: -0.08, sy: 0.86, size: 0.9, rotY: R.ingM, elev: 3, key: 1.05, rim: 0.8, env: 0.85, aura: 0, ambient: 0 },
    { t: i + 2.95, sy: 0.86, size: 0.91, rotY: R.ingM - 0.03 },
    { t: c, sx: 0, sy: 0.04, size: 0.34, rotY: R.sci0, elev: 8, key: 1, rim: 1.4, env: 0.8, aura: 0.25, ambient: 0.7 },
    { t: c + 0.2, uP: 0 },
    { t: c + 1.6, uP: 1, size: 0.3, rotY: R.sci1, twist: 0.6 },
    { t: c + 3, size: 0.31, rotY: R.sci2, twist: 2.2 },
    ...ritualKeys(T, { size: 0.31, rotY: R.sci2 - 0.25, twist: 2.6 }, day),
    { t: d, ...day },
    { t: d + 1.6, size: 0.27, rotY: -TAU - 0.3 },
    { t: p, sx: 0, sy: -0.05, size: 0.36, rotY: R.shop0, elev: 7, key: 1.3, rim: 0.7, env: 1.05, shadow: 1, aura: 0, spot: 1 },
    { t: p + 1.2, sy: -0.04, size: 0.37, rotY: R.shop1, lin: true },
    { t: e, sy: 1.96 },
  ]
}

/**
 * Traccia 3D per il layout corrente. fit adatta le dimensioni al formato dello schermo;
 * i keyframe con heroFit seguono invece la composizione della hero (testi in min(vw, vh)).
 */
export function buildTrack(T, layout, fit = 1, aspect = 1.5, geo = null) {
  const R = { ...ROT, ...labelPoses(geo) }
  const keys = layout === 'mobile' ? mobileKeys(T, R) : desktopKeys(T, R)
  const sxScale = layout === 'tablet' ? 0.82 : 1
  // mobile: tarata sui telefoni (9:19.5), su schermi verticali piu' larghi il barattolo non cresce
  const heroFit = layout === 'mobile'
    ? Math.min(1, Math.max(0.82, aspect / 0.462))
    : Math.min(1, Math.max(0.6, aspect / 1.5))
  return new Track(
    keys.map(({ heroFit: own, ...k }) => ({
      ...k,
      ...(k.size !== undefined && { size: k.size * (own ? heroFit : fit) }),
      ...(k.sx !== undefined && { sx: k.sx * sxScale }),
    })),
  )
}

/**
 * Timeline DOM guidata dallo scroll: colori di fondo, uscita del titolo, parallasse.
 * palette = colori della narrazione del prodotto attivo (products.js).
 */
export function buildMaster(T, layout, palette = COLORS) {
  const s = T.story, i = T.ingredients, c = T.science, d = T.daily, p = T.shop, e = T.end
  const root = document.documentElement
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  const blur = layout !== 'mobile'

  // --- palette che evolve con la narrazione
  // Lo sfondo sfuma direttamente sul body e sul velo della navbar: ricalcolano lo stile solo loro
  // (~0.1 ms a fotogramma). Le variabili del tema sulla radice (--bg, --fg, --accent) cambiano solo
  // quando cambia il colore dei testi (due volte in tutta la pagina), a meta' passaggio, quando i
  // testi sono gia' usciti o devono ancora entrare: ogni cambio sulla radice fa ricalcolare lo
  // stile di tutta la pagina (~10 ms su un computer, 60-100 ms su un telefono medio). Sfumate a ogni
  // fotogramma erano scatti continui a ogni cambio di scena, anche all'uscita dal bicchiere. Il resto
  // di navbar e menu prodotti (pulsanti, numeri) legge il fondo del momento da --page-bg (base.css),
  // cambiato a meta' passaggio e sfumato dalle loro transizioni CSS: ricalcola solo loro.
  const vars = (k) => ({ '--bg': k.bg, '--fg': k.fg, '--accent': k.accent })
  const chrome = document.querySelectorAll('.nav, .pmenu')
  const fills = [document.body, ...document.querySelectorAll('.nav__bg')]
  const C = palette
  let prev = { bg: C.paper, fg: C.ink, accent: C.berry }
  tl.set(root, vars(prev), 0)
  if (chrome.length) tl.set(chrome, { '--page-bg': prev.bg }, 0) // (il valore di partenza: tornando in cima si rilegge questo)
  const steps = [
    { at: s + 1.1, dur: 0.9, bg: C.mist },
    { at: s + 3.0, dur: 0.6, bg: C.plum, fg: C.paper, accent: C.berryHi },
    { at: i - 0.8, dur: 0.8, bg: C.night },
    { at: c - 0.8, dur: 0.8, bg: C.abyss },
    { at: d - 0.8, dur: 0.8, bg: C.wine },
    { at: p - 0.8, dur: 0.8, bg: C.paper, fg: C.ink, accent: C.berry },
  ]
  for (const step of steps) {
    const next = { ...prev, ...step }
    const mid = step.at + step.dur / 2
    tl.fromTo(fills, { backgroundColor: prev.bg }, { backgroundColor: next.bg, duration: step.dur, ease: 'power1.inOut', immediateRender: false }, step.at)
    if (next.fg !== prev.fg || next.accent !== prev.accent) tl.set(root, vars(next), mid)
    if (chrome.length) tl.set(chrome, { '--page-bg': next.bg }, mid)
    prev = next
  }

  // --- hero: le tre parole escono in tre direzioni diverse, il raso svanisce
  const out = (x, y) => ({
    xPercent: x, yPercent: y, autoAlpha: 0,
    filter: blur ? 'blur(14px)' : 'none',
    duration: 0.7, ease: 'power2.in', immediateRender: false,
  })
  const inn = { xPercent: 0, yPercent: 0, autoAlpha: 1, filter: blur ? 'blur(0px)' : 'none' }
  // (i titoli sono davanti al barattolo: escono prima che lui ci passi sopra)
  tl.fromTo('.hero-il', inn, out(-55, 0), s + 0.04)
  tl.fromTo('.hero-ritual', inn, { ...out(55, -6), duration: 0.42 }, s + 0.03)
  tl.fromTo('.hero-quot', inn, { ...out(0, 60), duration: 0.36 }, s + 0.04)
  tl.fromTo('[data-hero-ui]', { y: 0, autoAlpha: 1 }, { y: -36, autoAlpha: 0, duration: 0.3, ease: 'power1.in', immediateRender: false }, s)
  tl.fromTo('.silk', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.5, immediateRender: false }, s + 0.45)

  // --- sipario: sale coprendo la hero (la curva si distende), i testi salgono piu' lenti
  const curtain = document.querySelector('[data-curtain]')
  if (curtain) {
    const m = curtainMetrics(curtain, layout)
    const [r0, r1] = CURTAIN.rise
    const [e0, e1] = CURTAIN.exit
    tl.fromTo(curtain, { y: 0 }, { y: -m.rise, duration: r1 - r0, ease: 'power1.inOut' }, s + r0)
    tl.fromTo(m.cap, { scaleY: 1 }, { scaleY: 0.2, duration: r1 - r0, ease: 'power1.in' }, s + r0)
    tl.fromTo(m.content, { y: 0 }, { y: m.shift, duration: r1 - r0, ease: 'power1.inOut' }, s + r0)
    tl.fromTo(m.title, { y: 0 }, { y: -26, duration: e0 - r1 }, s + r1)
    // (esce del tutto: corpo + bordo curvo inferiore, alto quanto quello superiore)
    tl.fromTo(curtain, { y: -m.rise }, { y: -m.rise - m.vh - m.capH - 4, duration: e1 - e0, ease: 'power2.in', immediateRender: false }, s + e0)
  }

  // --- parallasse leggera dei titoli mentre restano in scena
  tl.fromTo('.s3__w--1', { y: 30 }, { y: -30, duration: 1.2 }, s + 1.95)
  tl.fromTo('.s3__w--2', { y: 60 }, { y: -60, duration: 1.2 }, s + 1.95)
  tl.fromTo('.s3__w--3', { y: 90 }, { y: -90, duration: 1.2 }, s + 1.95)
  tl.fromTo('.s4__title', { y: 40 }, { y: -40, duration: 1.0 }, s + 3.1)
  tl.fromTo('.sci__a', { x: 40 }, { x: -10, duration: 3.6 }, c - 0.4)
  tl.fromTo('.sci__b', { x: -40 }, { x: 10, duration: 3.6 }, c - 0.4)

  // --- shop: luce da campagna, che si spegne quando arriva il footer
  tl.fromTo('.spot', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 }, p - 0.6)
  tl.fromTo('.spot', { autoAlpha: 1 }, { autoAlpha: 0, duration: e - (p + 1.2), immediateRender: false }, p + 1.2)

  return tl
}

/**
 * Misure del sipario (in px, ricalcolate a ogni resize):
 * rise = di quanto sale per coprire lo schermo, shift = quanto scendono i testi al suo interno
 * perche' a sipario chiuso stiano a circa un quarto dell'altezza.
 */
export function curtainMetrics(curtain, layout) {
  const vh = curtain.parentElement.clientHeight
  const body = curtain.querySelector('.curtain__body')
  const content = curtain.querySelector('[data-curtain-content]')
  const capH = body.offsetTop
  const goal = layout === 'mobile' ? 0.13 : 0.24
  return {
    vh,
    top: curtain.offsetTop,
    capH,
    rise: curtain.offsetTop + capH,
    shift: Math.max(0, vh * goal - content.offsetTop),
    cap: curtain.querySelector('.curtain__cap'),
    content,
    title: curtain.querySelector('.curtain__title'),
  }
}

/**
 * Entrate/uscite dei testi agganciate allo scroll (in avanti escono verso l'alto,
 * tornando indietro rientrano dall'alto). hooks permette azioni extra per elemento.
 */
export function buildReveals(T, { reduced, getVh, hooks = {} }) {
  const s = T.story, i = T.ingredients, c = T.science, d = T.daily, p = T.shop
  const list = [
    ['s2copy', s + 0.66, s + 1.9],
    ['s3a', s + 2.24, s + 2.98],
    ['s3b', s + 2.38, s + 2.98],
    ['s3c', s + 2.52, s + 2.98],
    ['s3tags', s + 2.6, s + 2.98],
    ['s3cert', s + 2.6, s + 2.98],
    ['s4', s + 3.28, s + 4.0],
    ['s4claim', s + 3.5, s + 4.0],
    ['pins-a', s + 4.42, s + 5.0],
    ['pins-b', s + 5.04, s + 5.62],
    ['ing-title', i - 0.25, i + 2.95],
    ['ing-intro', i + 0.05, i + 2.95],
    ['ing-card', i + 0.2, i + 2.95],
    ['ing-hero', i + 0.3, i + 2.95],
    ['ing-note', i + 1.9, i + 2.95],
    ['sci-a', c + 0.7, c + 2.95],
    ['sci-b', c + 0.95, c + 2.95],
    ['sci-copy', c + 1.25, c + 2.95],
    ['sci-claim', c + 1.5, c + 2.95],
    ['sci-data', c + 1.7, c + 2.95],
    // la durata: compare subito, mentre il bicchiere finisce di uscire
    ['daily-title', d - 0.3, d + 1.55],
    ['daily-facts', d - 0.15, d + 1.55],
    ['shop-a', p - 0.25, null],
    ['shop-b', p - 0.12, null],
    ['shop-cta', p + 0.05, null],
  ]

  const entries = []
  for (const [name, tIn, tOut] of list) {
    document.querySelectorAll(`[data-reveal="${name}"]`).forEach((el) => entries.push([el, tIn, tOut]))
  }
  // (oltre il settimo attivo le righe arrivano piu' fitte: anche le liste lunghe si completano presto)
  document.querySelectorAll('[data-reveal="ing-item"]').forEach((el, k) => {
    entries.push([el, i + 0.55 + Math.min(k, 6) * 0.2 + Math.max(0, k - 6) * 0.1, i + 2.95])
  })

  for (const [el, tIn, tOut] of entries) {
    const extra = hooks.get?.(el)
    const doShow = (dir) => {
      show(el, { dir, reduced })
      extra?.show?.(dir)
    }
    const doHide = (dir) => {
      hide(el, { dir, reduced })
      extra?.hide?.(dir)
    }
    ScrollTrigger.create({
      start: () => tIn * getVh(),
      end: () => (tOut ?? 1e4) * getVh(),
      onEnter: () => doShow(1),
      onEnterBack: () => doShow(-1),
      onLeave: () => tOut != null && doHide(1),
      onLeaveBack: () => doHide(-1),
    })
  }
}

/** Destinazioni dei link di navigazione (in t). */
export function gotoMap(T) {
  return {
    top: 0,
    about: T.story + 1.45,
    science: T.science + 1.9,
    shop: T.shop + 0.55,
  }
}

/*
  Tabella nutrizionale sull'etichetta (coordinate della texture, misurate sul PDF di stampa):
  l'etichetta (305 mm) avvolge 5.86 rad del barattolo, centro U = 0.5 = fronte;
  in altezza va da 9.7 mm a 94.7 mm dalla base (V = 0 in alto).
*/
const LABEL_SPAN = 5.86
const ROWS_V = [0.548, 0.573, 0.599, 0.624, 0.649, 0.675, 0.7, 0.725].map((v) => v + 0.003) // collagene ... biotina
const TABLE_RIGHT_U = 0.262 // appena dentro il bordo destro del riquadro viola

/** Fine di ogni riga della tabella (base del barattolo = 0), nello stesso ordine della lista. */
export function tableAnchors(jarW) {
  const r = (jarW / 2) * 0.968
  const a = (TABLE_RIGHT_U - 0.5) * LABEL_SPAN
  return ROWS_V.map((v) => ({
    local: { x: Math.sin(a) * r, y: 0.0097 + (1 - v) * 0.085, z: Math.cos(a) * r },
    normal: { x: Math.sin(a), y: 0, z: Math.cos(a) },
  }))
}

/*
  Altri prodotti (geo in products.js): l'etichetta avvolge `span` radianti con il centro sul fronte;
  u, v sono le coordinate di un punto della grafica (0..1, v = 0 in alto), misure in metri dalla base.
*/
const labelAngle = (geo, u) => (u - 0.5) * geo.span
const labelY = (geo, v) => geo.labelBottom + (1 - v) * geo.labelHeight

/*
  Scena 5b (macro dell'etichetta, dettagli a sinistra) tarata sul collagene: i suoi due punti
  stanno in media a 0.497 dell'altezza del barattolo. Per gli altri prodotti la camera sale o
  scende (sy, 2 unita' = 1 viewport) finche' i loro punti cadono alla stessa altezza sullo schermo.
*/
const S5B = { sy: -0.15, size: 1.22, mid: 0.497 }

/** Pose delle scene con i dettagli e con la tabella, perche' guardino la grafica del prodotto. */
function labelPoses(geo) {
  if (!geo) return {}
  const table = labelAngle(geo, geo.table)
  // scena 5b: i due dettagli (a sinistra del barattolo) a cavallo del fronte
  const mid = (labelAngle(geo, geo.dose.u) + labelAngle(geo, geo.gmp.u)) / 2
  const midY = (labelY(geo, geo.dose.v) + labelY(geo, geo.gmp.v)) / 2 / geo.jarH
  return {
    s5b: -mid,
    s5bY: S5B.sy + 2 * S5B.size * (S5B.mid - midY),
    ing1: -table + 0.3 - TAU,
    ing2: -table + 0.266 - TAU,
    ingM: -table - TAU,
  }
}

/** Punti del barattolo a cui sono agganciati i dettagli della scena 5 (base del barattolo = 0). */
export function pinAnchors(jarH, jarW, geo = null) {
  if (geo) {
    const at = (a, r, y) => ({ local: { x: Math.sin(a) * r, y, z: Math.cos(a) * r }, normal: { x: Math.sin(a), y: 0, z: Math.cos(a) } })
    const deg = Math.PI / 180
    return {
      cap: at(geo.cap.deg * deg, geo.cap.r, geo.cap.y),
      band: at(geo.band.deg * deg, geo.band.r, geo.band.y),
      dose: at(labelAngle(geo, geo.dose.u), geo.labelR, labelY(geo, geo.dose.v)),
      gmp: at(labelAngle(geo, geo.gmp.u), geo.labelR, labelY(geo, geo.gmp.v)),
    }
  }
  const R = jarW / 2
  const RL = R * 0.968 // raggio dell'etichetta
  const at = (deg, r, y) => {
    const a = (deg * Math.PI) / 180
    return { local: { x: Math.sin(a) * r, y, z: Math.cos(a) * r }, normal: { x: Math.sin(a), y: 0, z: Math.cos(a) } }
  }
  // angoli: 0 = fronte dell'etichetta, positivi verso destra (posizioni reali della grafica)
  return {
    cap: at(50, R, jarH - 0.0072),
    band: at(62, R, jarH - 0.0178),
    dose: at(25, RL, 0.0437),
    gmp: at(85, RL, 0.0777),
  }
}
