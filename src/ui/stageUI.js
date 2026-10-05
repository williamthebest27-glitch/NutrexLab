import gsap from 'gsap'
import { Vector3 } from 'three'
import { pinAnchors, curtainMetrics, tableAnchors } from '../choreography.js'

const SVG = 'http://www.w3.org/2000/svg'

/**
 * Elementi DOM che seguono il prodotto 3D: aura luminosa, dettagli della scena 5,
 * linee degli ingredienti e stato della navbar.
 */
export function createStageUI({ T, stage, getLayout, getProduct }) {
  const aura = document.querySelector('.aura')
  const nav = document.querySelector('[data-nav]')

  // --- sipario scuro: la navbar diventa chiara quando ci passa sopra
  const curtain = document.querySelector('[data-curtain]')
  let cm = curtain && curtainMetrics(curtain, getLayout())
  function overCurtain(y) {
    if (!cm) return false
    const top = cm.top + cm.capH + gsap.getProperty(curtain, 'y')
    return y > top && y < top + cm.vh
  }

  // --- dettagli agganciati al barattolo (punti ricalcolati a ogni cambio prodotto)
  const pins = [...document.querySelectorAll('[data-pin]')].map((el) => ({
    el,
    left: el.classList.contains('pin--left'),
    local: null,
    normal: null,
    out: { x: 0, y: 0, facing: 1 },
  }))

  // --- linee ingredienti: da ogni voce alla sua riga nella tabella nutrizionale dell'etichetta
  const svg = document.querySelector('[data-ing-lines]')
  const ingEls = [document.querySelector('.ing__hero'), ...document.querySelectorAll('.ing')]
  const ingredients = ingEls.map((el) => {
    const line = document.createElementNS(SVG, 'line')
    const dot = document.createElementNS(SVG, 'circle')
    dot.setAttribute('r', '0')
    svg.append(line, dot)
    return { el, line, dot, p: 0, local: null, normal: null, out: { x: 0, y: 0, facing: 1 } }
  })

  const vec = (v) => v && new Vector3(v.x, v.y, v.z)
  /** Punti del barattolo attivo: dettagli (tutti i prodotti) e righe della tabella (solo il collagene). */
  function anchor() {
    if (!stage) return
    const product = getProduct()
    const pinPoints = pinAnchors(stage.jarH, stage.jarW, product.geo)
    for (const pin of pins) {
      const a = pinPoints[pin.el.dataset.pin]
      pin.local = vec(a?.local)
      pin.normal = vec(a?.normal)
      pin.textW = 0 // testo nuovo: larghezza da rimisurare
    }
    const rows = product.labelAnchors ? tableAnchors(stage.jarW) : []
    ingredients.forEach((it, k) => {
      it.local = vec(rows[k]?.local)
      it.normal = vec(rows[k]?.normal)
    })
  }
  anchor()

  const hooks = new Map()
  for (const item of ingredients) {
    hooks.set(item.el, {
      show: () => gsap.to(item, { p: 1, duration: 1.2, delay: 0.25, ease: 'power3.out', overwrite: true }),
      hide: () => gsap.to(item, { p: 0, duration: 0.45, ease: 'power2.in', overwrite: true }),
    })
  }

  function updatePins(t) {
    const active = t > T.story + 4.3 && t < T.story + 5.75
    if (!active) return
    const m = stage.metrics
    const pad = 34 + m.halfW * 0.2
    for (const pin of pins) {
      if (!pin.local) continue
      stage.project(pin.local, pin.normal, pin.out)
      const { x, y } = pin.out
      pin.el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`
      // la linea esce sempre dalla sagoma del barattolo, cosi' il testo non copre il prodotto,
      // ma si accorcia se il testo altrimenti uscirebbe dallo schermo
      pin.textW ||= pin.el.querySelector('.pin__text').offsetWidth
      let len = pin.left ? x - (m.cx - m.halfW - pad) : m.cx + m.halfW + pad - x
      const room = pin.left ? x - pin.textW - 24 : stage.size.w - 24 - pin.textW - x
      len = Math.min(len, room)
      pin.el.style.setProperty('--line', `${Math.max(28, len).toFixed(0)}px`)
      const face = Math.min(1, Math.max(0, (pin.out.facing - 0.12) / 0.25))
      pin.el.style.setProperty('--face', face.toFixed(2))
    }
  }

  function updateLines(t) {
    const active = t > T.ingredients - 0.3 && t < T.ingredients + 3.3 && getLayout() !== 'mobile'
    if (!active) {
      if (svg._on) {
        svg._on = false
        svg.style.visibility = 'hidden'
      }
      return
    }
    if (!svg._on) {
      svg._on = true
      svg.style.visibility = 'visible'
    }
    for (const it of ingredients) {
      if (it.local) stage.project(it.local, it.normal, it.out)
      // la riga deve essere sul lato visibile del barattolo
      const face = it.local ? Math.min(1, Math.max(0, (it.out.facing - 0.08) / 0.2)) : 0
      const p = it.p * face
      if (p < 0.002) {
        it.line.setAttribute('x2', it.line.getAttribute('x1') || 0)
        it.dot.setAttribute('r', '0')
        continue
      }
      // letto a ogni frame: la linea segue la voce anche durante la sua entrata
      const r = it.el.getBoundingClientRect()
      const x1 = r.left - 16
      const y1 = r.top + Math.min(r.height * 0.5, 12)
      const ex = it.out.x
      const ey = it.out.y
      const x2 = x1 + (ex - x1) * p
      const y2 = y1 + (ey - y1) * p
      it.line.setAttribute('x1', x1.toFixed(1))
      it.line.setAttribute('y1', y1.toFixed(1))
      it.line.setAttribute('x2', x2.toFixed(1))
      it.line.setAttribute('y2', y2.toFixed(1))
      it.dot.setAttribute('cx', x2.toFixed(1))
      it.dot.setAttribute('cy', y2.toFixed(1))
      it.dot.setAttribute('r', (3 * p).toFixed(2))
    }
  }

  function update(t, scrollY) {
    // aura (luce calda dietro al prodotto nelle scene scure)
    if (stage?.cur) {
      const m = stage.metrics
      aura.style.translate = `${m.cx.toFixed(1)}px ${m.cy.toFixed(1)}px`
      aura.style.opacity = Math.max(0, Math.min(1, stage.cur.aura)).toFixed(3)
      updatePins(t)
      updateLines(t)
    }

    // navbar: compatta dopo l'inizio dello scroll, chiara sopra al sipario e al footer
    const inCurtain = t < T.story + 2.6
    nav.classList.toggle('is-compact', scrollY > 40)
    nav.classList.toggle('is-inverse', t > T.end - 0.06 || (inCurtain && overCurtain(36)))
  }

  function resize() {
    if (curtain) cm = curtainMetrics(curtain, getLayout())
    for (const pin of pins) pin.textW = 0
  }

  return { update, resize, hooks, setProduct: anchor }
}
