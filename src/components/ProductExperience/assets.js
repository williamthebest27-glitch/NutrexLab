import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

/*
  Caricamento dei modelli (GLB compressi Draco, esportati da sezione bicchiere/blender/esperienza_3d.py).
  Ogni file viene scaricato una sola volta e solo quando serve: il bicchiere e il modello del tipo
  di prodotto mostrato (misurino, capsula o compressa), mai tutti insieme.
*/

let loader = null
const cache = new Map()

function getLoader(dracoPath) {
  if (!loader) {
    const draco = new DRACOLoader()
    draco.setDecoderPath(dracoPath)
    draco.preload()
    loader = new GLTFLoader()
    loader.setDRACOLoader(draco)
  }
  return loader
}

/** Scarica (una volta) un GLB e ne restituisce la scena. */
export function loadModel(url, { dracoPath = '/draco/' } = {}) {
  let job = cache.get(url)
  if (!job) {
    job = getLoader(dracoPath)
      .loadAsync(url)
      .then((gltf) => gltf.scene)
    cache.set(url, job)
    job.catch(() => cache.delete(url)) // un errore di rete si puo' riprovare
  }
  return job
}

/** Mesh di un modello per nome (prefisso). */
export function findMesh(root, prefix) {
  let found = null
  root.traverse((o) => {
    if (!found && o.isMesh && o.name.startsWith(prefix)) found = o
  })
  return found
}
