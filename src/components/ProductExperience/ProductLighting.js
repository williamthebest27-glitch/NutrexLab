import * as THREE from 'three'

/*
  Illuminazione da fotografia pubblicitaria.

  Ambiente (riflessi): uno studio nero con due strisce verticali alte dietro al bicchiere (i bordi del
  vetro si accendono, come nel "dark field" della still life), un softbox morbido dall'alto, la chiave
  davanti a sinistra e un riempimento debolissimo. Viene generato una volta sola con PMREM: niente
  immagini HDR da scaricare.

  Luci per gli oggetti opachi (misurino, polvere, capsula, compressa): chiave morbida, controluce
  che separa i bordi dal fondo (tinta col colore del prodotto) e una luce dall'alto.
*/

const glslFloat = (v) => (Number.isInteger(v) ? `${v}.0` : `${v}`)

/** Define che servono a cube_uv_reflection_fragment per leggere una texture PMREM negli shader propri. */
export function envDefines(texture) {
  const h = texture.image.height
  const maxMip = Math.log2(h) - 2
  return {
    ENVMAP_TYPE_CUBE_UV: '',
    CUBEUV_TEXEL_WIDTH: glslFloat(1 / (3 * Math.max(2 ** maxMip, 7 * 16))),
    CUBEUV_TEXEL_HEIGHT: glslFloat(1 / h),
    CUBEUV_MAX_MIP: glslFloat(maxMip),
  }
}

const roomVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const roomFragment = /* glsl */ `
varying vec3 vDir;
void main() {
  // stanza quasi nera: appena piu' chiara in alto, il pavimento piu' scuro
  float y = vDir.y;
  vec3 c = mix(vec3(0.004, 0.004, 0.005), vec3(0.03, 0.03, 0.034), smoothstep(-0.2, 0.9, y));
  gl_FragColor = vec4(c, 1.0);
}
`

/** Lato delle facce del cubo dell'ambiente (PMREM). */
const ENV_SIZE = 256

export class ProductLighting {
  constructor(renderer) {
    this.renderer = renderer
    this.rigs = []
    this.studio = this.buildStudio()
    this.pmrem = new THREE.PMREMGenerator(renderer)
  }

