import * as THREE from 'three'
import { loadModel } from './assets.js'
import { DEG, lerp, smooth } from './kit.js'

/*
  VETRINA (capsula e compressa): il prodotto non entra nel bicchiere (si deglutisce con l'acqua) e
  non gli passa mai davanti o dietro, dove sembrerebbe dentro all'acqua. Resta sospeso alla sua
  destra e ruota su se stesso; il bicchiere gira sul piatto (il logo inciso passa davanti e dietro)
  e la camera gira intorno al set. Poi la macro sui dettagli (materiali, giunzione, incisione) e il
  prodotto si posa sul piano accanto al bicchiere.

  DOSE DEL GIORNO (setCount: due capsule, tre compresse...): nella macro c'e' un solo pezzo. Gli
  altri compaiono quando la camera lascia la macro, in alto e fuori dall'inquadratura, scendono uno
  dopo l'altro e si posano accanto al primo (disposizione in doseLayout). I pezzi a parte (secondo
  numero di setCount, es. la compressa del mantenimento) arrivano per ultimi e si posano dall'altra
  parte del bicchiere, a sinistra, con la loro etichetta (anchors.aside); allora l'etichetta della
  dose (water) passa dal bicchiere ai pezzi della dose, a destra.

  BENEFICI: nella macro tre etichette attorno al prodotto (b1-b3: a sinistra, a destra, sotto; sul
  telefono una riga sola, b1, sotto). Il testo resta fermo mentre il prodotto gira: il pallino
  scorre sul suo bordo (calloutView).

  CapsuleExperience e TabletExperience aggiungono solo modello, materiali, pose e disposizione.
*/

const TOTAL = 16

// arrivo degli altri pezzi della dose (progresso della sezione): dalla fine della macro, quando la
// camera e' ancora vicinissima al primo e loro, piu' in alto, non entrano nell'inquadratura;
// ognuno si posa poco dopo il precedente (il primo si posa a 0.92)
const DOSE = { from: 0.8, land: 0.935, stagger: 0.016, height: 0.2 }
// i pezzi a parte arrivano dopo: si posano quando compare la loro etichetta (0.965)
const ASIDE = { from: 0.83, land: 0.97, stagger: 0.012 }

// Ogni proprieta' scorre tra le chiavi che la contengono (ScrollAnimation.addTrack): nella macro cf
// e inquadratura sono ripetuti a 0.72 e 0.8, altrimenti scenderebbero gia' da 0.62 verso la chiave
// 0.9 e la camera, ancora vicinissima, perderebbe il prodotto.
// Nella macro la camera guarda il prodotto di fronte, appena da sinistra (il lato in luce): il
// bicchiere, alla sua sinistra, esce dall'inquadratura e lascia spazio all'etichetta (rientra
// quando la camera si allontana).
const CAMERA = {
  desktop: [
    { at: 0.0, tx: 0, ty: 0.084, tz: 0, dist: 0.68, az: 0, el: 9, fov: 15, sx: 0.2, sy: -0.02, roll: 0, cf: 0 },
    { at: 0.2, tx: 0.02, ty: 0.082, dist: 0.64, az: -6, el: 8, sx: 0.12 },
    { at: 0.35, tx: 0.03, dist: 0.58, az: 4, el: 7, sx: 0.06 },
    { at: 0.5, tx: 0.035, ty: 0.084, dist: 0.5, az: 14, el: 9, sx: 0.04, cf: 0 },
    { at: 0.62, dist: 0.17, az: -2, el: 10, fov: 16, sx: 0.08, sy: 0.0, cf: 1, ease: 'power2.inOut' },
    { at: 0.72, dist: 0.16, az: -8, el: 13, fov: 15.8, sx: 0.08, sy: 0.0, cf: 1 },
    { at: 0.8, dist: 0.17, az: -4, el: 15, fov: 15.8, sx: 0.08, sy: 0.0, cf: 1 },
    { at: 0.9, tx: 0, ty: 0.072, dist: 0.8, az: 4, el: 8, fov: 15, sx: 0.22, sy: -0.02, cf: 0, ease: 'power2.inOut' }, // bicchiere a destra, titolo a sinistra
    { at: 1.0, dist: 0.84, az: 2 },
  ],
  mobile: [
    { at: 0.0, tx: 0.025, ty: 0.09, tz: 0, dist: 0.86, az: 0, el: 9, fov: 24, sx: 0, sy: -0.24, roll: 0, cf: 0 },
    { at: 0.2, tx: 0.03, ty: 0.086, dist: 0.8, az: -6, el: 8, sy: -0.22 },
    { at: 0.35, tx: 0.035, ty: 0.084, dist: 0.74, az: 4, el: 7 },
    { at: 0.5, tx: 0.04, ty: 0.085, dist: 0.64, az: 14, el: 9, cf: 0 },
    { at: 0.62, dist: 0.2, az: -2, el: 10, sy: -0.06, cf: 1, ease: 'power2.inOut' },
    { at: 0.72, dist: 0.19, az: -8, el: 13, sy: -0.06, cf: 1 },
    { at: 0.8, dist: 0.2, az: -4, el: 15, sy: -0.06, cf: 1 },
    { at: 0.9, tx: 0.03, ty: 0.075, dist: 0.88, az: 4, el: 8, sy: -0.26, cf: 0, ease: 'power2.inOut' },
    { at: 1.0, dist: 0.92, az: 2 },
  ],
}

