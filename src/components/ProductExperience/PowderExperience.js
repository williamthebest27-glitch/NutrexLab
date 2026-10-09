import * as THREE from 'three'
import { loadModel, findMesh } from './assets.js'
import { NOISE } from './shaders/chunks.js'
import { Table, addParticles, updatePixelScale, disposeParticles, particleGeometry, DEG, smooth } from './kit.js'
import { sampleKeys } from './ScrollAnimation.js'
import { computePour } from './powderPour.js'

/*
  POLVERE: misurino + polvere a raso -> si avvicina al bicchiere, ruota, si inclina, la polvere cade
  in un filo sottile, entra nell'acqua, galleggia un istante, scende in una nuvola lattiginosa
  che si scioglie. Il misurino si allontana e il bicchiere resta solo.

  Tutto e' funzione del progresso della timeline (scroll): il cumulo nel misurino e' una superficie
  calcolata nel vertex shader (piano della polvere dentro la coppa conica), i granelli sono
  particelle deterministiche (shaders/particles.js) con i punti di partenza calcolati dalle chiavi
  della coreografia nei momenti in cui il misurino li lascia cadere (powderPour.js, in un worker).
*/

const TOTAL = 16            // secondi del "racconto" lungo tutta la sezione
const G = 0.55              // gravita' al rallentatore (m/s^2 del racconto)
const DRAG = { grain: 1.25, dust: 3.4 }
const REPOSE = 34 * DEG     // angolo di riposo della polvere
const POUR = [0.6, 0.9]     // finestra della timeline in cui la polvere esce
const POOL_EDGE = 2.1       // fin dove la pozza di luce sul piano si vede chiara (in raggi della pozza)
const FINAL = 0.86          // da qui la camera si allontana e resta il bicchiere solo (vedi CAMERA)

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
    { at: 1.0, ty: 0.078, dist: 1.0, az: 2, el: 7, sx: 0.24, ease: 'power2.inOut' }, // bicchiere a destra, titolo a sinistra
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

