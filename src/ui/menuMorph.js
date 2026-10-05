import gsap from 'gsap'

/*
  Desktop: appena si inizia a scorrere la scheda dei prodotti della hero si richiude nel pulsante
  PRODOTTI in alto a destra; tornando in cima si riapre.
  Fa il viaggio una copia della scheda, in un livello fisso sopra la pagina:
  - le scritte scivolano via e il titolo sale;
  - gli esagoni colorati si accendono e volano, uno dopo l'altro, dentro l'esagono del pulsante;
  - il pannello di vetro si stringe fino a diventare la pillola;
  - il pulsante atterra con un rimbalzo, un'onda parte dall'esagono e un riflesso lo attraversa.
  Al ritorno lo stesso viaggio al contrario. Il menu vero cambia stato (classe is-drop) mentre la
  copia lo copre, cosi' non si vede nessuno scatto.
*/

const NONE = 'rgba(0, 0, 0, 0)'

/**
 * Volo lungo una curva (Bezier quadratica) dal punto a al punto b: il punto di controllo e' spostato
 * di lato (side, px), cosi' gli esagoni girano attorno al pulsante come in un vortice.
 */
function arc(el, a, b, side, vars) {
  const mx = (a.x + b.x) / 2 + side
  const my = (a.y + b.y) / 2 - Math.abs(side) * 0.45
  const p = { t: 0 }
  return gsap.to(p, {
    t: 1,
    ...vars,
    onUpdate() {
      const t = p.t
      const u = 1 - t
      gsap.set(el, { x: u * u * a.x + 2 * u * t * mx + t * t * b.x, y: u * u * a.y + 2 * u * t * my + t * t * b.y })
    },
  })
}

function box(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }
}

