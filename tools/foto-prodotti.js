// Strumento (solo sviluppo): foto WebP dei barattoli per il negozio, con le luci di src/webgl/Stage.js.
// Apri http://127.0.0.1:5173/tools/foto-prodotti.html con `npm run dev`.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { PRODUCTS } from '../src/products.js'

const W = 800
const H = 1000
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setPixelRatio(1)
renderer.setSize(W, H)
renderer.setClearColor(0x000000, 0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 0.6

const scene = new THREE.Scene()
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture
scene.environmentIntensity = 0.82

const light = (color, intensity, x, y, z) => {
  const l = new THREE.DirectionalLight(color, intensity)
  l.position.set(x, y, z)
  scene.add(l)
  return l
}
light(0xfff3e9, 2.1, -1.7, 2.1, 2.6) // principale
light(0xeef0ff, 0.6, 2.4, 0.4, 1.8) // riempimento
light(0xffffff, 0.5, 0.2, 3.0, 0.6) // dall'alto
const rimL = light(0xffffff, 1.1, -2.3, 1.3, -2.4) // controluce nel colore del prodotto
light(0xffffff, 0.9, 2.6, 0.9, -2.0)

const camera = new THREE.PerspectiveCamera(22, W / H, 0.01, 20)
const loader = new GLTFLoader()

/** Materiali come nel sito (Stage.setupMaterials). */
function tune(model) {
  model.traverse((o) => {
    if (!o.isMesh) return
    const m = o.material
    if (m.map) m.map.anisotropy = renderer.capabilities.getMaxAnisotropy()
    if (m.name === 'Etichetta') Object.assign(m, { roughness: 0.44, clearcoat: 0.12, clearcoatRoughness: 0.14 })
    else if (m.name === 'Plastica_Barattolo') {
      m.color.setRGB(0.9, 0.9, 0.895)
      Object.assign(m, { roughness: 0.34, clearcoat: 0.32, clearcoatRoughness: 0.2 })
    } else if (m.name === 'Plastica_Tappo') Object.assign(m, { roughness: 0.44, clearcoat: 0.14, clearcoatRoughness: 0.3 })
  })
}

/** Barattolo quasi di fronte, alto l'84% dell'immagine, camera appena sopra. */
async function photo(p) {
  rimL.color.set(p.theme.rim)
  const model = (await loader.loadAsync(p.model)).scene
  tune(model)
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  model.position.sub(box.getCenter(new THREE.Vector3()))
  const pivot = new THREE.Group()
  pivot.add(model)
  pivot.rotation.set(0.05, -0.08, 0)
  scene.add(pivot)
  const dist = (size.y * 1.1) / 0.84 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
  const el = THREE.MathUtils.degToRad(8)
  camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist)
  camera.lookAt(0, 0, 0)
  renderer.render(scene, camera)
  const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/webp', 0.86))
  scene.remove(pivot)
  model.traverse((o) => {
    if (!o.isMesh) return
    o.geometry.dispose()
    for (const v of Object.values(o.material)) if (v?.isTexture) v.dispose()
    o.material.dispose()
  })
  return blob
}

const grid = document.querySelector('[data-grid]')
const all = document.querySelector('[data-all]')
const files = []
for (const p of PRODUCTS) {
  const blob = await photo(p)
  const url = URL.createObjectURL(blob)
  files.push({ name: `${p.id}.webp`, url })
  grid.insertAdjacentHTML(
    'beforeend',
    `<figure><img src="${url}" alt="${p.name}"><figcaption><span>${p.id}.webp (${Math.round(blob.size / 1024)} KB)</span>` +
      `<a href="${url}" download="${p.id}.webp">Scarica</a></figcaption></figure>`,
  )
}
all.disabled = false
all.textContent = `Scarica tutte (${files.length})`
all.addEventListener('click', async () => {
  for (const f of files) {
    const a = Object.assign(document.createElement('a'), { href: f.url, download: f.name })
    a.click()
    await new Promise((r) => setTimeout(r, 250))
  }
})
