import * as THREE from 'three'
import { loadModel, findMesh } from './assets.js'
import { NOISE } from './shaders/chunks.js'
import {
  random, fall, hitTime, Table, sampleTimeline, addParticles, updatePixelScale, disposeParticles,
  particleGeometry, DEG, smooth, clamp01,
} from './kit.js'

/*
  POLVERE: misurino + polvere a raso -> si avvicina al bicchiere, ruota, si inclina, la polvere cade
  in un filo sottile, entra nell'acqua, galleggia un istante, scende in una nuvola lattiginosa
  che si scioglie. Il misurino si allontana e il bicchiere resta solo.

  Tutto e' funzione del progresso della timeline (scroll): il cumulo nel misurino e' una superficie
  calcolata nel vertex shader (piano della polvere dentro la coppa conica), i granelli sono
  particelle deterministiche (shaders/particles.js) con i punti di partenza calcolati leggendo la
  timeline nei momenti in cui il misurino li lascia cadere.
*/

const TOTAL = 16            // secondi del "racconto" lungo tutta la sezione
const G = 0.55              // gravita' al rallentatore (m/s^2 del racconto)
const DRAG = { grain: 1.25, dust: 3.4 }
const REPOSE = 34 * DEG     // angolo di riposo della polvere
const POUR = [0.6, 0.9]     // finestra della timeline in cui la polvere esce

// --- coreografia (progresso 0..1 della sezione: stati del brief 0, 20, 40, 55, 65, 75, 85, 100%) ---
const CAMERA = {
  desktop: [
    { at: 0.0, tx: 0, ty: 0.1, tz: 0, dist: 0.96, az: 0, el: 8, fov: 15, sx: 0.26, sy: -0.02, roll: 0 },
    { at: 0.2, ty: 0.104, dist: 0.84, az: -6, el: 10, sx: 0.2 },
    { at: 0.4, ty: 0.112, dist: 0.72, az: -15, el: 15, sx: 0.12, sy: -0.02 },
    { at: 0.55, ty: 0.114, dist: 0.64, az: -19, el: 17, sx: 0.06 },
    { at: 0.65, ty: 0.106, dist: 0.56, az: -17, el: 19, sx: 0.0, sy: 0.0 },
    { at: 0.75, ty: 0.09, dist: 0.5, az: -10, el: 17, sx: -0.02 },
    { at: 0.86, ty: 0.058, dist: 0.46, az: -3, el: 7, sx: 0.0 },
    { at: 1.0, ty: 0.078, dist: 1.0, az: 2, el: 7, sx: -0.24, ease: 'power2.inOut' },
  ],
  mobile: [
    { at: 0.0, tx: 0, ty: 0.1, tz: 0, dist: 0.98, az: 0, el: 9, fov: 24, sx: 0, sy: -0.24, roll: 0 },
    { at: 0.2, ty: 0.108, dist: 0.84, az: -5, el: 11, sy: -0.2 },
    { at: 0.4, ty: 0.115, dist: 0.72, az: -12, el: 15, sy: -0.16 },
    { at: 0.55, ty: 0.115, dist: 0.66, az: -15, el: 17 },
    { at: 0.65, ty: 0.106, dist: 0.6, az: -14, el: 19, sy: -0.12 },
    { at: 0.75, ty: 0.09, dist: 0.54, az: -9, el: 17 },
    { at: 0.86, ty: 0.06, dist: 0.52, az: -3, el: 7, sy: -0.1 },
    { at: 1.0, ty: 0.08, dist: 0.92, az: 2, el: 7, sy: -0.26, ease: 'power2.inOut' },
  ],
}

