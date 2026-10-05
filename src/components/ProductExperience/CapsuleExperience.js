import * as THREE from 'three'
import { ShowcaseExperience } from './ShowcaseExperience.js'
import { findMesh } from './assets.js'
import { NOISE } from './shaders/chunks.js'

/*
  CAPSULA vegetale in due parti (capsule.glb): testa nel colore del prodotto, corpo bianco
  traslucido, lucide (clearcoat) e appena trasparenti: attraverso il guscio si intravede la polvere.
  La trasparenza e' quella fisica di three.js (transmission): la luce attraversa davvero il guscio.
*/
export class CapsuleExperience extends ShowcaseExperience {
  static type = 'capsule'
  static models = ['capsule.glb']

  get pose() {
    // sospesa di fianco alla camera (asse quasi orizzontale), a riposo distesa sul piano
    return { floatX: 12, floatZ: 70, restX: 0, restZ: 90, restY: 0.00384, size: 0.022, spinTurns: 1.5 }
  }

  createMeshes(root) {
    const cap = findMesh(root, 'Capsula_Testa')
    const body = findMesh(root, 'Capsula_Corpo')
    const fill = findMesh(root, 'Capsula_Polvere')
    if (!cap || !body || !fill) throw new Error('capsule.glb: mancano le parti della capsula')
    const shell = {
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.07,
      ior: 1.46,
      specularIntensity: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 1.05,
    }
    this.capMat = new THREE.MeshPhysicalMaterial({
      ...shell,
      color: 0xb8322e,
      roughness: 0.15,
      transmission: 0.32,
      thickness: 0.0004,
      attenuationColor: new THREE.Color(0xb8322e),
      attenuationDistance: 0.002,
    })
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      ...shell,
      color: 0xf2efe8,
      roughness: 0.17,
      transmission: 0.55,
      thickness: 0.0003,
      attenuationColor: new THREE.Color(0xf4efe4),
      attenuationDistance: 0.004,
    })
    this.fillMat = new THREE.MeshStandardMaterial({ color: 0xe3b04a, roughness: 0.95, metalness: 0 })
    this.fillMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\n${NOISE}`)
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb *= 0.86 + 0.2 * pe_noise(vObj * 3200.0);',
        )
    }
    this.fillMat.customProgramCacheKey = () => 'pe-capsule-fill-v1'
    // ordine di disegno: polvere, corpo, testa (la testa avvolge l'estremita' del corpo)
    const meshes = [
      new THREE.Mesh(fill.geometry, this.fillMat),
      new THREE.Mesh(body.geometry, this.bodyMat),
      new THREE.Mesh(cap.geometry, this.capMat),
    ]
    meshes.forEach((m, i) => (m.renderOrder = 20 + i))
    return meshes
  }

  setTheme(t) {
    if (!this.capMat) return
    this.capMat.color.set(t.capsule)
    this.capMat.attenuationColor.set(t.capsule)
    this.bodyMat.color.set(t.capsuleBody ?? '#f2efe8')
    this.fillMat.color.set(t.fill)
  }
}