  /** Lo studio che si riflette nel vetro: stanza quasi nera e pannelli luminosi. */
  buildStudio() {
    const scene = new THREE.Scene()
    const disposables = []
    const room = new THREE.Mesh(
      new THREE.SphereGeometry(10, 48, 24),
      new THREE.ShaderMaterial({ vertexShader: roomVertex, fragmentShader: roomFragment, side: THREE.BackSide }),
    )
    scene.add(room)
    disposables.push(room.geometry, room.material)

    const panel = (w, h, intensity, color, pos, look) => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color).multiplyScalar(intensity),
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
      mesh.position.set(...pos)
      mesh.lookAt(...look)
      scene.add(mesh)
      disposables.push(mesh.geometry, mat)
      return mesh
    }
    // strisce verticali alte dietro al bicchiere (bordi luminosi del vetro)
    panel(0.34, 5.2, 11, '#fffaf3', [-2.7, 1.2, -2.3], [0, 0.6, 0])
    panel(0.34, 5.2, 11, '#f3f7ff', [2.7, 1.2, -2.3], [0, 0.6, 0])
    // softbox dall'alto
    panel(2.8, 2.8, 2.4, '#ffffff', [0, 4.2, 0.4], [0, 0, 0])
    // pannello basso e largo dietro: la superficie dell'acqua lo riflette come una lama di luce
    panel(5.0, 0.8, 0.5, '#ffffff', [0, 0.55, -3.4], [0, 0.4, 0])
    // chiave morbida di lato, davanti a sinistra (modella il bianco del misurino)
    panel(1.8, 2.4, 2.6, '#fff3e8', [-3.4, 1.5, 1.6], [0, 0.3, 0])
    // riempimento debolissimo a destra
    panel(1.8, 1.8, 0.4, '#eef3ff', [3.2, 0.9, 2.8], [0, 0.4, 0])
    return { scene, disposables }
  }

  /**
   * Compila in anticipo, in parallelo e senza fermare la pagina (KHR_parallel_shader_compile), i
   * programmi che servono a generare l'ambiente: poi build() e' solo disegno. Senza, build() li
   * compila in modo sincrono e la pagina resta ferma (decine di ms, di piu' su un telefono).
   * pause (facoltativa): attesa tra i due gruppi di programmi (prepararli costa qualche ms di
   * JavaScript, decine su un telefono).
   */
  async precompile(pause = null) {
    const r = this.renderer
    const extra = new THREE.Scene()
    // fondo della generazione: PMREMGenerator usa un suo MeshBasicMaterial sul retro, stesso programma
    this.bg = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false }))
    extra.add(this.bg)
    // filtro GGX della generazione: interno a PMREMGenerator (three r186). Se un giorno cambia, si
    // salta e build() lo compila da sola
    const p = this.pmrem
    if (typeof p._setSize === 'function' && typeof p._allocateTargets === 'function') {
      p._setSize(ENV_SIZE)
      p._allocateTargets().dispose()
      if (p._ggxMaterial && p._lodMeshes?.[1]) extra.add(new THREE.Mesh(p._lodMeshes[1].geometry, p._ggxMaterial))
    }
    // (con un render target come destinazione: stesse varianti dei programmi della generazione)
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
    const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 30)
    const compile = (scene) => {
      r.setRenderTarget(target)
      const job = r.compileAsync(scene, camera)
      r.setRenderTarget(null)
      return job
    }
    const jobs = [compile(this.studio.scene)]
    if (pause) await pause()
    jobs.push(compile(extra))
    await Promise.all(jobs)
    target.dispose()
  }

  /** Genera l'ambiente (PMREM): texture dei riflessi e define per gli shader propri. */
  build() {
    const target = this.pmrem.fromScene(this.studio.scene, 0, 0.1, 30, { size: ENV_SIZE, position: new THREE.Vector3(0, 0.06, 0) })
    this.releaseStudio()
    this.envTarget = target
    this.envTexture = target.texture
    this.defines = envDefines(this.envTexture)
  }

  /** Lo studio serve solo a generare l'ambiente. */
  releaseStudio() {
    this.pmrem?.dispose()
    this.pmrem = null
    for (const d of this.studio?.disposables ?? []) d.dispose()
    this.studio = null
    if (this.bg) {
      this.bg.geometry.dispose()
      this.bg.material.dispose()
      this.bg = null
    }
  }

  /** Luci per gli oggetti opachi di una scena (una copia per ogni strato di rendering). */
  rig(scene) {
    const key = new THREE.DirectionalLight(0xfff2e6, 1.8)
    key.position.set(-2.4, 1.9, 1.3)
    const top = new THREE.DirectionalLight(0xffffff, 0.45)
    top.position.set(0.1, 3.0, 0.4)
    const fill = new THREE.DirectionalLight(0xeef2ff, 0.3)
    fill.position.set(2.2, 0.6, 2.0)
    const rim = new THREE.DirectionalLight(0xffffff, 1.8)
    rim.position.set(2.4, 1.3, -2.2)
    const rim2 = new THREE.DirectionalLight(0xffffff, 1.1)
    rim2.position.set(-2.4, 1.0, -2.0)
    scene.add(key, top, fill, rim, rim2)
    const rig = { key, top, fill, rim, rim2 }
    this.rigs.push(rig)
    return rig
  }

  /** Direzione della luce principale (verso la luce), per caustica, nuvola e ombre degli shader. */
  get keyDir() {
    return new THREE.Vector3(-2.4, 1.9, 1.3).normalize()
  }

  /** Controluce nel colore del prodotto (il resto dello studio resta neutro). */
  setTheme(rimColor) {
    for (const rig of this.rigs) {
      rig.rim.color.set(rimColor)
      rig.rim2.color.set(rimColor).lerp(new THREE.Color(0xffffff), 0.5)
    }
  }

  dispose() {
    this.releaseStudio()
    this.envTarget?.dispose()
  }
}
