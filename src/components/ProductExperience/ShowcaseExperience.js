import * as THREE from 'three'
import { loadModel } from './assets.js'
import { DEG, smooth } from './kit.js'

/*
  VETRINA (capsula e compressa): il prodotto non entra nel bicchiere (si deglutisce con l'acqua) e
  non gli passa mai davanti o dietro, dove sembrerebbe dentro all'acqua. Resta sospeso alla sua
  destra e ruota su se stesso; il bicchiere gira sul piatto (il logo inciso passa davanti e dietro)
  e la camera gira intorno al set. Poi la macro sui dettagli (materiali, giunzione, incisione) e il
  prodotto si posa sul piano accanto al bicchiere.

  CapsuleExperience e TabletExperience aggiungono solo modello, materiali e pose.
*/

const TOTAL = 16

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
    { at: 0.9, tx: 0, ty: 0.072, dist: 0.8, az: 4, el: 8, fov: 15, sx: -0.22, sy: -0.02, cf: 0, ease: 'power2.inOut' },
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
    this.pinSides = { dose: 'left' }
  }

  /** Assetto sospeso e a riposo (gradi), quota a riposo (m), ingombro per l'ombra: dalle sottoclassi. */
  get pose() {
    return { floatX: 10, floatZ: 70, restX: 0, restZ: 90, restY: 0.004, size: 0.02, spinTurns: 1.5 }
  }

  async load() {
    const file = this.constructor.models[0]
    this.root = await loadModel(this.ctx.modelUrl(file), this.ctx.loadOptions)
  }

  build() {
    this.pivot = new THREE.Group()
    this.pivot.rotation.order = 'ZXY'
    for (const mesh of this.createMeshes(this.root)) this.pivot.add(mesh)
    this.scene.back.add(this.pivot)
    this.buildShadow()
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
    this.anchors.water.set(-g.rIn * 0.72, g.waterY, g.rIn * 0.5)
    this.bodies.dose.radius = this.pose.size * 0.55
    this.bodies.water.center.set(0, g.waterY, 0)
    this.bodies.water.radius = g.rOut

    // ombra: piu' scura e stretta quanto piu' il prodotto e' vicino al piano
    const h = Math.max(0, this.follow.y - this.pose.restY)
    const k = 1 - smooth(0.0, 0.05, h)
    const size = this.pose.size * (1.2 + h * 30)
    this.shadow.position.set(this.follow.x + 0.002, 0.0003, this.follow.z - 0.002)
    this.shadow.scale.set(size * 1.6, size, 1)
    this.shadowMat.opacity = 0.85 * k
    this.shadow.visible = k > 0.01
  }

  setTheme() {}

  dispose() {
    this.pivot?.parent?.remove(this.pivot)
    this.shadow?.parent?.remove(this.shadow)
    this.pivot?.traverse((o) => {
      if (o.material) [].concat(o.material).forEach((m) => m.dispose())
    })
    this.shadowMat?.map?.dispose()
    this.shadowMat?.dispose()
  }
}
