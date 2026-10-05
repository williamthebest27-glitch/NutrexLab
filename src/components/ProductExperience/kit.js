import * as THREE from 'three'
import { particleVertex, particleFragment, plumeVertex, plumeFragment, bubbleVertex, bubbleFragment } from './shaders/particles.js'

/* Utilita' condivise dalle esperienze: numeri casuali ripetibili, fisica della caduta (gemella di
   quella degli shader), tabelle precalcolate, sistemi di particelle sopra/sotto l'acqua. */

/** Generatore casuale con seme: le particelle sono identiche a ogni caricamento. */
export function random(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Caduta con attrito lineare (identica a pe_fall in shaders/particles.js). */
export function fall(t, p0, v0, g, k, out = new THREE.Vector3()) {
  const e = Math.exp(-k * t)
  const vt = -g / k
  out.x = p0.x + (v0.x * (1 - e)) / k
  out.y = p0.y + vt * t + ((v0.y - vt) * (1 - e)) / k
  out.z = p0.z + (v0.z * (1 - e)) / k
  return out
}

/** Tempo d'impatto con il piano y = level (stessa bisezione dello shader). */
export function hitTime(p0, v0, level, g, k) {
  let lo = 0
  let hi = 4
  const v = new THREE.Vector3()
  for (let i = 0; i < 14; i++) {
    const mid = 0.5 * (lo + hi)
    if (fall(mid, p0, v0, g, k, v).y > level) lo = mid
    else hi = mid
  }
  return hi
}

/** Curva campionata su [t0, t1] con interpolazione lineare. */
export class Table {
  constructor(t0, t1, n) {
    this.t0 = t0
    this.t1 = t1
    this.v = new Float32Array(n)
  }

  index(t) {
    return ((t - this.t0) / (this.t1 - this.t0)) * (this.v.length - 1)
  }

  add(t, value) {
    const i = Math.round(this.index(t))
    if (i >= 0 && i < this.v.length) this.v[i] += value
  }

  at(t) {
    const x = Math.min(this.v.length - 1, Math.max(0, this.index(t)))
    const i = Math.floor(x)
    const f = x - i
    return this.v[i] + ((this.v[Math.min(i + 1, this.v.length - 1)] ?? 0) - this.v[i]) * f
  }
}

/**
 * Legge la timeline in pausa in n punti tra `from` e `to` (progresso 0..1) e restituisce
 * quello che `read` estrae dallo stato: serve a sapere dov'era il misurino quando ogni
 * granello si e' staccato. Alla fine la timeline torna dov'era.
 */
export function sampleTimeline(tl, from, to, n, read) {
  const keep = tl.time()
  const out = []
  for (let i = 0; i <= n; i++) {
    const p = from + ((to - from) * i) / n
    tl.time(p, true)
    out.push({ p, ...read() })
  }
  tl.time(keep, true)
  return out
}

const BLEND = {
  transparent: true,
  premultipliedAlpha: true,
  depthWrite: false,
  blending: THREE.NormalBlending,
}

/**
 * Particelle disegnate in due strati: sopra l'acqua (strato posteriore) e sotto (strato interno).
 * uniforms condivisi tra le due copie; uPixel e' separato perche' lo strato interno e' piu' piccolo.
 */
export function addParticles(scene, geometry, uniforms, { kind = 'grain', above = true, below = true, renderOrder = 60 } = {}) {
  const shaders = {
    grain: [particleVertex, particleFragment],
    plume: [plumeVertex, plumeFragment],
    bubble: [bubbleVertex, bubbleFragment],
  }[kind]
  const out = { uniforms, materials: [], objects: [] }
  const make = (layer) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: shaders[0],
      fragmentShader: shaders[1],
      uniforms: { ...uniforms, uPixel: { value: 1 } },
      defines: layer === 'below' ? { REGION_BELOW: '' } : {},
      ...BLEND,
    })
    const points = new THREE.Points(geometry, mat)
    points.frustumCulled = false
    points.renderOrder = renderOrder
    ;(layer === 'below' ? scene.inside : scene.back).add(points)
    out.materials.push({ mat, layer })
    out.objects.push(points)
  }
  if (above) make('above')
  if (below) make('below')
  return out
}

/** Pixel per metro a distanza 1, per ogni strato (lo strato interno e' a risoluzione ridotta). */
export function updatePixelScale(system, scene) {
  const px = scene.pixelScale()
  for (const { mat, layer } of system.materials) {
    mat.uniforms.uPixel.value = layer === 'below' ? px * scene.quality.insideScale : px
  }
}

export function disposeParticles(system, scene) {
  for (const o of system.objects) {
    o.parent?.remove(o)
    o.material.dispose()
  }
  system.objects[0]?.geometry.dispose()
}

/** Attributi di un sistema di particelle a partire da array gia' riempiti. */
export function particleGeometry({ start, vel, seed, release, size }) {
  const g = new THREE.BufferGeometry()
  const n = release.length
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
  if (vel) g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
  g.setAttribute('aRelease', new THREE.BufferAttribute(release, 1))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.08, 0), 0.5)
  return g
}

export const DEG = Math.PI / 180
export const lerp = (a, b, t) => a + (b - a) * t
export const clamp01 = (x) => Math.min(1, Math.max(0, x))
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