export class ShowcaseExperience {
  static type = 'showcase'
  static models = []

  constructor(ctx) {
    this.ctx = ctx
    this.scene = ctx.scene
    this.total = TOTAL
    // orbita attorno al bicchiere (gradi, 0 = davanti), raggio e quota; assetto del prodotto
    this.s = { T: 0, orbit: 55, radius: 0.072, py: 0.118, spin: 0, tiltX: 0, tiltZ: 0, glassRot: 30 }
    this.anchors = { dose: new THREE.Vector3(), water: new THREE.Vector3() }
    this.follow = new THREE.Vector3()
    // sagome da cui escono le linee delle etichette: il prodotto e il bicchiere. Nella macro
    // l'etichetta del prodotto sta a sinistra, nello spazio lasciato libero dal bicchiere
    this.bodies = { dose: { center: this.follow, radius: 0 }, water: { center: new THREE.Vector3(), radius: 0 } }
    this.layout = 'desktop'
    this.count = 1
    this.aside = 0
    this.setPinSides()
    this.dose = [] // gli altri pezzi della dose, dal secondo in poi, e quelli a parte
  }

  /** Assetto sospeso e a riposo (gradi), quota a riposo (m), ingombro per l'ombra: dalle sottoclassi. */
  get pose() {
    return { floatX: 10, floatZ: 70, restX: 0, restZ: 90, restY: 0.004, size: 0.02, spinTurns: 1.5 }
  }

  /**
   * Dove si posano gli altri pezzi della dose rispetto al primo: x verso destra e z verso la camera
   * dell'inquadratura finale (m), yaw = rotazione sul piano (gradi). Le sottoclassi danno i primi
   * posti (dosePlaces); oltre, la fila continua.
   */
  doseLayout(count) {
    const places = this.dosePlaces ?? []
    const step = this.pose.size * 1.15
    return Array.from({ length: count - 1 }, (_, i) => places[i] ?? { x: step * (i + 1), z: i % 2 ? 0.003 : -0.004, yaw: i % 2 ? -20 : 30 })
  }

  /**
   * Dove si posa il pezzo a parte k: a sinistra del bicchiere, ben staccato dalla dose che e' a
   * destra (sul telefono tra il bicchiere e il bordo dello schermo c'e' meno spazio).
   */
  asidePlace(k) {
    const gap = this.layout === 'mobile' ? 0.004 : 0.02
    const x = -(this.scene.glassInfo.rOut + gap + this.pose.size * (0.5 + 1.25 * k))
    return { x, z: 0.008, yaw: k % 2 ? -25 : 20 }
  }

  async load() {
    const file = this.ctx.files?.[0] ?? this.constructor.models[0]
    this.root = await loadModel(this.ctx.modelUrl(file), this.ctx.loadOptions)
  }

  build() {
    this.pivot = new THREE.Group()
    this.pivot.rotation.order = 'ZXY'
    for (const mesh of this.createMeshes(this.root)) this.pivot.add(mesh)
    this.scene.back.add(this.pivot)
    // punti della superficie (vertici radi): i benefici partono dal bordo del prodotto sullo schermo
    this.outline = []
    for (const mesh of this.pivot.children) {
      const pos = mesh.geometry.attributes.position
      const step = Math.max(1, Math.floor(pos.count / 400))
      for (let i = 0; i < pos.count; i += step) this.outline.push(new THREE.Vector3().fromBufferAttribute(pos, i))
    }
    this.buildShadow()
    this.buildDose()
  }