const SCOOP = [
  { at: 0.0, px: 0.04, py: 0.178, pz: -0.012, yaw: 32, roll: 14, pitch: 3 },
  { at: 0.2, px: 0.028, py: 0.168, pz: -0.01, yaw: 28, roll: 13 },
  { at: 0.4, px: 0.006, py: 0.153, pz: -0.006, yaw: 24, roll: 12, pitch: 2 },
  { at: 0.55, px: 0.002, py: 0.15, pz: -0.003, yaw: 6, roll: 18 },
  { at: 0.65, px: 0.0, py: 0.149, pz: -0.002, yaw: 3, roll: 52, ease: 'power1.inOut' },
  { at: 0.75, py: 0.147, roll: 98, ease: 'sine.inOut' },
  { at: 0.82, roll: 122, pitch: -2 },
  { at: 0.86, px: 0.01, py: 0.152, roll: 112, pitch: 2 },
  { at: 1.0, px: 0.16, py: 0.26, pz: -0.11, yaw: 40, roll: 38, pitch: 12, ease: 'power2.in' },
]

const FILL = [
  { at: 0.0, fill: 1 },
  { at: 0.63, fill: 1 },
  { at: 0.68, fill: 0.8, ease: 'power1.in' },
  { at: 0.76, fill: 0.3, ease: 'none' },
  { at: 0.82, fill: 0.07, ease: 'power1.out' },
  { at: 0.86, fill: 0.03, ease: 'sine.out' },
]

/** Superficie della polvere nella coppa (vertex shader del cumulo). */
const HEAP = /* glsl */ `
uniform vec3 uPlaneN;
uniform float uPlaneD;
uniform vec4 uCone;         // raggio sul fondo, raggio al bordo, quota del fondo, quota del bordo
uniform float uDiskR;
uniform float uResidual;    // 1 = rimane solo un velo di polvere sul fondo
varying vec3 vHeap;
vec3 pe_heap(vec3 p) {
  float rho = clamp(length(p.xz) / uDiskR, 0.0, 1.0);
  float th = atan(p.z, p.x);
  vec2 dir = vec2(cos(th), sin(th));
  vec3 n = uPlaneN;
  float d = uPlaneD;
  float b = (uCone.y - uCone.x) / (uCone.w - uCone.z);
  float a = uCone.y - b * uCone.w;
  float k = n.x * dir.x + n.z * dir.y;
  // bordo: dove il piano incontra la parete conica in questa direzione (o il fondo)
  float yB = (d - a * k) / max(n.y + b * k, 1e-3);
  float rB;
  if (yB < uCone.z) {
    yB = uCone.z;
    rB = k > 1e-4 ? clamp((d - n.y * uCone.z) / k, 0.0, uCone.x) : uCone.x;
  } else {
    yB = min(yB, uCone.w);
    rB = a + b * yB;
  }
  vec3 B = vec3(dir.x * rB, yB, dir.y * rB);
  vec3 C = vec3(0.0, clamp(d / max(n.y, 0.05), uCone.z, uCone.w), 0.0);
  vec3 q = mix(C, B, rho);
  vec3 dust = vec3(dir.x * rho * uCone.x * 0.97, uCone.z + 0.00025, dir.y * rho * uCone.x * 0.97);
  return mix(q, dust, uResidual);
}
`

export class PowderExperience {
  static type = 'powder'
  static models = ['scoop.glb']

  constructor(ctx) {
    this.ctx = ctx
    this.scene = ctx.scene
    this.total = TOTAL
    this.s = { T: 0, px: 0.04, py: 0.178, pz: -0.012, yaw: 32, roll: 14, pitch: 3, fill: 1, glassRot: -10 }
    this.anchors = { dose: new THREE.Vector3(), water: new THREE.Vector3() }
    this.bodies = { dose: { center: new THREE.Vector3(), radius: 0 }, water: { center: new THREE.Vector3(), radius: 0 } }
    // a destra c'e' il manico del misurino; sul telefono sopra, dove lo schermo e' libero
    this.pinSides = { dose: 'left', mobile: { dose: 'above' } }
    this.heapU = {
      uPlaneN: { value: new THREE.Vector3(0, 1, 0) },
      uPlaneD: { value: 0 },
      uCone: { value: new THREE.Vector4(0.0176, 0.019, -0.025, 0) },
      uDiskR: { value: 0.0189 },
      uResidual: { value: 0 },
      uFlow: { value: new THREE.Vector3() },
    }
    this._q = new THREE.Quaternion()
    this._v = new THREE.Vector3()
    this._up = new THREE.Vector3()
  }

