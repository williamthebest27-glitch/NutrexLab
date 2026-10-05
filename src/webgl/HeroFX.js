import * as THREE from 'three'
import { mixColor } from './color.js'

/*
  Effetti della hero, nello spazio del barattolo (origine = centro del barattolo, metri).
  Le posizioni sono ricavate dal riferimento (1 m ~ 3700 px a 1536x1024):
  - nastro di liquido rosa satinato: entra dall'alto a sinistra del tappo, passa dietro
    al barattolo ed esce a destra verso il bordo dello schermo
  - gocce lucide sparse (piu' fitte a sinistra) e alcune sopra al sipario in basso a destra
  - due nuvole di polvere ai lati del barattolo, che "esplodono" al suo arrivo
  intro.reveal / intro.burst arrivano dall'animazione d'ingresso, heroOut dallo scroll.
  I titoli sono nel DOM davanti al canvas: gli effetti non li coprono mai.
  I colori arrivano dal tema del prodotto (products.js) e sfumano al cambio prodotto.
*/

const RIBBON_POINTS = [
  [-0.074, 0.25, -0.05], // fuori dallo schermo anche sul mobile: non si vede l'inizio del nastro
  [-0.071, 0.2, -0.05],
  [-0.068, 0.15, -0.05],
  [-0.061, 0.105, -0.05],
  [-0.04, 0.066, -0.06],
  [-0.004, 0.032, -0.066],
  [0.039, 0.006, -0.06],
  [0.084, -0.03, -0.042],
  [0.146, -0.074, -0.02],
  [0.207, -0.106, 0.0],
  [0.27, -0.13, 0.012],
]

