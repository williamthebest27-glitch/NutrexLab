import * as THREE from 'three'
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js'
import { NOISE } from './noise.js'

const TAU = Math.PI * 2

const vertexShader = /* glsl */ `
uniform float uP;
uniform float uTime;
uniform float uSpin;
uniform float uTwist;
uniform float uAmbient;
uniform float uScale;
uniform mat4 uHelix;
attribute vec3 aPosB;
attribute vec3 aColorA;
attribute vec3 aColorB;
attribute vec4 aSeed; // x: casuale, y: posizione lungo l'elica, z: tipo (0 superficie, 1 pulviscolo), w: dimensione
varying vec3 vColor;
varying float vAlpha;
${NOISE}

vec3 rotY(vec3 p, float a) {
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  bool dust = aSeed.z > 0.5;
  float start = dust ? aSeed.x * 0.35 : jarNoise(position) * 0.55;
  float t = clamp((uP - start) / 0.45, 0.0, 1.0);
  float te = t * t * (3.0 - 2.0 * t);

  vec3 b = rotY(aPosB, uSpin + aSeed.y * uTwist);
  b = (uHelix * vec4(b, 1.0)).xyz;
  vec3 p = mix(position, b, te);

  float flight = sin(te * 3.14159265);
  vec3 q = position * (9.0 / uJarHeight) * 0.11 + vec3(0.0, uTime * 0.12, 0.0);
  vec3 swirl = vec3(jarValue(q) - 0.5, jarValue(q + 19.7) - 0.5, jarValue(q + 41.3) - 0.5);
  p += swirl * flight * uJarHeight * 1.1;

  if (dust) {
    float ph = aSeed.x * 6.2831;
    p += vec3(sin(uTime * 0.31 + ph), cos(uTime * 0.27 + ph * 1.3), sin(uTime * 0.23 + ph * 0.7)) * uJarHeight * 0.05;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = mix(0.55, 1.0, aSeed.w) * (1.0 + flight * 1.1) * (dust ? 1.7 : 1.0);
  gl_PointSize = uScale * sz / -mv.z;

  vColor = mix(aColorA, aColorB, smoothstep(0.15, 0.85, te));
  float alive = dust ? uAmbient * (0.22 + 0.78 * aSeed.w) : smoothstep(start, start + 0.012, uP);
  vAlpha = alive;
}
`

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.04, d);
  a *= a;
  float alpha = a * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor * alpha * 1.55, alpha);
  #include <colorspace_fragment>
}
`

/**
 * Particelle campionate sulla superficie reale del barattolo (con i colori
 * dell'etichetta), che nella sezione Science formano la tripla elica del collagene.
 * Una serie per prodotto (entry = modello caricato da Stage, con il suo tema colori).
 */
export class Particles {
  constructor(stage, count, entry) {
    this.stage = stage
    this.count = count
    this.entry = entry
  }

  build() {
    const { meshes, model, jarH, product } = this.entry
    const theme = product.theme
    // posizioni nello spazio del pivot (il modello ne e' figlio diretto, anche se non ancora agganciato)
    model.updateWorldMatrix(true, true)
    const parentInv = model.parent ? new THREE.Matrix4().copy(model.parent.matrixWorld).invert() : new THREE.Matrix4()

    // pixel dell'etichetta per colorare le particelle come la grafica reale
    const labelMesh = meshes.find((m) => m.material.name === 'Etichetta')
    const img = labelMesh?.material.map?.image
    let pix = null
    let pw = 0
    let ph = 0
    if (img && img.width) {
      pw = 1024
      ph = Math.max(1, Math.round((1024 * img.height) / img.width))
      const c = document.createElement('canvas')
      c.width = pw
      c.height = ph
      const g = c.getContext('2d', { willReadFrequently: true })
      g.drawImage(img, 0, 0, pw, ph)
      pix = g.getImageData(0, 0, pw, ph).data
    }

    const entries = meshes.map((mesh) => {
      const sampler = new MeshSurfaceSampler(mesh).build()
      const dist = sampler.distribution
      return {
        mesh,
        sampler,
        area: dist[dist.length - 1],
        rel: new THREE.Matrix4().multiplyMatrices(parentInv, mesh.matrixWorld),
        isLabel: mesh === labelMesh,
        color: mesh.material.color.clone(),
      }
    })
    const totalArea = entries.reduce((a, e) => a + e.area, 0)

    const N = this.count
    const nDust = Math.round(N * 0.14)
    const nSurface = N - nDust

    const posA = new Float32Array(N * 3)
    const posB = new Float32Array(N * 3)
    const colA = new Float32Array(N * 3)
    const colB = new Float32Array(N * 3)
    const seed = new Float32Array(N * 4)

    const L = jarH * 2.25 // lunghezza dell'elica
    const R = jarH * 0.19 // raggio dell'elica
    const turns = 4.2
    const strandColors = theme.helix.map((h) => new THREE.Color(h))
    const rungColor = new THREE.Color(theme.rung)
    const dustColor = new THREE.Color(theme.dust).multiplyScalar(0.7)

    const strand = (u, s, out) => {
      const a = u * turns * TAU + (s * TAU) / 3
      return out.set(R * Math.cos(a), u * L, R * Math.sin(a))
    }
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.82

    const p = new THREE.Vector3()
    const n = new THREE.Vector3()
    const uv = new THREE.Vector2()
    const tmpA = new THREE.Vector3()
    const tmpB = new THREE.Vector3()
    const col = new THREE.Color()

    let i = 0
    // superficie del barattolo -> filamenti dell'elica
    for (const e of entries) {
      const share = Math.round((nSurface * e.area) / totalArea)
      for (let k = 0; k < share && i < nSurface; k++, i++) {
        e.sampler.sample(p, n, undefined, uv)
        p.applyMatrix4(e.rel)
        posA.set([p.x, p.y, p.z], i * 3)

        if (e.isLabel && pix) {
          const x = Math.min(pw - 1, Math.max(0, Math.floor(uv.x * pw)))
          const y = Math.min(ph - 1, Math.max(0, Math.floor(uv.y * ph)))
          const o = (y * pw + x) * 4
          col.setRGB(pix[o] / 255, pix[o + 1] / 255, pix[o + 2] / 255, THREE.SRGBColorSpace)
        } else {
          col.copy(e.color)
        }
        colA.set([col.r, col.g, col.b], i * 3)

        const u = Math.random() - 0.5
        const s = Math.floor(Math.random() * 3)
        if (Math.random() < 0.12) {
          strand(u, s, tmpA)
          strand(u, (s + 1) % 3, tmpB)
          tmpA.lerp(tmpB, Math.random())
          tmpA.x += gauss() * R * 0.05
          tmpA.z += gauss() * R * 0.05
          col.copy(rungColor)
        } else {
          strand(u, s, tmpA)
          tmpA.x += gauss() * R * 0.16
          tmpA.y += gauss() * R * 0.16
          tmpA.z += gauss() * R * 0.16
          col.copy(strandColors[s])
        }
        posB.set([tmpA.x, tmpA.y, tmpA.z], i * 3)
        colB.set([col.r, col.g, col.b], i * 3)
        seed.set([Math.random(), u, 0, Math.random()], i * 4)
      }
    }
    const surfaceCount = i

    // pulviscolo: fluttua attorno al barattolo, poi si dispone attorno all'elica
    for (; i < surfaceCount + nDust; i++) {
      const dir = tmpA.randomDirection()
      const r = jarH * (0.75 + Math.random() * 1.5)
      posA.set([dir.x * r * 1.25, dir.y * r * 0.8, dir.z * r], i * 3)
      const a = Math.random() * TAU
      const rr = R * (1.8 + Math.random() * 5)
      const u = Math.random() - 0.5
      posB.set([Math.cos(a) * rr, u * L * 1.25, Math.sin(a) * rr], i * 3)
      colA.set([dustColor.r, dustColor.g, dustColor.b], i * 3)
      colB.set([dustColor.r, dustColor.g, dustColor.b], i * 3)
      seed.set([Math.random(), u, 1, Math.random()], i * 4)
    }

    const count = i
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posA.subarray(0, count * 3), 3))
    geo.setAttribute('aPosB', new THREE.BufferAttribute(posB.subarray(0, count * 3), 3))
    geo.setAttribute('aColorA', new THREE.BufferAttribute(colA.subarray(0, count * 3), 3))
    geo.setAttribute('aColorB', new THREE.BufferAttribute(colB.subarray(0, count * 3), 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, count * 4), 4))

    this.uniforms = {
      uP: { value: 0 },
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uTwist: { value: 0 },
      uAmbient: { value: 0 },
      uScale: { value: 1 },
      uHelix: { value: new THREE.Matrix4() },
      uJarHeight: { value: jarH },
    }
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
    })
    this.points = new THREE.Points(geo, material)
    this.points.frustumCulled = false
    this.points.renderOrder = 2
    this.points.visible = false
    // dimensione legata all'altezza: uguale per barattoli larghi e stretti
    this.worldSize = jarH * 0.0092
  }

  resize(bufferHeight, fovDeg) {
    if (!this.uniforms) return
    const f = bufferHeight / (2 * Math.tan((fovDeg * Math.PI) / 360))
    this.uniforms.uScale.value = this.worldSize * f
  }

  update(time, c, pivotInv, helixWorld) {
    const u = this.uniforms
    u.uTime.value = time
    u.uP.value = c.uP
    u.uAmbient.value = c.ambient
    u.uTwist.value = c.twist
    u.uSpin.value = time * 0.22
    // l'elica mantiene l'orientamento nello spazio anche se il barattolo ruota
    u.uHelix.value.multiplyMatrices(pivotInv, helixWorld)
    this.points.visible = c.uP > 0.002 || c.ambient > 0.004
  }
}