  /**
   * Quante capsule o compresse si posano alla fine: la dose e quelle a parte (il prodotto cambia,
   * il tipo resta).
   */
  setCount(n, aside = 0) {
    const count = Math.max(1, Math.round(n) || 1)
    const apart = Math.max(0, Math.round(aside) || 0)
    if (count === this.count && apart === this.aside) return
    this.count = count
    this.aside = apart
    this.setPinSides()
    if (this.pivot) this.buildDose()
  }

  /**
   * Lato preferito di ogni etichetta (letto dal motore a ogni ricostruzione). Con i pezzi a parte le
   * etichette della dose e del mantenimento stanno sopra i loro pezzi (sul telefono quella dei pezzi
   * a parte sotto: sopra c'e' gia' quella della dose).
   */
  setPinSides() {
    const benefits = { b1: 'left', b2: 'right', b3: 'below' }
    const mobile = { b1: 'below' }
    this.pinSides = this.aside
      ? { dose: 'left', water: 'above', aside: 'above', ...benefits, mobile: { ...mobile, aside: 'below' } }
      : { dose: 'left', ...benefits, mobile }
  }

  /**
   * Gli altri pezzi della dose e quelli a parte: copie del primo (stesse geometrie e materiali),
   * ognuno con la sua ombra e i suoi tempi (from: compare in alto, land: posato).
   */
  buildDose() {
    this.disposeDose()
    const piece = (place, n, from, land) => {
      const group = new THREE.Group() // posizione e rotazione sul piano
      const pivot = new THREE.Group() // assetto, come quello del primo pezzo
      pivot.rotation.order = 'ZXY'
      for (const mesh of this.pivot.children) pivot.add(mesh.clone())
      group.add(pivot)
      group.visible = false
      const shadow = new THREE.Mesh(this.shadow.geometry, this.shadowMat.clone())
      shadow.rotation.x = -Math.PI / 2
      shadow.renderOrder = -5
      shadow.visible = false
      this.scene.back.add(group, shadow)
      return { ...place, n, from, land, group, pivot, shadow }
    }
    const dose = this.doseLayout(this.count).map((place, i) =>
      piece(place, i + 1, DOSE.from + DOSE.stagger * i, DOSE.land + DOSE.stagger * (i + 1)),
    )
    const aside = Array.from({ length: this.aside }, (_, k) =>
      piece({ aside: true, k }, dose.length + k + 1, ASIDE.from + ASIDE.stagger * k, ASIDE.land + ASIDE.stagger * k),
    )
    this.dose = [...dose, ...aside]
    this.doseSpan = Math.max(0, ...dose.map((d) => d.x)) // larghezza della dose posata (dal primo pezzo)
    // etichetta dei pezzi a parte: agganciata al primo di loro, solo quando c'e'
    this.asideBody = aside.length ? { center: new THREE.Vector3(), radius: 0 } : null
  }

  disposeDose() {
    for (const d of this.dose) {
      d.group.parent?.remove(d.group)
      d.shadow.parent?.remove(d.shadow)
      d.shadow.material.dispose()
    }
    this.dose = []
    this.asideBody = null
    delete this.anchors.aside
    delete this.bodies.aside
  }

  /**
   * Le etichette non coprono il prodotto e gli altri pezzi della dose quando ci sono (nella macro il
   * prodotto e' in screenObstacles: la sua sagoma sullo schermo, piu' stretta del suo ingombro 3D).
   */
  get obstacles() {
    const dose = this.dose.filter((d) => d.group.visible).map((d) => d.group)
    return this.silhouette ? dose : [this.pivot, ...dose]
  }

  /** Nella macro: il rettangolo della sagoma del prodotto sullo schermo (px, con 6 px di margine). */
  screenObstacles({ w, h }) {
    const s = this.silhouette
    const m = 6
    return s ? [{ l: ((s.x0 + 1) / 2) * w - m, r: ((s.x1 + 1) / 2) * w + m, t: ((1 - s.y1) / 2) * h - m, b: ((1 - s.y0) / 2) * h + m }] : []
  }

  /** Tutti i pezzi sulla scena (controlli del banco di prova). */
  get pieces() {
    return [this.pivot, ...this.dose.filter((d) => d.group.visible).map((d) => d.group)]
  }

