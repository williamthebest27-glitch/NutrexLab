import * as THREE from 'three'
import { ShowcaseExperience } from './ShowcaseExperience.js'
import { findMesh } from './assets.js'
import { NOISE } from './shaders/chunks.js'

/*
  COMPRESSA biconvessa (tablet.glb) con l'esagono del logo inciso, oppure ovale con la linea di
  frattura (shape 'oval', tablet-oblong.glb: 18.5 x 8.2 x 6.2 mm): superficie satinata di polvere
  compressa (grana finissima, sheen vellutato) e qualche puntino del colore del prodotto.
  Sospesa mostra la faccia con l'incisione che ruota; alla fine si posa piatta sul piano.
*/
export class TabletExperience extends ShowcaseExperience {
  static type = 'tablet'
  static models = ['tablet.glb']

  /** Modello della forma: rotonda (di base) o ovale. */
  static modelsFor(shape) {
    return shape === 'oval' ? ['tablet-oblong.glb'] : this.models
  }

  constructor(ctx) {
    super(ctx)
    this.oval = ctx.shape === 'oval'
  }

  get pose() {
    // sospesa con la faccia incisa verso la camera, a riposo piatta sul piano
    // (l'ovale, piu' spessa e lunga, si posa di tre quarti: di punta sembrerebbe piccola)
    if (this.oval) return { floatX: 62, floatZ: 8, restX: 0, restZ: 0, restY: 0.00311, size: 0.019, spinTurns: 1.06 }
    return { floatX: 62, floatZ: 8, restX: 0, restZ: 0, restY: 0.00246, size: 0.014, spinTurns: 1.25 }
  }

  /** Dose: le altre compresse in fila accanto alla prima, un po' sfalsate e girate. */
  get dosePlaces() {
    return this.oval
      ? [{ x: 0.0185, z: 0.004, yaw: -46 }, { x: 0.0345, z: -0.003, yaw: -8 }]
      : [{ x: 0.0145, z: -0.004, yaw: 35 }, { x: 0.0285, z: 0.003, yaw: -20 }]
  }

  createMeshes(root) {
    const tablet = findMesh(root, 'Compressa')
    if (!tablet) throw new Error('modello della compressa: manca la mesh Compressa')
    this.speckle = { value: new THREE.Color(0xc45a90) }
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xefeae1,
      roughness: 0.6,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.75,
      sheenColor: new THREE.Color(0xffffff),
      envMapIntensity: 0.8,
    })
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSpeckle = this.speckle
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\nuniform vec3 uSpeckle;\n${NOISE}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          // polvere compressa: lievi variazioni di tono e rari puntini colorati
          float pe_t = pe_noise(vObj * 2400.0);
          float pe_s = smoothstep(0.86, 0.92, pe_noise(vObj * 5200.0 + 7.0));
          diffuseColor.rgb *= 0.93 + 0.09 * pe_t;
          diffuseColor.rgb = mix(diffuseColor.rgb, uSpeckle, pe_s * 0.55);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          vec3 pe_g = vObj * 4200.0;
          normal = normalize(normal + vec3(pe_noise(pe_g) - 0.5, pe_noise(pe_g + 3.1) - 0.5, 0.0) * 0.22);`,
        )
    }
    this.mat.customProgramCacheKey = () => 'pe-tablet-v1'
    return [new THREE.Mesh(tablet.geometry, this.mat)]
  }

  setTheme(t) {
    if (!this.mat) return
    this.mat.color.set(t.tablet ?? '#efeae1')
    this.speckle.value.set(t.speckle ?? '#c45a90')
  }
}