  async load() {
    const root = await loadModel(this.ctx.modelUrl('scoop.glb'), this.ctx.loadOptions)
    this.scoopSrc = findMesh(root, 'Misurino')
    this.powderSrc = findMesh(root, 'Polvere')
    if (!this.scoopSrc || !this.powderSrc) throw new Error('scoop.glb: mancano Misurino o Polvere')
  }

  build() {
    const sd = this.scoopSrc.userData
    this.dim = {
      riTop: sd.ri_top ?? 0.019,
      riBot: sd.ri_bot ?? 0.0176,
      depth: sd.depth ?? 0.025,
      level: sd.powder_level ?? -0.00012,
    }
    this.heapU.uCone.value.set(this.dim.riBot, this.dim.riTop, -this.dim.depth, 0)
    this.heapU.uDiskR.value = this.powderSrc.userData.radius ?? 0.0189

    this.rig = new THREE.Group()
    this.rig.rotation.order = 'YZX'

    // PP bianco satinato, appena traslucido ai bordi (sheen) e con un velo di lucido
    this.scoopMat = new THREE.MeshPhysicalMaterial({
      color: 0xf1f0eb,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
      sheen: 0.25,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xffffff),
      envMapIntensity: 0.6,
    })
    this.scoop = new THREE.Mesh(this.scoopSrc.geometry, this.scoopMat)