  /** Ombra morbida sul piano quando il prodotto si avvicina (si posa accanto al bicchiere). */
  buildShadow() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(0,0,0,0.9)')
    grd.addColorStop(0.45, 'rgba(0,0,0,0.5)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    this.shadowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.shadowMat)
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.renderOrder = -5
    this.scene.back.add(this.shadow)
  }

  tracks(layout) {
    this.layout = layout // (i pezzi a parte si posano dove c'e' spazio in questa impaginazione)
    const p = this.pose
    const turns = p.spinTurns * 360
    // orbit: angolo attorno al bicchiere (0 = verso la camera, 90 = a destra). Resta tra 38 e 80:
    // con la camera tra -8 e 14 gradi il prodotto e' sempre di lato, mai davanti o dietro al vetro
    const keys = [
      { at: 0.0, orbit: 38, radius: 0.082, py: 0.108, spin: 0, tiltX: p.floatX, tiltZ: p.floatZ },
      { at: 0.2, orbit: 58, radius: 0.08, py: 0.102, spin: turns * 0.14, tiltX: p.floatX + 14 },
      { at: 0.35, orbit: 72, py: 0.098, spin: turns * 0.26, tiltX: p.floatX + 6 },
      { at: 0.5, orbit: 80, radius: 0.082, py: 0.096, spin: turns * 0.38, tiltX: p.floatX - 8 },
      // macro
      { at: 0.62, orbit: 78, radius: 0.086, py: 0.098, spin: turns * 0.52, tiltX: p.floatX, tiltZ: p.floatZ },
      { at: 0.72, orbit: 76 },
      { at: 0.8, orbit: 74, py: 0.1, spin: turns * 0.8, tiltX: p.floatX + 10 },
      // si posa sul piano, accanto al bicchiere
      { at: 0.92, orbit: 58, radius: 0.08, py: p.restY, spin: turns, tiltX: p.restX, tiltZ: p.restZ, ease: 'power2.inOut' },
      { at: 1.0, orbit: 57 },
    ]
    return [
      { target: this.s, keys: [{ at: 0, T: 0 }, { at: 1, T: TOTAL, ease: 'none' }] },
      { target: this.s, keys },
      // il bicchiere gira sul piatto insieme al prodotto (piu' lento: il set ruota piano)
      { target: this.s, keys: [{ at: 0, glassRot: 30 }, { at: 1, glassRot: 230, ease: 'none' }] },
      { target: 'camera', keys: CAMERA[layout === 'mobile' ? 'mobile' : 'desktop'], follow: this.follow },
    ]
  }

  prepare() {}

  update(time) {
    const s = this.s
    const u = this.scene.u
    const live = this.ctx.reduced ? 0 : 1
    // fluttua appena quando e' sospeso, fermo quando e' posato
    const floating = smooth(this.pose.restY + 0.002, this.pose.restY + 0.03, s.py)
    const bob = Math.sin(time * 1.1) * 0.0012 * floating * live
    const a = s.orbit * DEG
    this.pivot.position.set(Math.sin(a) * s.radius, s.py + bob, Math.cos(a) * s.radius)
    this.pivot.rotation.set(
      (s.tiltX + Math.sin(time * 0.5) * 3 * floating * live) * DEG,
      (s.spin + Math.sin(time * 0.4) * 4 * floating * live) * DEG,
      s.tiltZ * DEG,
      'ZXY',
    )
    this.pivot.updateMatrixWorld(true)
    u.uGlassRot.value = s.glassRot * DEG
    u.uRipple.value = 0
    u.uCloud.value = 0

    this.follow.copy(this.pivot.position)
    this.anchors.dose.copy(this.follow)
    const g = this.scene.glassInfo
    this.bodies.dose.radius = this.pose.size * 0.55
    if (this.aside) {
      // con i pezzi a parte (a sinistra) l'etichetta della dose del giorno sta sui suoi pezzi, a destra
      this.anchors.water.set(this.follow.x + this.doseSpan / 2, this.follow.y, this.follow.z)
      this.bodies.water.center.copy(this.anchors.water)
      this.bodies.water.radius = this.doseSpan / 2 + this.pose.size * 0.55
    } else {
      this.anchors.water.set(-g.rIn * 0.72, g.waterY, g.rIn * 0.5)
      this.bodies.water.center.set(0, g.waterY, 0)
      this.bodies.water.radius = g.rOut
    }

    // ombra: piu' scura e stretta quanto piu' il prodotto e' vicino al piano
    const h = Math.max(0, this.follow.y - this.pose.restY)
    const k = 1 - smooth(0.0, 0.05, h)
    const size = this.pose.size * (1.2 + h * 30)
    this.shadow.position.set(this.follow.x + 0.002, 0.0003, this.follow.z - 0.002)
    this.shadow.scale.set(size * 1.6, size, 1)
    this.shadowMat.opacity = 0.85 * k
    this.shadow.visible = k > 0.01

    this.updateDose(time, live)
  }

