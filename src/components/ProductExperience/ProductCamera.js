import * as THREE from 'three'

const DEG = Math.PI / 180

/*
  Camera cinematografica: orbita attorno a un punto (target) con distanza, azimut ed elevazione
  (gradi), focale stretta da still life (fov verticale) e decentramento ottico (sx, sy: come il banco
  ottico del sito, il soggetto si sposta sullo schermo senza far convergere le verticali).
  I valori di `state` li anima la timeline GSAP; qui si aggiungono solo un respiro lentissimo
  (camera viva anche a scroll fermo) e la leggera parallasse del puntatore.
  `follow` (punto 3D) con il peso state.cf: la camera segue il prodotto (macro).
*/
export class ProductCamera {
  constructor(camera) {
    this.camera = camera
    this.state = { tx: 0, ty: 0.09, tz: 0, dist: 1, az: 0, el: 9, fov: 15, sx: 0, sy: 0, roll: 0, cf: 0 }
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 }
    this.follow = null
    this.live = 1
    this._target = new THREE.Vector3()
    this._v = new THREE.Vector3()
  }

  update(dt, time, size) {
    const s = this.state
    const p = this.pointer
    const k = 1 - Math.exp(-dt * 2.2)
    p.sx += (p.x - p.sx) * k
    p.sy += (p.y - p.sy) * k
    const live = this.live
    const az = (s.az + Math.sin(time * 0.21) * 0.45 * live + p.sx * 1.4) * DEG
    const el = (s.el + Math.sin(time * 0.17 + 1.3) * 0.3 * live - p.sy * 0.8) * DEG
    const d = s.dist
    const t = this._target.set(s.tx, s.ty + Math.sin(time * 0.29) * 0.0005 * live, s.tz)
    if (this.follow && s.cf > 0) t.lerp(this.follow, Math.min(1, s.cf))
    const cam = this.camera
    cam.position.set(
      t.x + d * Math.cos(el) * Math.sin(az),
      t.y + d * Math.sin(el),
      t.z + d * Math.cos(el) * Math.cos(az),
    )
    cam.up.set(0, 1, 0)
    cam.lookAt(t)
    if (s.roll) cam.rotateZ(s.roll * DEG)
    cam.fov = s.fov
    cam.near = Math.max(0.01, d * 0.04)
    cam.far = d + 5
    const { w, h } = size
    cam.setViewOffset(w, h, (-s.sx * w) / 2, (s.sy * h) / 2, w, h)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
  }

  /** Punto 3D -> pixel nello stage (x, y) e se sta davanti alla camera. */
  project(point, size, out = {}) {
    const v = this._v.copy(point).project(this.camera)
    out.x = (v.x * 0.5 + 0.5) * size.w
    out.y = (-v.y * 0.5 + 0.5) * size.h
    out.visible = v.z < 1
    return out
  }

  /** Raggio (m) di una sfera centrata in un punto 3D -> pixel sullo schermo. */
  pixelRadius(point, radius, size) {
    const depth = Math.max(1e-4, -this._v.copy(point).applyMatrix4(this.camera.matrixWorldInverse).z)
    return (radius / (depth * Math.tan((this.camera.fov * DEG) / 2))) * (size.h / 2)
  }

  /** Rettangolo sullo schermo (px: l, r, t, b) che contiene dei punti 3D. */
  rectOf(points, size) {
    const o = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity }
    const p = (this._p ??= {})
    for (const point of points) {
      this.project(point, size, p)
      if (!p.visible) continue
      o.l = Math.min(o.l, p.x)
      o.r = Math.max(o.r, p.x)
      o.t = Math.min(o.t, p.y)
      o.b = Math.max(o.b, p.y)
    }
    return o
  }

  /** Rettangolo sullo schermo dell'ingombro di un oggetto (bounding box delle geometrie). */
  rectOfObject(object, size) {
    const box = (this._box ??= new THREE.Box3()).setFromObject(object)
    const pts = (this._corners ??= Array.from({ length: 8 }, () => new THREE.Vector3()))
    pts.forEach((v, i) => v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z))
    return this.rectOf(pts, size)
  }
}