    this.powderMat = new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: 0.94, metalness: 0, envMapIntensity: 0.55 })
    this.powderMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.heapU)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${HEAP}`)
        .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(mix(uPlaneN, vec3(0.0, 1.0, 0.0), uResidual));')
        .replace('#include <begin_vertex>', 'vec3 transformed = pe_heap(position);\nvHeap = transformed;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vHeap;\nuniform vec3 uFlow;\n${NOISE}`)
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          // grana finissima: rilievo, piccole variazioni di bianco e qualche cristallo che brilla
          vec3 gp = (vHeap + uFlow) * 2600.0;
          float g1 = pe_noise(gp);
          float g2 = pe_noise(gp * 2.3 + 7.0);
          normal = normalize(normal + vec3(g1 - 0.5, g2 - 0.5, 0.0) * 0.55);
          float pe_spark = pow(pe_noise(gp * 4.1 + 3.0), 26.0);`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb *= 0.9 + 0.14 * pe_noise((vHeap + uFlow) * 1400.0);`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(pe_spark * 0.9);',
        )
    }
    this.powderMat.customProgramCacheKey = () => 'pe-heap-v1'
    this.powder = new THREE.Mesh(this.powderSrc.geometry, this.powderMat)
    this.powder.frustumCulled = false

    this.rig.add(this.scoop, this.powder)
    this.scene.back.add(this.rig)
    this.obstacles = [this.scoop] // le etichette non coprono il misurino, manico compreso
  }

  /** Tracce della timeline (l'orchestratore le trasforma in tween GSAP). */
  tracks(layout) {
    return [
      { target: this.s, keys: [{ at: 0, T: 0 }, { at: 1, T: TOTAL, ease: 'none' }] },
      // il bicchiere gira piano su se stesso per tutta la sezione (il logo inciso scorre)
      { target: this.s, keys: [{ at: 0, glassRot: -14 }, { at: 1, glassRot: 26, ease: 'none' }] },
      { target: this.s, keys: SCOOP },
      { target: this.s, keys: FILL },
      { target: 'camera', keys: CAMERA[layout === 'mobile' ? 'mobile' : 'desktop'] },
    ]
  }

  /** Dopo aver costruito la timeline: granelli, nuvola e increspature dai momenti in cui la polvere esce. */
  prepare(tl) {
    // la versata non dipende da testi, colori o impaginazione: i granelli calcolati una volta restano
    // validi a ogni nuova timeline (cambio prodotto, resize) e non si ricalcolano durante le animazioni
    if (this.grains) return
    this.disposeParticles()
    const s = this.s
    const q = this.ctx.quality
    const g = this.scene.glassInfo
    const samples = sampleTimeline(tl, POUR[0], POUR[1], 360, () => ({
      T: s.T, fill: s.fill, px: s.px, py: s.py, pz: s.pz, yaw: s.yaw, roll: s.roll, pitch: s.pitch,
    }))
    const f0 = samples[0].fill
    const f1 = samples[samples.length - 1].fill
    const keys = Object.keys(samples[0])
    // stato del misurino quando la polvere e' scesa a una certa frazione (quantile 0..1).
    // Dentro emit() u cresce sempre: la ricerca riparte dal campione trovato per il granello prima
    // (stesso risultato della scansione da capo, senza ripercorrere 360 campioni per ognuno dei
    // ~30.000 granelli: era il blocco piu' lungo della preparazione della sezione)
    let cursor = 0
    const state = {} // riusato per ogni granello (niente oggetti nuovi a ogni chiamata)
    const at = (u) => {
      const target = f0 - u * (f0 - f1)
      let i = cursor
      while (i < samples.length - 2 && samples[i + 1].fill > target) i++
      cursor = i
      const a = samples[i]
      const b = samples[i + 1]
      const span = a.fill - b.fill
      const f = span > 1e-6 ? clamp01((a.fill - target) / span) : 0
      for (const k of keys) state[k] = a[k] + (b[k] - a[k]) * f
      return state
    }

    const rnd = random(7)
    const euler = new THREE.Euler(0, 0, 0, 'YZX')
    const quat = new THREE.Quaternion()
    const A = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const tan = new THREE.Vector3()
    const down = new THREE.Vector3(0, -1, 0)
    const rimR = this.dim.riTop
    const impacts = []

    const emit = (count, kind) => {
      const start = new Float32Array(count * 3)
      const vel = new Float32Array(count * 3)
      const seed = new Float32Array(count * 4)
      const release = new Float32Array(count)
      const size = new Float32Array(count)
      const p0 = new THREE.Vector3()
      const v0 = new THREE.Vector3()
      const hit = new THREE.Vector3()
      cursor = 0
      for (let i = 0; i < count; i++) {
        // quantile: piu' denso a meta' versata, con un piccolo sbuffo iniziale di polvere fine
        let u = (i + rnd()) / count
        if (kind === 'dust') u = Math.pow(u, 1.4)
        const st = at(u)
        euler.set(st.roll * DEG, st.yaw * DEG, st.pitch * DEG, 'YZX')
        quat.setFromEuler(euler)
        A.set(0, 1, 0).applyQuaternion(quat)
        dir.copy(down).addScaledVector(A, -A.dot(down))
        if (dir.lengthSq() < 1e-8) dir.set(0, 0, 1)
        dir.normalize()
        tan.crossVectors(A, dir).normalize()
        // la polvere scivola fuori da un tratto stretto del labbro: un nastro compatto
        const spread = kind === 'dust' ? 0.9 : kind === 'veil' ? 0.5 : 0.42
        const delta = (rnd() + rnd() - 1) * spread
        const rr = rimR * (0.94 + 0.05 * rnd())
        p0.set(st.px, st.py, st.pz)
          .addScaledVector(dir, Math.cos(delta) * rr)
          .addScaledVector(tan, Math.sin(delta) * rr)
          .addScaledVector(A, -0.0012 * rnd())
        const speed = kind === 'dust' ? 0.01 + 0.016 * rnd() : 0.016 + 0.022 * rnd()
        v0.copy(A).multiplyScalar(0.45).addScaledVector(dir, 0.9).normalize().multiplyScalar(speed)
        const jitter = kind === 'dust' ? 0.008 : 0.003
        v0.x += (rnd() - 0.5) * jitter
        v0.z += (rnd() - 0.5) * jitter
        start[i * 3] = p0.x
        start[i * 3 + 1] = p0.y
        start[i * 3 + 2] = p0.z
        vel[i * 3] = v0.x
        vel[i * 3 + 1] = v0.y
        vel[i * 3 + 2] = v0.z
        for (let k = 0; k < 4; k++) seed[i * 4 + k] = rnd()
        release[i] = st.T
        size[i] =
          kind === 'dust' ? 0.0004 + 0.0008 * rnd()
          : kind === 'veil' ? 0.0016 + 0.0024 * rnd()
          : 0.0002 + 0.00034 * rnd() * rnd()
        if (kind === 'grain') {
          const th = hitTime(p0, v0, g.waterY, G, DRAG.grain)
          fall(th, p0, v0, G, DRAG.grain, hit)
          impacts.push({ T: st.T + th, x: hit.x, z: hit.z })
        }
      }
      return particleGeometry({ start, vel, seed, release, size })
    }

    const nGrain = Math.round(22000 * q.particles)
    const nDust = Math.round(4000 * q.particles)
    const nVeil = Math.round(2600 * Math.max(0.5, q.particles))
    const grainGeo = emit(nGrain, 'grain')
    const dustGeo = emit(nDust, 'dust')
    const veilGeo = emit(nVeil, 'veil')

    const u = this.scene.u
    const common = (drag, extra) => ({
      uT: { value: 0 },
      uTime: u.uTime,
      uWaterY: u.uWaterY,
      uRIn: u.uRIn,
      uBase: u.uBase,
      uGravity: { value: G },
      uDrag: { value: drag },
      uRaft: { value: 0.55 },
      uSwirl: { value: 0.32 },
      uSink: { value: 0.0042 },
      uSpread: { value: 0.0055 },
      uDissolve: { value: new THREE.Vector2(1.6, 4.6) },
      uResidue: { value: 0.012 },
      uOpacity: { value: 1 },
      uLive: { value: this.ctx.reduced ? 0 : 1 },
      uColor: { value: new THREE.Color(0xf4f2ec) },
      uColorWet: { value: new THREE.Color(0x9a9894) },
      ...extra,
    })
    this.grains = addParticles(this.scene, grainGeo, common(DRAG.grain, { uFlutter: { value: 0.0012 } }))
    this.dust = addParticles(
      this.scene,
      dustGeo,
      common(DRAG.dust, { uFlutter: { value: 0.012 }, uOpacity: { value: 0.32 }, uDissolve: { value: new THREE.Vector2(0.8, 2.4) } }),
      { renderOrder: 61 },
    )
    // velo: sprite grandi e quasi trasparenti lungo le stesse traiettorie, il filo diventa continuo
    this.veil = addParticles(
      this.scene,
      veilGeo,
      common(DRAG.grain, { uFlutter: { value: 0.002 }, uOpacity: { value: 0.07 }, uDissolve: { value: new THREE.Vector2(1.2, 3.2) } }),
      { renderOrder: 59 },
    )

    // nuvola lattiginosa: nasce dove i granelli entrano in acqua
    impacts.sort((a, b) => a.T - b.T)
    const nPlume = Math.round(260 * Math.max(0.4, q.particles))
    const pStart = new Float32Array(nPlume * 3)
    const pSeed = new Float32Array(nPlume * 4)
    const pRelease = new Float32Array(nPlume)
    const pSize = new Float32Array(nPlume)
    for (let i = 0; i < nPlume; i++) {
      const im = impacts[Math.floor(rnd() * impacts.length)]
      const a = rnd() * Math.PI * 2
      const r = 0.002 + 0.006 * rnd()
      pStart.set([im.x + Math.cos(a) * r, g.waterY - 0.002 - 0.004 * rnd(), im.z + Math.sin(a) * r], i * 3)
      pSeed.set([rnd(), rnd(), rnd(), rnd()], i * 4)
      pRelease[i] = im.T + 0.05 + 0.25 * rnd()
      pSize[i] = 0.007 + 0.016 * rnd()
    }
    this.plume = addParticles(
      this.scene,
      particleGeometry({ start: pStart, seed: pSeed, release: pRelease, size: pSize }),
      {
        uT: { value: 0 },
        uTime: u.uTime,
        uWaterY: u.uWaterY,
        uRIn: u.uRIn,
        uBase: u.uBase,
        uSwirl: { value: 0.22 },
        uSink: { value: 0.0026 },
        uSpread: { value: 0.0045 },
        uDissolve: { value: new THREE.Vector2(2.6, 5.4) },
        uOpacity: { value: 0.12 },
        uGrow: { value: 0.9 },
        uColor: { value: new THREE.Color(0xd9d7d3) },
      },
      { kind: 'plume', above: false, renderOrder: 55 },
    )

    // increspature (quanti granelli cadono adesso) e opalescenza dell'acqua (si scioglie col tempo)
    const T0 = impacts[0]?.T ?? 0
    this.ripple = new Table(0, TOTAL, 320)
    this.cloud = new Table(0, TOTAL, 320)
    let mx = 0
    let mz = 0
    for (const im of impacts) {
      this.ripple.add(im.T, 1)
      mx += im.x
      mz += im.z
    }
    this.impactXZ = new THREE.Vector2(mx / Math.max(1, impacts.length), mz / Math.max(1, impacts.length))
    let peak = 0
    for (let i = 0; i < this.ripple.v.length; i++) peak = Math.max(peak, this.ripple.v[i])
    // morbida nel tempo, normalizzata a 1
    const smoothR = new Float32Array(this.ripple.v.length)
    for (let i = 0; i < smoothR.length; i++) {
      let acc = 0
      let w = 0
      for (let j = -6; j <= 6; j++) {
        const k = i + j
        if (k < 0 || k >= smoothR.length) continue
        const ww = Math.exp(-(j * j) / 18)
        acc += this.ripple.v[k] * ww
        w += ww
      }
      smoothR[i] = acc / w
    }
    peak = Math.max(...smoothR, 1e-6)
    this.ripple.v = smoothR.map((v) => v / peak)
    // opalescenza: somma, su un impatto ogni 4, di (1 - e^(-dt/0.5)) * e^(-dt/tau) =
    // e^(-dt*a) - e^(-dt*b). Le due somme di esponenziali si aggiornano da un istante al successivo
    // (stesso risultato del doppio ciclo istanti x impatti, che costava milioni di esponenziali)
    const tau = 2.4
    const a1 = 1 / tau
    const b1 = 1 / 0.5 + 1 / tau
    let sumA = 0
    let sumB = 0
    let tPrev = 0
    let next = 0
    for (let i = 0; i < this.cloud.v.length; i++) {
      const t = (i / (this.cloud.v.length - 1)) * TOTAL
      sumA *= Math.exp(-(t - tPrev) * a1)
      sumB *= Math.exp(-(t - tPrev) * b1)
      tPrev = t
      for (; next < impacts.length && impacts[next].T < t; next++) {
        if (next % 4) continue
        const dt = t - impacts[next].T
        sumA += Math.exp(-dt * a1)
        sumB += Math.exp(-dt * b1)
      }
      this.cloud.v[i] = sumA - sumB
    }
    const cPeak = Math.max(...this.cloud.v, 1e-6)
    this.cloud.v = this.cloud.v.map((v) => v / cPeak)
    this.firstImpact = T0
  }

  /** Piano della polvere nella coppa: fermo fino all'angolo di riposo, poi scivola verso il labbro. */
  updateHeap() {
    const s = this.s
    const hu = this.heapU
    const q = this._q.copy(this.rig.quaternion).invert()
    const upL = this._up.set(0, 1, 0).applyQuaternion(q) // l'alto del mondo nel sistema della coppa
    const alpha = Math.acos(Math.min(1, Math.max(-1, upL.y)))
    const n = hu.uPlaneN.value
    if (alpha <= REPOSE) {
      n.set(0, 1, 0)
    } else {
      // superficie inclinata di REPOSE rispetto all'orizzontale del mondo
      const t = (alpha - REPOSE) / alpha
      n.set(0, 1, 0).lerp(upL, t).normalize()
    }
    const yBot = -this.dim.depth
    const level = this.dim.level
    const yc = yBot + 0.0004 + (level - yBot - 0.0004) * s.fill
    let d = n.y * yc
    if (alpha > 0.2) {
      // non sopra il labbro (il punto piu' basso del bordo)
      const lip = this._v.set(-upL.x, 0, -upL.z)
      if (lip.lengthSq() > 1e-8) {
        lip.normalize().multiplyScalar(this.dim.riTop)
        d = Math.min(d, n.dot(lip) - 0.0002)
      }
    }
    hu.uPlaneD.value = d
    hu.uResidual.value = smooth(0.14, 0.035, s.fill)
    // la grana scorre verso il labbro mentre la polvere esce
    hu.uFlow.value.set(-upL.x, 0, -upL.z).multiplyScalar((1 - s.fill) * 0.012)
  }

  update(time, dt) {
    const s = this.s
    const u = this.scene.u
    this.rig.position.set(s.px, s.py, s.pz)
    this.rig.rotation.set(s.roll * DEG, s.yaw * DEG, s.pitch * DEG, 'YZX')
    this.rig.updateMatrixWorld(true)
    this.updateHeap()

    for (const sys of [this.grains, this.dust, this.veil, this.plume]) {
      if (sys) sys.uniforms.uT.value = s.T
    }

    const amp = this.ripple ? this.ripple.at(s.T) : 0
    u.uRipples.value[0].set(this.impactXZ?.x ?? 0, this.impactXZ?.y ?? 0, 0, amp * 0.0015)
    u.uRipple.value = amp * 0.8
    const cloud = this.cloud ? this.cloud.at(s.T) : 0
    u.uCloud.value = cloud * 0.1
    u.uCaustic.value = 0.1 * (1 - 0.6 * cloud)
    u.uGlassRot.value = s.glassRot * DEG

    // punti a cui si agganciano le etichette: bordo del misurino e pelo dell'acqua; le sagome
    // (coppa del misurino, bicchiere) da cui la linea deve uscire
    this.anchors.dose.set(0, 0, -this.dim.riTop).applyMatrix4(this.rig.matrixWorld)
    const g = this.scene.glassInfo
    this.anchors.water.set(g.rIn * 0.7, g.waterY, g.rIn * 0.55)
    this.bodies.dose.center.set(0, -this.dim.depth * 0.5, 0).applyMatrix4(this.rig.matrixWorld)
    this.bodies.dose.radius = this.dim.riTop * 1.15
    this.bodies.water.center.set(0, g.waterY, 0)
    this.bodies.water.radius = g.rOut
  }

  /** Dopo l'aggiornamento della camera: dimensione delle particelle in pixel. */
  updateView() {
    for (const sys of [this.grains, this.dust, this.veil, this.plume]) {
      if (sys) updatePixelScale(sys, this.scene)
    }
  }

  setTheme(theme) {
    // polvere bianca con un velo del colore del prodotto (resta realistica)
    const tint = new THREE.Color(theme.powder ?? '#ffffff')
    this.powderMat?.color.set(0xefebe4).lerp(tint, 0.06)
    for (const sys of [this.grains, this.dust, this.veil]) {
      sys?.uniforms.uColor.value.set(0xf6f4ef).lerp(tint, 0.05)
    }
  }

  disposeParticles() {
    for (const k of ['grains', 'dust', 'veil', 'plume']) {
      if (this[k]) disposeParticles(this[k], this.scene)
      this[k] = null
    }
  }

  dispose() {
    this.disposeParticles()
    this.rig?.parent?.remove(this.rig)
    this.scoopMat?.dispose()
    this.powderMat?.dispose()
    const u = this.scene.u
    u.uCloud.value = 0
    u.uRipple.value = 0
    for (const r of u.uRipples.value) r.set(0, 0, 0, 0)
  }
}