  /**
   * Gli altri pezzi della dose: prima della fine della macro non ci sono; poi scendono dall'alto
   * (girando su se stessi e raddrizzandosi) e si posano accanto al primo, che seguono (orbit, radius).
   * I pezzi a parte scendono dritti a sinistra del bicchiere (mai davanti o dietro al vetro).
   */
  updateDose(time, live) {
    if (!this.dose.length) return
    const s = this.s
    const pose = this.pose
    const p = s.T / TOTAL // progresso della sezione: T scorre lineare con lo scroll
    const a = s.orbit * DEG
    const x0 = Math.sin(a) * s.radius
    const z0 = Math.cos(a) * s.radius
    const on = p > DOSE.from
    for (const d of this.dose) {
      const up = 1 - smooth(d.from, d.land, p)
      const side = d.n % 2 ? 1 : -1
      const h = (DOSE.height + 0.02 * d.n) * up // quota sopra il piano
      const floating = smooth(0.002, 0.03, h)
      const bob = Math.sin(time * 1.1 + d.n * 1.7) * 0.0012 * floating * live
      d.group.visible = on
      if (d.aside) {
        const at = this.asidePlace(d.k)
        d.group.position.set(at.x, pose.restY + h + bob, at.z - 0.01 * up)
        d.group.rotation.y = (at.yaw + 50 * side * up) * DEG
      } else {
        d.group.position.set(x0 + d.x + 0.012 * d.n * up, pose.restY + h + bob, z0 + d.z - 0.01 * up)
        d.group.rotation.y = (d.yaw + 50 * side * up) * DEG
      }
      d.pivot.rotation.set(
        (lerp(pose.restX, pose.floatX + 14 * side, up) + Math.sin(time * 0.5 + d.n) * 3 * floating * live) * DEG,
        (pose.spinTurns * 360 - 120 * side * up) * DEG,
        lerp(pose.restZ, pose.floatZ, up) * DEG,
        'ZXY',
      )
      // ombra come quella del primo pezzo, girata come il pezzo
      const k = 1 - smooth(0.0, 0.05, h)
      const size = pose.size * (1.2 + h * 30)
      d.shadow.position.set(d.group.position.x + 0.002, 0.0003, d.group.position.z - 0.002)
      d.shadow.rotation.z = d.group.rotation.y
      d.shadow.scale.set(size * 1.6, size, 1)
      d.shadow.material.opacity = 0.85 * k
      d.shadow.visible = on && k > 0.01
    }
    const first = this.asideBody && this.dose.find((d) => d.aside)
    if (first && on) {
      this.asideBody.center.copy(first.group.position)
      this.asideBody.radius = pose.size * 0.55
      this.anchors.aside = this.asideBody.center
      this.bodies.aside = this.asideBody
    } else {
      delete this.anchors.aside
      delete this.bodies.aside
    }
  }