function ribbonGeometry() {
  const curve = new THREE.CatmullRomCurve3(RIBBON_POINTS.map((p) => new THREE.Vector3(...p)), false, 'centripetal')
  const N = 300
  const M = 18
  const frames = curve.computeFrenetFrames(N, false)
  const pos = []
  const center = []
  const u = []
  const edges = []
  const idx = []
  const P = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const bend = new THREE.Vector3()
  for (let i = 0; i <= N; i++) {
    const t = i / N
    curve.getPointAt(t, P)
    const T = frames.tangents[i]
    const Nn = frames.normals[i]
    const B = frames.binormals[i]
    // nastro piatto che si avvita lentamente (mostra entrambe le facce)
    const twist = 0.9 + t * Math.PI * 1.5 + Math.sin(t * 6.5) * 0.45
    dir.copy(Nn).multiplyScalar(Math.cos(twist)).addScaledVector(B, Math.sin(twist))
    bend.crossVectors(T, dir).normalize()
    const width = 0.034 + 0.018 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.004 * Math.sin(t * 11)
    for (let j = 0; j <= M; j++) {
      const s = j / M - 0.5
      const cup = (s * s - 1 / 12) * width * 0.22
      pos.push(
        P.x + dir.x * s * width + bend.x * cup,
        P.y + dir.y * s * width + bend.y * cup,
        P.z + dir.z * s * width + bend.z * cup,
      )
      center.push(P.x, P.y, P.z)
      u.push(t)
      // bordi piu' chiari, come un liquido sottile in controluce (colore calcolato nello shader)
      edges.push(Math.pow(Math.abs(s) * 2, 4) * 0.45)
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j
      const b = a + M + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(center, 3))
  g.setAttribute('aU', new THREE.Float32BufferAttribute(u, 1))
  g.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// gocce: [x, y, z, raggio]
const DROPS = [
  // a sinistra del barattolo
  [-0.0635, 0.046, 0.01, 0.0031],
  [-0.0997, 0.022, 0.0, 0.0021],
  [-0.103, -0.015, 0.012, 0.0029],
  [-0.0907, -0.0448, 0.0, 0.0026],
  [-0.077, -0.032, 0.022, 0.0015],
  [-0.086, 0.0, 0.024, 0.0011],
  [-0.052, -0.06, 0.03, 0.0013],
  // lungo il nastro, in alto (lontano dalle voci del menu)
  [-0.062, 0.074, -0.03, 0.0013],
  // a destra
  [0.088, -0.052, 0.0, 0.0022],
  [0.116, -0.086, 0.012, 0.0034],
  [0.072, 0.068, -0.02, 0.0017],
  [0.132, -0.03, -0.01, 0.0014],
  // in basso a destra, sopra al sipario
  [0.091, -0.132, 0.02, 0.004],
  [0.152, -0.143, 0.0, 0.0034],
  [0.121, -0.163, 0.01, 0.0017],
]

const powderVertex = /* glsl */ `
uniform float uBurst;
uniform float uFade;
uniform float uTime;
uniform float uScale;
uniform vec3 uPal[5];
attribute vec4 aSeed; // x casuale, y dimensione (m), z tipo (0 granello, 1 nuvola), w fase
attribute float aPick; // indice del colore nella palette del tema
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
void main() {
  float b = 1.0 - pow(1.0 - clamp(uBurst, 0.0, 1.0), 3.0);
  vec3 p = position * mix(0.12, 1.0, b);
  p += vec3(sin(uTime * 0.21 + aSeed.w * 6.28), cos(uTime * 0.17 + aSeed.w * 4.7), sin(uTime * 0.13 + aSeed.w * 3.1))
       * 0.003 * (0.4 + aSeed.x);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uScale * aSeed.y / -mv.z;
  vColor = uPal[int(aPick + 0.5)];
  vSoft = aSeed.z;
  vAlpha = uFade * smoothstep(0.0, 0.18, uBurst) * (aSeed.z > 0.5 ? 0.1 : 0.85);
}
`

const powderFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = vSoft > 0.5 ? smoothstep(0.5, 0.0, d) : smoothstep(0.5, 0.2, d);
  a *= vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a, a);
  #include <colorspace_fragment>
}
`

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5
}

export class HeroFX {
  constructor(stage, { quality = 'high', theme } = {}) {
    this.stage = stage
    this.group = new THREE.Group()
    stage.scene.add(this.group)
    this.intro = { reveal: 0, burst: 0 }

    // ---------------------------------------------------------------- nastro
    this.ribbonU = {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uTail: { value: 0 },
      uCA: { value: new THREE.Color() },
      uCB: { value: new THREE.Color() },
      uCC: { value: new THREE.Color() },
    }
    const mat = (this.ribbonMat = new THREE.MeshPhysicalMaterial({
      roughness: 0.3,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.12,
      sheen: 1,
      sheenColor: new THREE.Color('#ffd9ea'),
      sheenRoughness: 0.4,
      emissive: new THREE.Color('#1c0610'),
      envMapIntensity: 1.05,
      side: THREE.DoubleSide,
    }))
    const ru = this.ribbonU
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, ru)
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float aU;\nattribute float aEdge;\nattribute vec3 aCenter;\nuniform float uTime;\nuniform float uReveal;\nuniform float uTail;\nuniform vec3 uCA;\nuniform vec3 uCB;\nuniform vec3 uCC;\nvarying float vU;\nvarying vec3 vRib;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float taper = smoothstep(uReveal + 0.0001, uReveal - 0.07, aU) * smoothstep(uTail - 0.0001, uTail + 0.07, aU);
          transformed = mix(aCenter, transformed, taper);
          transformed += objectNormal * (sin(aU * 30.0 - uTime * 1.1) * 0.0014 + sin(aU * 11.0 + uTime * 0.6) * 0.002);
          vU = aU;
          vRib = aU < 0.5 ? mix(uCA, uCB, aU / 0.5) : mix(uCB, uCC, (aU - 0.5) / 0.5);
          vRib += (1.0 - vRib) * aEdge;`,
        )
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uReveal;\nuniform float uTail;\nvarying float vU;\nvarying vec3 vRib;')
        .replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nif (vU > uReveal || vU < uTail) discard;',
        )
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vRib;')
    }
    mat.customProgramCacheKey = () => 'hero-ribbon-v3'
    this.ribbon = new THREE.Mesh(ribbonGeometry(), mat)
    this.ribbon.renderOrder = -2
    this.group.add(this.ribbon)

    // ---------------------------------------------------------------- gocce
    const dropMat = (this.dropMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dc86ac'),
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      sheen: 0.5,
      sheenColor: new THREE.Color('#ffe2ee'),
      emissive: new THREE.Color('#22060f'),
      envMapIntensity: 1.5,
    }))
    this.dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), dropMat, DROPS.length)
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.group.add(this.dropMesh)
    this._m = new THREE.Matrix4()
    this._q = new THREE.Quaternion()
    this._v = new THREE.Vector3()
    this._s = new THREE.Vector3()

    // ---------------------------------------------------------------- polvere
    const count = quality === 'low' ? 1600 : 3200
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count * 4)
    const picks = new Float32Array(count)
    const lobes = [
      { c: [-0.08, 0.008, -0.02], r: [0.026, 0.034, 0.02], w: 0.44 }, // nuvola a sinistra
      { c: [0.066, 0.025, -0.04], r: [0.014, 0.02, 0.015], w: 0.17 }, // a destra del tappo
      { c: [-0.045, 0.06, -0.03], r: [0.018, 0.026, 0.02], w: 0.17 }, // spruzzo lungo il tappo
      { c: [0.0, -0.01, -0.03], r: [0.13, 0.1, 0.05], w: 0.22 }, // pulviscolo intorno
    ]
    for (let i = 0; i < count; i++) {
      let pick = Math.random()
      let L = lobes[lobes.length - 1]
      for (const l of lobes) {
        if (pick < l.w) {
          L = l
          break
        }
        pick -= l.w
      }
      pos.set([L.c[0] + gauss() * L.r[0], L.c[1] + gauss() * L.r[1], L.c[2] + gauss() * L.r[2]], i * 3)
      const puff = Math.random() < 0.06
      seed.set([Math.random(), puff ? 0.004 + Math.random() * 0.007 : 0.0005 + Math.random() * 0.0008, puff ? 1 : 0, Math.random()], i * 4)
      picks[i] = Math.floor(Math.random() * 5)
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    pg.setAttribute('aPick', new THREE.BufferAttribute(picks, 1))
    this.powderU = {
      uBurst: { value: 0 },
      uFade: { value: 1 },
      uTime: { value: 0 },
      uScale: { value: 1 },
      uPal: { value: Array.from({ length: 5 }, () => new THREE.Color()) },
    }
    this.powder = new THREE.Points(
      pg,
      new THREE.ShaderMaterial({
        uniforms: this.powderU,
        vertexShader: powderVertex,
        fragmentShader: powderFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    )
    this.powder.frustumCulled = false
    this.powder.renderOrder = 1
    this.group.add(this.powder)

    if (theme) this.setTheme(theme)
  }

  /** Colori di nastro, gocce e polvere: tema a sfumato verso il tema b (k 0..1). */
  setTheme(a, b = a, k = 1) {
    const ru = this.ribbonU
    mixColor(ru.uCA.value, a.ribbon[0], b.ribbon[0], k)
    mixColor(ru.uCB.value, a.ribbon[1], b.ribbon[1], k)
    mixColor(ru.uCC.value, a.ribbon[2], b.ribbon[2], k)
    mixColor(this.ribbonMat.sheenColor, a.ribbonSheen, b.ribbonSheen, k)
    mixColor(this.ribbonMat.emissive, a.ribbonEmissive, b.ribbonEmissive, k)
    mixColor(this.dropMat.color, a.drop, b.drop, k)
    mixColor(this.dropMat.sheenColor, a.dropSheen, b.dropSheen, k)
    mixColor(this.dropMat.emissive, a.dropEmissive, b.dropEmissive, k)
    this.powderU.uPal.value.forEach((c, i) => mixColor(c, a.powder[i], b.powder[i], k))
  }

  /**
   * Gli effetti sono disegnati attorno al barattolo del collagene (alto 0.122 m): con un barattolo
   * piu' piccolo la camera si avvicina, quindi nastro, gocce e polvere vanno scalati come lui.
   */
  setScale(s) {
    this.scale = s
    this.group.scale.setScalar(s)
    if (this._pointScale) this.powderU.uScale.value = this._pointScale * s
  }

  resize(bufferHeight, fovDeg) {
    this._pointScale = bufferHeight / (2 * Math.tan((fovDeg * Math.PI) / 360))
    this.powderU.uScale.value = this._pointScale * (this.scale ?? 1)
  }

  update(time, out) {
    const vis = out < 0.999
    this.group.visible = vis
    if (!vis) return
    const { reveal, burst } = this.intro
    // con lo scroll il nastro si ritira da entrambe le estremita' verso il centro, dietro al barattolo
    const pull = Math.min(1, out * 1.6)
    this.ribbonU.uTime.value = time
    this.ribbonU.uReveal.value = Math.min(reveal, 1 - pull * 0.56)
    this.ribbonU.uTail.value = pull * 0.48
    this.powderU.uTime.value = time
    this.powderU.uBurst.value = burst
    this.powderU.uFade.value = 1 - Math.min(1, out * 2.2)

    const b = 1 - Math.pow(1 - Math.min(1, burst), 3)
    const fade = 1 - Math.min(1, out * 1.8)
    for (let i = 0; i < DROPS.length; i++) {
      const [x, y, z, r0] = DROPS[i]
      const k = 0.25 + 0.75 * b
      this._v.set(x * k + Math.sin(time * 0.6 + i) * 0.0012, y * k + Math.cos(time * 0.5 + i * 1.7) * 0.0016, z * k)
      const r = Math.max(1e-6, r0 * b * fade)
      this._s.set(r, r, r)
      this._m.compose(this._v, this._q, this._s)
      this.dropMesh.setMatrixAt(i, this._m)
    }
    this.dropMesh.instanceMatrix.needsUpdate = true
  }
}