export function createMenuMorph({ root, card, toggle }) {
  const hub = toggle.querySelector('.pmenu__toggle-hex')
  const label = toggle.querySelector('.pmenu__toggle-label')
  const chev = toggle.querySelector('.pmenu__chev')
  let state = root.classList.contains('is-drop') // true = pulsante, false = scheda
  let wanted = state
  let heading = state // dove sta andando il viaggio in corso
  let tl = null
  let layer = null
  let settling = false

  /** Copia della scheda (stessa posizione e stesso aspetto) in un livello fisso sopra la pagina. */
  function ghost() {
    layer = document.createElement('div')
    layer.className = 'pmenu-ghost'
    layer.setAttribute('aria-hidden', 'true')
    layer.inert = true
    const shell = card.cloneNode(true)
    shell.classList.add('pmenu__card--ghost')
    for (const p of ['opacity', 'visibility', 'transform', 'translate']) shell.style.removeProperty(p)
    layer.append(shell)
    document.body.append(layer)
    shell.querySelector('.pmenu__list').scrollTop = card.querySelector('.pmenu__list').scrollTop
    for (const h of shell.querySelectorAll('.pmenu__hex')) h.style.visibility = 'hidden'
    return shell
  }

  /** Esagoni che volano tra la lista e il pulsante: copie nelle posizioni degli esagoni della scheda. */
  function flyers() {
    return [...card.querySelectorAll('.pmenu__item')].map((item) => {
      const hex = item.querySelector('.pmenu__hex')
      const r = box(hex)
      const color = getComputedStyle(item).getPropertyValue('--swatch').trim()
      const active = item.getAttribute('aria-pressed') === 'true'
      const el = hex.cloneNode(true)
      el.classList.add('pmenu-ghost__hex')
      el.style.setProperty('--swatch', color)
      layer.append(el)
      gsap.set(el, { x: r.x, y: r.y, width: r.w, height: r.h, transformOrigin: '50% 50%', fill: active ? color : NONE })
      return { el, r, color, active }
    })
  }

  /** Onda che parte dall'esagono del pulsante. */
  function ripple(c) {
    const ring = document.createElement('span')
    ring.className = 'pmenu-ghost__ring'
    layer?.append(ring)
    gsap.fromTo(
      ring,
      { x: c.cx - 20, y: c.cy - 20, scale: 0.35, autoAlpha: 0.9 },
      { scale: 2.8, autoAlpha: 0, duration: 0.85, ease: 'power2.out' },
    )
  }

  function done() {
    layer?.remove()
    layer = null
    tl = null
    gsap.set([card, toggle, hub, label, chev], { clearProps: 'opacity,visibility,transform' })
    toggle.classList.remove('is-shine')
    if (!settling && wanted !== state) to(wanted) // la direzione e' cambiata durante il viaggio
  }

  // --- scheda -> pulsante
  function dock() {
    heading = true
    const from = box(card)
    const shell = ghost()
    const fly = flyers()
    gsap.set(shell, { left: from.x, top: from.y, width: from.w, height: from.h })
    // il menu vero diventa subito pulsante, nascosto finche' la copia non arriva
    root.classList.add('is-drop')
    state = true
    gsap.set(toggle, { autoAlpha: 0 })
    const to = box(toggle)
    const c = box(hub)

    tl = gsap.timeline({ onComplete: done })
    // 1) le scritte scivolano via, il titolo sale, la voce attiva si spegne
    shell.classList.add('is-quiet')
    tl.to(shell.querySelector('.pmenu__head'), { autoAlpha: 0, y: -14, duration: 0.32, ease: 'power2.in' }, 0)
    tl.to(shell.querySelectorAll('.pmenu__name, .pmenu__num'), {
      autoAlpha: 0, x: 22, duration: 0.3, ease: 'power2.in', stagger: 0.016,
    }, 0)
    // 2) gli esagoni si accendono del colore del prodotto e volano nell'esagono del pulsante
    fly.forEach((f, i) => {
      const at = 0.08 + i * 0.038
      const side = (i % 2 ? -1 : 1) * (40 + i * 5) // curve alternate a destra e a sinistra
      tl.to(f.el, { fill: f.color, scale: 1.3, duration: 0.2, ease: 'power2.out' }, at)
      tl.add(arc(f.el, { x: f.r.x, y: f.r.y }, { x: c.cx - f.r.w / 2, y: c.cy - f.r.h / 2 }, side, {
        duration: 0.62, ease: 'power3.in',
      }), at + 0.16)
      tl.to(f.el, { scale: 0.28, rotation: 360, duration: 0.62, ease: 'power3.in' }, at + 0.16)
      tl.set(f.el, { autoAlpha: 0 }, at + 0.78)
    })
    // 3) il pannello di vetro si stringe fino a diventare la pillola
    tl.to(shell, {
      left: to.x, top: to.y, width: to.w, height: to.h, borderRadius: to.h / 2, padding: 0,
      duration: 0.82, ease: 'expo.inOut',
    }, 0.14)
    // 4) atterraggio: rimbalzo, esagono che assorbe gli altri, onda, scritta che sale e riflesso
    const land = 0.96
    tl.add(() => ripple(c), land - 0.04)
    tl.set(toggle, { autoAlpha: 1 }, land)
    tl.to(shell, { autoAlpha: 0, duration: 0.22 }, land)
    tl.fromTo(toggle, { scaleX: 1.16, scaleY: 0.84 }, { scaleX: 1, scaleY: 1, duration: 1.1, ease: 'elastic.out(1, 0.38)' }, land)
    tl.fromTo(hub, { scale: 2, rotation: -150 }, { scale: 1, rotation: 0, duration: 0.85, ease: 'back.out(2.2)' }, land)
    tl.fromTo(label, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.75, ease: 'expo.out' }, land + 0.06)
    tl.fromTo(chev, { x: -10, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out' }, land + 0.16)
    tl.add(() => toggle.classList.add('is-shine'), land + 0.12)
    tl.to({}, { duration: 0.01 }, land + 1.12) // fine dopo il riflesso
  }

  // --- pulsante -> scheda
  function undock() {
    heading = false
    const pill = box(toggle)
    const c = box(hub)
    // 1) il pulsante si svuota: scritta e freccia salgono via, l'esagono si gonfia
    tl = gsap.timeline({ onComplete: open })
    tl.to([label, chev], { autoAlpha: 0, yPercent: -80, duration: 0.2, ease: 'power2.in' }, 0)
    tl.to(hub, { scale: 1.9, rotation: 140, duration: 0.24, ease: 'power2.in' }, 0)

    function open() {
      // il menu vero torna scheda, nascosta finche' la copia non l'ha ricostruita
      root.classList.remove('is-drop')
      state = false
      gsap.set(card, { autoAlpha: 0 })
      const to = box(card)
      const cs = getComputedStyle(card)
      const shell = ghost()
      const fly = flyers()
      const head = shell.querySelector('.pmenu__head')
      const texts = shell.querySelectorAll('.pmenu__name, .pmenu__num')
      shell.classList.add('is-quiet')
      gsap.set(shell, { left: pill.x, top: pill.y, width: pill.w, height: pill.h, borderRadius: pill.h / 2, padding: 0 })
      gsap.set(head, { autoAlpha: 0, y: -14 })
      gsap.set(texts, { autoAlpha: 0, x: 22 })
      for (const f of fly) {
        gsap.set(f.el, { x: c.cx - f.r.w / 2, y: c.cy - f.r.h / 2, scale: 0.28, rotation: -300, fill: f.color, autoAlpha: 0 })
      }
      ripple(c)

      tl = gsap.timeline({ onComplete: done })
      tl.timeScale(wanted !== heading ? 3 : 1)
      // 2) la pillola si allarga fino a diventare la scheda
      tl.to(shell, {
        left: to.x, top: to.y, width: to.w, height: to.h, borderRadius: cs.borderTopLeftRadius,
        paddingTop: cs.paddingTop, paddingRight: cs.paddingRight, paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft,
        duration: 0.86, ease: 'expo.inOut',
      }, 0)
      // 3) gli esagoni escono dal pulsante e tornano ognuno al suo posto
      fly.forEach((f, i) => {
        const at = 0.1 + i * 0.038
        const side = (i % 2 ? 1 : -1) * (40 + i * 5)
        tl.set(f.el, { autoAlpha: 1 }, at)
        tl.add(arc(f.el, { x: c.cx - f.r.w / 2, y: c.cy - f.r.h / 2 }, { x: f.r.x, y: f.r.y }, side, {
          duration: 0.8, ease: 'expo.out',
        }), at)
        tl.to(f.el, { scale: 1, rotation: 0, duration: 0.8, ease: 'expo.out' }, at)
        tl.to(f.el, { fill: f.active ? f.color : NONE, duration: 0.4 }, at + 0.5)
      })
      // 4) titolo e nomi rientrano, la voce attiva si riaccende
      tl.to(head, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'expo.out' }, 0.5)
      tl.to(texts, { autoAlpha: 1, x: 0, duration: 0.6, ease: 'expo.out', stagger: 0.022 }, 0.52)
      tl.add(() => shell.classList.remove('is-quiet'), 0.9)
    }
  }

  /**
   * Va verso lo stato richiesto (true = pulsante). Se un viaggio e' in corso nella direzione opposta
   * lo fa finire in fretta (senza salti) e poi parte quello nuovo.
   */
  function to(drop) {
    wanted = drop
    if (tl) {
      tl.timeScale(drop !== heading ? 3 : 1)
      return
    }
    if (drop === state) return
    if (drop) dock()
    else undock()
  }

  /** Stato immediato, senza viaggio (mobile, movimento ridotto, primo frame). */
  function settle(drop) {
    settling = true
    for (let i = 0; tl && i < 3; i++) tl.progress(1)
    settling = false
    wanted = state = drop
    root.classList.toggle('is-drop', drop)
  }

  return { to, settle }
}