  /**
   * Dopo la camera, nella macro: la sagoma del prodotto sullo schermo (inviluppo convesso dei suoi
   * punti) e cio' che serve ai benefici, che restano fermi mentre il prodotto gira: il suo centro,
   * fin dove arriva girando su se stesso (misurato una volta, all'ingresso nella macro) e i suoi
   * bordi sulle linee orizzontale e verticale che passano per il centro (li' scorrono i pallini).
   */
  updateView() {
    const p = this.s.T / TOTAL
    // (da 0.64: la camera e' gia' arrivata nella macro, l'ingombro si misura con la sua inquadratura)
    if (p < 0.64 || p > 0.8 || !this.outline?.length) {
      this.view = null
      this.silhouette = null
      return
    }
    const cam = this.scene.camera
    const c = (this._c ??= new THREE.Vector3()).copy(this.follow).project(cam)
    const hull = convexHull(this.projectOutline(cam))
    const s = (this.silhouette = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity })
    for (const [x, y] of hull) {
      s.x0 = Math.min(s.x0, x)
      s.x1 = Math.max(s.x1, x)
      s.y0 = Math.min(s.y0, y)
      s.y1 = Math.max(s.y1, y)
    }
    const across = chord(hull, 1, c.y) // bordi sinistro e destro all'altezza del centro
    const down = chord(hull, 0, c.x) // bordi in basso e in alto sulla verticale del centro
    const reach = this.view?.aspect === cam.aspect ? this.view.reach : this.measureReach(cam, c)
    this.view = {
      aspect: cam.aspect,
      c: { x: c.x, y: c.y },
      reach,
      edge: { left: across?.[0] ?? s.x0, right: across?.[1] ?? s.x1, bottom: down?.[0] ?? s.y0, top: down?.[1] ?? s.y1 },
    }
  }

  /** Punti della superficie del prodotto sullo schermo (coordinate normalizzate, -1..1). */
  projectOutline(cam, step = 1) {
    const w = (this._w ??= new THREE.Vector3())
    const pts = []
    for (let i = 0; i < this.outline.length; i += step) {
      w.copy(this.outline[i]).applyMatrix4(this.pivot.matrixWorld).project(cam)
      pts.push([w.x, w.y])
    }
    return pts
  }

  /**
   * Fin dove arriva il prodotto attorno al suo centro c mentre gira su se stesso (un giro intero,
   * con la camera di adesso), con un margine per la camera che si avvicina e l'assetto che cambia
   * un poco durante la macro.
   */
  measureReach(cam, c) {
    const keep = this.pivot.rotation.y
    const r = { left: 0, right: 0, top: 0, bottom: 0 }
    for (let i = 0; i < 24; i++) {
      this.pivot.rotation.y = keep + (i / 24) * Math.PI * 2
      this.pivot.updateMatrixWorld(true)
      for (const [x, y] of this.projectOutline(cam, 3)) {
        r.left = Math.max(r.left, c.x - x)
        r.right = Math.max(r.right, x - c.x)
        r.top = Math.max(r.top, y - c.y)
        r.bottom = Math.max(r.bottom, c.y - y)
      }
    }
    this.pivot.rotation.y = keep
    this.pivot.updateMatrixWorld(true)
    for (const k in r) r[k] *= 1.12
    return r
  }

  /**
   * Per i benefici, in px: centro del prodotto, fin dove arriva girando e i suoi bordi sulle linee
   * per il centro. null fuori dalla macro.
   */
  calloutView({ w, h }) {
    const v = this.view
    if (!v) return null
    const X = (x) => ((x + 1) / 2) * w
    const Y = (y) => ((1 - y) / 2) * h
    const r = v.reach
    return {
      c: { x: X(v.c.x), y: Y(v.c.y) },
      reach: { left: (r.left * w) / 2, right: (r.right * w) / 2, top: (r.top * h) / 2, bottom: (r.bottom * h) / 2 },
      edge: {
        left: { x: X(v.edge.left), y: Y(v.c.y) },
        right: { x: X(v.edge.right), y: Y(v.c.y) },
        top: { x: X(v.c.x), y: Y(v.edge.top) },
        bottom: { x: X(v.c.x), y: Y(v.edge.bottom) },
      },
    }
  }

  setTheme() {}

  dispose() {
    this.disposeDose()
    this.pivot?.parent?.remove(this.pivot)
    this.shadow?.parent?.remove(this.shadow)
    this.pivot?.traverse((o) => {
      if (o.material) [].concat(o.material).forEach((m) => m.dispose())
    })
    this.shadowMat?.map?.dispose()
    this.shadowMat?.dispose()
  }
}

/** Inviluppo convesso di punti [x, y] (catena monotona), in senso antiorario. */
function convexHull(points) {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1])
  if (pts.length < 3) return pts
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list) => {
    const out = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...half(pts), ...half(pts.reverse())]
}

/**
 * Dove la retta coordinata[axis] = value attraversa il poligono convesso: [minimo, massimo]
 * dell'altra coordinata, o null se non lo attraversa.
 */
function chord(hull, axis, value) {
  const o = 1 - axis
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i]
    const q = hull[(i + 1) % hull.length]
    if ((p[axis] - value) * (q[axis] - value) > 0 || p[axis] === q[axis]) continue
    const t = (value - p[axis]) / (q[axis] - p[axis])
    const x = p[o] + (q[o] - p[o]) * t
    lo = Math.min(lo, x)
    hi = Math.max(hi, x)
  }
  return lo <= hi ? [lo, hi] : null
}