/** Tempo del racconto: scorre uniforme lungo tutta la sezione. */
const STORY = [{ at: 0, T: 0 }, { at: 1, T: TOTAL, ease: 'none' }]

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
    for (const key of ['b1', 'b2', 'b3']) {
      this.anchors[key] = new THREE.Vector3()
      this.bodies[key] = { center: new THREE.Vector3(), radius: 0 }
    }
    // a destra c'e' il manico del misurino; sul telefono sopra, dove lo schermo e' libero. I benefici,
    // alla fine: sopra il bicchiere, a sinistra sotto l'etichetta dell'acqua e a destra (sul
    // telefono la riga con i tre benefici sopra il bicchiere)
    this.pinSides = { dose: 'left', b1: 'above', b2: 'left', b3: 'right', mobile: { dose: 'above', b1: 'above' } }
    this.layout = 'desktop'
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
    this.layout = layout // (sul telefono i benefici partono dal bordo sinistro della bocca)
    return [
      { target: this.s, keys: STORY },
      // il bicchiere gira piano su se stesso per tutta la sezione (il logo inciso scorre)
      { target: this.s, keys: [{ at: 0, glassRot: -14 }, { at: 1, glassRot: 26, ease: 'none' }] },
      { target: this.s, keys: SCOOP },
      { target: this.s, keys: FILL },
      { target: 'camera', keys: CAMERA[layout === 'mobile' ? 'mobile' : 'desktop'] },
    ]
  }

  /**
   * Granelli, nuvola e increspature dai momenti in cui la polvere esce. Il calcolo (~30.000
   * granelli) gira in un worker (powderPour.js): la pagina continua a scorrere. Non dipende da testi,
   * colori o impaginazione: si fa una volta sola e resta valido a ogni nuova timeline.
   */
  prepareAsync() {
    this._pour ??= computePourOffThread(this.pourInput()).then((data) => {
      if (!this.disposed) this.applyPour(data)
    })
    return this._pour
  }

  /** Stato del misurino durante la versata (dalle chiavi, come la timeline) e misure della scena. */
  pourInput() {
    const n = 360
    const samples = []
    for (let i = 0; i <= n; i++) {
      const p = POUR[0] + ((POUR[1] - POUR[0]) * i) / n
      const st = sampleKeys(STORY, p)
      sampleKeys(SCOOP, p, st)
      sampleKeys(FILL, p, st)
      samples.push(st)
    }
    const k = this.ctx.quality.particles
    return {
      samples,
      rimR: this.dim.riTop,
      waterY: this.scene.glassInfo.waterY,
      total: TOTAL,
      gravity: G,
      drag: DRAG,
      counts: {
        grain: Math.round(22000 * k),
        dust: Math.round(4000 * k),
        veil: Math.round(2600 * Math.max(0.5, k)),
        plume: Math.round(260 * Math.max(0.4, k)),
      },
    }
  }

  /** Sistemi di particelle e tabelle dal calcolo della versata. */
  applyPour(data) {
    this.disposeParticles()
    const u = this.scene.u
    const common = (drag, extra) => ({
      uT: { value: 0 },
      uTime: u.uTime,
      uWaterY: u.uWaterY,
      uRIn: u.uRIn,
      uTaper: u.uTaper,
      uBase: u.uBase,
      uHeight: u.uHeight,
      uGlassInside: u.uGlassInside,
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
    this.grains = addParticles(this.scene, particleGeometry(data.grain), common(DRAG.grain, { uFlutter: { value: 0.0012 } }))
    this.dust = addParticles(
      this.scene,
      particleGeometry(data.dust),
      common(DRAG.dust, { uFlutter: { value: 0.012 }, uOpacity: { value: 0.32 }, uDissolve: { value: new THREE.Vector2(0.8, 2.4) } }),
      { renderOrder: 61 },
    )
    // velo: sprite grandi e quasi trasparenti lungo le stesse traiettorie, il filo diventa continuo
    this.veil = addParticles(
      this.scene,
      particleGeometry(data.veil),
      common(DRAG.grain, { uFlutter: { value: 0.002 }, uOpacity: { value: 0.07 }, uDissolve: { value: new THREE.Vector2(1.2, 3.2) } }),
      { renderOrder: 59 },
    )
    // nuvola lattiginosa: nasce dove i granelli entrano in acqua
    this.plume = addParticles(
      this.scene,
      particleGeometry(data.plume),
      {
        uT: { value: 0 },
        uTime: u.uTime,
        uWaterY: u.uWaterY,
        uRIn: u.uRIn,
        uTaper: u.uTaper,
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
    this.ripple = new Table(0, TOTAL, data.ripple.length)
    this.ripple.v = data.ripple
    this.cloud = new Table(0, TOTAL, data.cloud.length)
    this.cloud.v = data.cloud
    this.impactXZ = new THREE.Vector2(data.impactXZ[0], data.impactXZ[1])
    this.firstImpact = data.firstImpact
    if (this.theme) this.setTheme(this.theme)
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

    // punti a cui si agganciano le etichette: bordo del misurino e, per l'acqua, il bordo del
    // bicchiere davanti a destra (non il pelo dell'acqua, piu' basso: la scritta resta staccata dal
    // beneficio a destra, che non puo' scendere sulla pozza di luce); le sagome (coppa del misurino,
    // bicchiere) da cui la linea deve uscire. La sagoma del bicchiere resta centrata sull'acqua: e'
    // anche un ostacolo per le altre etichette, piu' in alto toglieva al beneficio sopra il bicchiere
    // lo spazio per entrare
    this.anchors.dose.set(0, 0, -this.dim.riTop).applyMatrix4(this.rig.matrixWorld)
    const g = this.scene.glassInfo
    this.anchors.water.set(g.rIn * 0.7, g.height, g.rIn * 0.55)
    this.bodies.dose.center.set(0, -this.dim.depth * 0.5, 0).applyMatrix4(this.rig.matrixWorld)
    this.bodies.dose.radius = this.dim.riTop * 1.15
    this.bodies.water.center.set(0, g.waterY, 0)
    this.bodies.water.radius = g.rOut
    // benefici: sopra, dal bordo dietro della bocca (il punto piu' alto del bicchiere sullo schermo;
    // sul telefono dal bordo sinistro, cosi' la linea non attraversa l'etichetta dell'acqua, sopra
    // anche lei); di lato sul bordo del bicchiere (piu' stretto in basso), a sinistra vicino al fondo
    // (sotto l'etichetta dell'acqua) e a destra a meta' altezza (sotto l'acqua, se la sua etichetta e' li')
    if (this.layout === 'mobile') this.anchors.b1.set(-g.rOut, g.height, 0)
    else this.anchors.b1.set(0, g.height, -g.rOut)
    this.bodies.b1.center.copy(this.anchors.b1)
    this.bodies.b1.radius = 0
    for (const [key, y, dir] of [['b2', g.height * 0.16, -1], ['b3', g.height * 0.5, 1]]) {
      const r = g.rBase + (g.rOut - g.rBase) * (y / g.height)
      this.anchors[key].set(dir * r, y, 0)
      this.bodies[key].center.set(0, y, 0)
      this.bodies[key].radius = r
    }
  }

  /**
   * Alla fine (bicchiere solo, etichetta dell'acqua e benefici) le scritte non vanno sulla pozza di
   * luce bianca del piano attorno al bicchiere (centro e raggio come in pe_floor, fin dove si vede
   * chiara): in px, a fasce orizzontali dell'ellisse che fa sullo schermo. Restano sul nero.
   */
  screenObstacles({ w, h }) {
    if (this.s.T / TOTAL < FINAL) return []
    const cam = this.scene.camera
    const R = (this.scene.u?.uPoolR?.value ?? 0.07) * POOL_EDGE
    const v = (this._pv ??= new THREE.Vector3())
    const pts = []
    for (let i = 0; i < 48; i++) {
      const t = (i / 48) * Math.PI * 2
      v.set(Math.cos(t) * R, 0, -0.03 + Math.sin(t) * R).project(cam)
      pts.push([((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h])
    }
    return bands(pts, 6)
  }

  /** Dopo l'aggiornamento della camera: dimensione delle particelle in pixel. */
  updateView() {
    for (const sys of [this.grains, this.dust, this.veil, this.plume]) {
      if (sys) updatePixelScale(sys, this.scene)
    }
  }

  setTheme(theme) {
    this.theme = theme
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
    this.disposed = true
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

/** Un poligono convesso (px) come n rettangoli orizzontali che lo coprono. */
function bands(pts, n) {
  const ys = pts.map((p) => p[1])
  const top = Math.min(...ys)
  const bottom = Math.max(...ys)
  const out = []
  for (let k = 0; k < n; k++) {
    const y0 = top + ((bottom - top) * k) / n
    const y1 = top + ((bottom - top) * (k + 1)) / n
    let l = Infinity
    let r = -Infinity
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]
      const [bx, by] = pts[(i + 1) % pts.length]
      const lo = Math.max(y0, Math.min(ay, by))
      const hi = Math.min(y1, Math.max(ay, by))
      if (lo > hi) continue
      const xs = ay === by ? [ax, bx] : [lo, hi].map((y) => ax + ((bx - ax) * (y - ay)) / (by - ay))
      l = Math.min(l, ...xs)
      r = Math.max(r, ...xs)
    }
    if (l < r) out.push({ l, r, t: y0, b: y1 })
  }
  return out
}

/**
 * Calcola la versata in un worker; se i worker non ci sono (o falliscono) qui, sul thread della
 * pagina: piu' lento, stesso risultato.
 */
function computePourOffThread(input) {
  return new Promise((resolve) => {
    let worker = null
    try {
      worker = new Worker(new URL('./powderPour.worker.js', import.meta.url), { type: 'module' })
    } catch {
      resolve(computePour(input))
      return
    }
    const done = (out) => {
      worker.terminate()
      resolve(out)
    }
    worker.onmessage = (e) => done(e.data)
    worker.onerror = (e) => {
      e.preventDefault()
      done(computePour(input))
    }
    worker.postMessage(input)
  })
}
