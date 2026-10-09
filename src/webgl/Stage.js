import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { NOISE } from './noise.js'
import { Particles } from './Particles.js'
import { HeroFX } from './HeroFX.js'
import { SwitchBurst } from './SwitchBurst.js'
import { mixColor } from './color.js'

const DEG = Math.PI / 180

/** Proprieta' guidate dallo scroll (vedi choreography.js). */
export const STATE_KEYS = [
  'sx', 'sy', 'size', 'rotY', 'rotX', 'rotZ', 'elev',
  'key', 'rim', 'env', 'shadow', 'aura', 'spot',
  'uP', 'ambient', 'twist', 'heroOut',
]

/**
 * Scena 3D: un barattolo alla volta, luci da studio, ombra morbida e particelle.
 * Lo scroll non muove direttamente gli oggetti: aggiorna un "target" che qui
 * viene raggiunto con uno smorzamento esponenziale, per un moto sempre continuo.
 *
 * Inquadratura: la camera e' sempre puntata sul barattolo; spostare il prodotto
 * a destra/sinistra usa un decentramento ottico (lens shift), come un banco ottico
 * fotografico, cosi' le verticali restano dritte.
 *
 * Prodotti: ogni modello viene scaricato una volta (loadProduct) e mostrato con
 * setProduct; swap.rot/swap.scale servono all'animazione del cambio prodotto.
 */
export class Stage {
  constructor(canvas, { reduced = false, tier = 'high', theme } = {}) {
    this.canvas = canvas
    this.reduced = reduced
    this.tier = tier
    this.theme = theme

    const renderer = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      stencil: false,
      powerPreference: 'high-performance',
    }))
    renderer.setClearColor(0x000000, 0)
    renderer.debug.checkShaderErrors = import.meta.env.DEV // in produzione compilazione piu' rapida
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    // tarata sul PDF di stampa: bordeaux dell'etichetta fedele, plastica comunque bianca
    renderer.toneMappingExposure = 0.6

    this.maxDpr = tier === 'low' ? 1.75 : 2
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.01, 20)

    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    this.scene.environment = pmrem.fromScene(room, 0.04).texture
    room.dispose?.()
    pmrem.dispose()

    this.keyLight = new THREE.DirectionalLight(0xfff3e9, 2.4)
    this.keyLight.position.set(-1.7, 2.1, 2.6)
    this.fillLight = new THREE.DirectionalLight(0xeef0ff, 0.6)
    this.fillLight.position.set(2.4, 0.4, 1.8)
    this.topLight = new THREE.DirectionalLight(0xffffff, 0.55)
    this.topLight.position.set(0.2, 3.0, 0.6)
    this.rimL = new THREE.DirectionalLight(theme.rim, 0)
    this.rimL.position.set(-2.3, 1.3, -2.4)
    this.rimR = new THREE.DirectionalLight(0xffffff, 0)
    this.rimR.position.set(2.6, 0.9, -2.0)
    this.scene.add(this.keyLight, this.fillLight, this.topLight, this.rimL, this.rimR)

    this.pivot = new THREE.Group()
    this.pivot.rotation.order = 'ZXY'
    this.ground = new THREE.Group()
    this.scene.add(this.pivot, this.ground)

    this.uniforms = {
      uDissolve: { value: 0 },
      uEdge: { value: new THREE.Color(theme.edge) },
      uPivotInv: { value: new THREE.Matrix4() },
      uJarHeight: { value: 0.122 },
    }

    this.jarH = 0.122
    this.jarW = 0.107
    this.cur = null
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 }
    this.intro = { rot: 0, lift: 0, scale: 1 }
    this.swap = { rot: 0, scale: 1 }
    this.productScale = 1 // ingrandimento del barattolo nella hero (heroScale del prodotto)
    this.entries = new Map()
    this.entry = null
    this.size = { w: 1, h: 1 }
    this.metrics = { cx: 0, cy: 0, halfW: 0, halfH: 0 }
    this.helixTilt = new THREE.Euler(0.22, 0, -0.62)
    this._frames = []
    this._v = new THREE.Vector3()
    this._n = new THREE.Vector3()
    this._camDir = new THREE.Vector3()
    this._helixWorld = new THREE.Matrix4()
    this._q = new THREE.Quaternion()
  }

  // ---------------------------------------------------------------------------
  /** Primo prodotto: scarica e mostra subito il barattolo. */
  async load(product, onProgress) {
    const entry = await this.loadProduct(product, onProgress)
    this.setProduct(entry)
    return this
  }

  /** Scarica e prepara il barattolo di un prodotto (una sola volta), senza mostrarlo. */
  loadProduct(product, onProgress) {
    let job = this.entries.get(product.id)
    if (!job) {
      job = this._loadEntry(product, onProgress)
      this.entries.set(product.id, job)
      job.catch(() => this.entries.delete(product.id)) // un errore di rete si puo' riprovare
    }
    return job
  }

  async _loadEntry(product, onProgress) {
    const url = product.model
    // etichetta nella lingua del sito: si scarica insieme al modello
    const label = this.labelSource?.(product.id)
    if (label) this._labelImage(label).catch(() => {})
    const loader = new GLTFLoader()
    if (url.includes('draco')) {
      // versione compressa: il decoder viene caricato solo se serve
      const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js')
      loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'))
    }
    const gltf = await new Promise((resolve, reject) => {
      loader.load(
        url,
        resolve,
        (e) => onProgress?.(e.total ? e.loaded / e.total : Math.min(0.9, e.loaded / 2.4e6)),
        reject,
      )
    })

    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    model.position.y = -(box.min.y + size.y / 2) // centro del barattolo sull'origine
    const meshes = []
    model.traverse((o) => o.isMesh && meshes.push(o))
    const entry = {
      product,
      model,
      meshes,
      materials: this.setupMaterials(meshes),
      jarH: size.y,
      jarW: size.z, // diametro (le linguette sporgono lungo x)
      particles: null,
    }
    await this.applyLabel(entry)

    // i barattoli successivi al primo: shader e texture pronti prima di comparire (niente scatti)
    if (this.entry) {
      for (const m of entry.materials) if (m.map) this.renderer.initTexture(m.map)
      await this.renderer.compileAsync?.(model, this.camera, this.scene)
    }
    return entry
  }

  /** Mostra il barattolo di un prodotto gia' caricato al posto di quello attuale. */
  setProduct(entry) {
    if (this.entry === entry) return
    this.applyLabel(entry) // (scaricato prima di un cambio di lingua: etichetta della lingua attuale)
    if (this.model) this.pivot.remove(this.model)
    this.entry = entry
    this.model = entry.model
    this.meshes = entry.meshes
    this.materials = entry.materials
    this.jarH = entry.jarH
    this.jarW = entry.jarW
    this.uniforms.uJarHeight.value = this.jarH
    this.pivot.add(this.model)
    if (this.shadows) this.fitShadow()
    else this.buildShadow()
    this.heroFX ??= new HeroFX(this, { quality: this.tier === 'low' ? 'low' : 'high', theme: this.theme })
    this.heroFX.setScale(this.jarH / 0.122) // effetti proporzionati al barattolo (0.122 m = collagene)
    // esplosione di colori al cambio prodotto (sul mobile con meno particelle: il moto e' tutto
    // nello shader, il costo e' qualche centinaio di punti per 1.6 s)
    this.burst ??= new SwitchBurst(this, { count: this.tier === 'low' ? 360 : this.tier === 'mid' ? 600 : 900 })
    if (this.particleCount) this.attachParticles()
    this.resize(false) // stessa tela: niente lettura del layout (al cambio prodotto forzava il ricalcolo della pagina)
  }

  /*
    Etichetta nella lingua del sito: i barattoli hanno l'etichetta italiana (texture del modello); nelle altre
    lingue la si sostituisce con quella tradotta, con la stessa impaginazione (public/images/etichette, da
    src/shop/labels.js). labelSource(id) -> indirizzo dell'etichetta da usare, null = quella del modello.
    Sulla scheda video resta una sola etichetta per barattolo: quella non usata si libera (l'immagine resta,
    si ricarica se serve di nuovo).
  */
  setLabelSource(fn) {
    this.labelSource = fn
  }

  /** Immagine di un'etichetta tradotta (scaricata una volta sola). */
  _labelImage(url) {
    this._labelImages ??= new Map()
    let job = this._labelImages.get(url)
    if (!job) {
      job = new THREE.ImageLoader().loadAsync(url)
      this._labelImages.set(url, job)
      job.catch(() => this._labelImages.delete(url))
    }
    return job
  }

  /** Etichetta di un barattolo nella lingua del sito. */
  async applyLabel(entry) {
    const mat = entry?.materials.find((m) => m.name === 'Etichetta')
    if (!mat?.map) return
    entry.labelOriginal ??= mat.map
    const original = entry.labelOriginal
    const url = this.labelSource?.(entry.product.id) ?? null
    let tex = original
    if (url) {
      entry.labelTextures ??= new Map()
      tex = entry.labelTextures.get(url)
      if (!tex) {
        const image = await this._labelImage(url).catch(() => null)
        if (!image) return // non arrivata: resta quella di prima
        tex = new THREE.Texture(image)
        // stesse impostazioni della texture del modello (glTF: niente capovolgimento, sRGB, bordi fermi)
        for (const k of ['flipY', 'colorSpace', 'wrapS', 'wrapT', 'magFilter', 'minFilter', 'anisotropy', 'channel', 'rotation']) tex[k] = original[k]
        tex.offset.copy(original.offset)
        tex.repeat.copy(original.repeat)
        tex.center.copy(original.center)
        tex.needsUpdate = true
        entry.labelTextures.set(url, tex)
      }
    }
    // nel frattempo la lingua puo' essere cambiata di nuovo: vale l'ultima
    if ((this.labelSource?.(entry.product.id) ?? null) !== url || mat.map === tex) return
    const previous = mat.map
    mat.map = tex
    this.renderer.initTexture(tex)
    previous.dispose()
  }

  /** Cambio di lingua: le etichette dei barattoli gia' scaricati (quello in scena per primo). */
  relabel() {
    if (this.entry) this.applyLabel(this.entry)
    for (const job of this.entries.values()) job.then((e) => e !== this.entry && this.applyLabel(e)).catch(() => {})
  }

  /** Colori della scena: tema a sfumato verso il tema b (k 0..1). */
  setTheme(a, b = a, k = 1) {
    mixColor(this.uniforms.uEdge.value, a.edge, b.edge, k)
    mixColor(this.rimL.color, a.rim, b.rim, k)
    if (this.shadows) this.shadows.forEach((m, i) => mixColor(m.material.color, a.shadow[i], b.shadow[i], k))
    this.heroFX?.setTheme(a, b, k)
  }

  setupMaterials(meshes) {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy()
    const mats = new Set(meshes.map((m) => m.material))
    for (const m of mats) {
      if (m.map) {
        m.map.anisotropy = Math.min(16, maxAniso)
        m.map.needsUpdate = true
      }
      if (m.name === 'Etichetta') {
        m.roughness = 0.44
        m.clearcoat = 0.12
        m.clearcoatRoughness = 0.14
      } else if (m.name === 'Plastica_Barattolo') {
        m.color.setRGB(0.9, 0.9, 0.895)
        m.roughness = 0.34
        m.clearcoat = 0.32
        m.clearcoatRoughness = 0.2
      } else if (m.name === 'Plastica_Tappo') {
        m.roughness = 0.44
        m.clearcoat = 0.14
        m.clearcoatRoughness = 0.3
      }
      this.injectDissolve(m)
    }
    return [...mats]
  }

  /** Dissolvenza a rumore con bordo luminoso, sincronizzata con le particelle. */
  injectDissolve(material) {
    const u = this.uniforms
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uDissolve = u.uDissolve
      shader.uniforms.uEdge = u.uEdge
      shader.uniforms.uPivotInv = u.uPivotInv
      shader.uniforms.uJarHeight = u.uJarHeight
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform mat4 uPivotInv;\nvarying vec3 vJarPos;')
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\nvJarPos = (uPivotInv * modelMatrix * vec4(transformed, 1.0)).xyz;',
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>\nuniform float uDissolve;\nuniform vec3 uEdge;\nvarying vec3 vJarPos;\n${NOISE}`,
        )
        .replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\nfloat jn = jarNoise(vJarPos);\nif (uDissolve > 0.0 && jn < uDissolve) discard;',
        )
        .replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\nif (uDissolve > 0.0) { totalEmissiveRadiance += uEdge * (1.0 - smoothstep(0.0, 0.05, jn - uDissolve)) * 3.5; }',
        )
    }
    material.customProgramCacheKey = () => 'jar-dissolve-v1'
    material.needsUpdate = true
  }

  buildShadow() {
    const make = (stops) => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')
      const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128)
      for (const [o, a] of stops) grd.addColorStop(o, `rgba(0,0,0,${a})`)
      g.fillStyle = grd
      g.fillRect(0, 0, 256, 256)
      const tex = new THREE.CanvasTexture(c)
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    }
    const plane = new THREE.PlaneGeometry(1, 1)
    const soft = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        map: make([[0, 0.5], [0.36, 0.34], [0.62, 0.11], [1, 0]]),
        color: new THREE.Color(this.theme.shadow[0]),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    const contact = new THREE.Mesh(
      plane,
      new THREE.MeshBasicMaterial({
        map: make([[0, 0.85], [0.42, 0.6], [0.5, 0.18], [0.62, 0]]),
        color: new THREE.Color(this.theme.shadow[1]),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    for (const mesh of [soft, contact]) {
      mesh.rotation.x = -Math.PI / 2
      mesh.renderOrder = -1
      this.ground.add(mesh)
    }
    this.shadows = [soft, contact]
    this.fitShadow()
  }

  /** Ombra proporzionata al barattolo attivo. */
  fitShadow() {
    this.shadows.forEach((mesh, i) => {
      const s = this.jarW * (i === 0 ? 2.5 : 1.12)
      mesh.scale.set(s, s, 1)
      mesh.position.y = -this.jarH / 2 + 0.0005
    })
  }

  buildParticles(count, layout) {
    this.particleCount = count
    this.attachParticles(true)
    this.setLayout(layout)
    this.resize()
  }

  /**
   * Particelle del barattolo attivo. Servono solo nella sezione Scienza: per i prodotti
   * scelti dal menu vengono create quando il browser e' libero (o subito, se servono prima).
   */
  attachParticles(now = false) {
    const entry = this.entry
    if (this.particles) this.pivot.remove(this.particles.points)
    this.particles = null
    const show = () => {
      if (this.entry !== entry || this.particles) return
      if (!entry.particles) {
        entry.particles = new Particles(this, this.particleCount, entry)
        entry.particles.build()
      }
      this.particles = entry.particles
      this.pivot.add(this.particles.points)
      this.particles.resize(this.size.h * this.dpr, this.camera.fov)
    }
    this._buildParticles = show
    if (now || entry.particles) show()
    else if (window.requestIdleCallback) requestIdleCallback(show, { timeout: 2500 })
    else setTimeout(show, 600)
  }

  setLayout(layout) {
    this.helixTilt.set(layout === 'mobile' ? 0.16 : 0.22, 0, layout === 'mobile' ? -0.34 : -0.62)
  }

  // ---------------------------------------------------------------------------
  /** measure = false: riusa le misure della tela gia' lette (cambio prodotto, la tela non cambia). */
  resize(measure = true) {
    const keep = !measure && this.size.w > 1
    const w = keep ? this.size.w : this.canvas.clientWidth || window.innerWidth
    const h = keep ? this.size.h : this.canvas.clientHeight || window.innerHeight
    this.size = { w, h }
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.particles?.resize(h * this.dpr, this.camera.fov)
    this.heroFX?.resize(h * this.dpr, this.camera.fov)
    this.burst?.resize(h * this.dpr, this.camera.fov)
  }

  /** Esplosione di colori attorno al barattolo appena arrivato (nei colori del suo tema). */
  burstColors(theme) {
    this.burst?.fire(theme)
  }

  /** Porta subito lo stato corrente sul target (dopo un salto di navigazione). */
  snap() {
    this._snap = true
  }

  update(dt, time, target) {
    if (!this.cur || this._snap) {
      this.cur = { ...target }
      this._snap = false
    }
    const c = this.cur
    const k = 1 - Math.exp(-dt * (this.reduced ? 14 : 5.4))
    for (const key of STATE_KEYS) c[key] += (target[key] - c[key]) * k

    const p = this.pointer
    const pk = 1 - Math.exp(-dt * 2.6)
    p.sx += (p.x - p.sx) * pk
    p.sy += (p.y - p.sy) * pk

    const live = this.reduced ? 0 : 1
    const bob = Math.sin(time * 0.9) * 0.007 * live
    const sway = Math.sin(time * 0.37) * 0.04 * live

    this.pivot.rotation.set(
      c.rotX + p.sy * 0.06 * live,
      c.rotY + sway + p.sx * 0.17 * live + this.intro.rot + this.swap.rot,
      c.rotZ,
    )
    // heroScale vale solo nella hero: con lo scroll il barattolo torna alla misura delle scene
    const heroK = 1 + (this.productScale - 1) * (1 - Math.min(1, Math.max(0, c.heroOut)))
    this.pivot.scale.setScalar(this.swap.scale * heroK)

    // camera: distanza ricavata dalla dimensione desiderata sullo schermo
    const fov = this.camera.fov * DEG
    const size = Math.max(0.04, c.size * this.intro.scale)
    const dist = this.jarH / size / (2 * Math.tan(fov / 2))
    const el = c.elev * DEG
    this.camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist)
    this.camera.lookAt(0, 0, 0)
    this.camera.near = Math.max(0.004, dist * 0.04)
    this.camera.far = dist * 12
    const { w, h } = this.size
    const sy = c.sy + bob + this.intro.lift
    this.camera.setViewOffset(w, h, (-c.sx * w) / 2, (sy * h) / 2, w, h)
    this.camera.updateProjectionMatrix()

    // metriche del barattolo sullo schermo (per testi, linee e aura)
    const m = this.metrics
    m.cx = w / 2 + (c.sx * w) / 2
    m.cy = h / 2 - (sy * h) / 2
    m.halfH = (size * h) / 2
    m.halfW = m.halfH * (this.jarW / this.jarH)

    // luci
    this.keyLight.intensity = 2.1 * c.key
    this.topLight.intensity = 0.5 * c.key
    this.rimL.intensity = 3.4 * c.rim
    this.rimR.intensity = 2.6 * c.rim
    this.scene.environmentIntensity = 0.82 * c.env
    if (this.shadows) {
      this.shadows[0].material.opacity = 0.85 * c.shadow
      this.shadows[1].material.opacity = 0.7 * c.shadow
    }

    // dissolvenza + particelle
    const dissolve = c.uP < 0.002 ? 0 : Math.min(1.02, c.uP / 0.55)
    this.uniforms.uDissolve.value = dissolve
    if (this.model) this.model.visible = dissolve < 1.0

    this.pivot.updateMatrixWorld(true)
    this.uniforms.uPivotInv.value.copy(this.pivot.matrixWorld).invert()

    if (!this.particles && this.particleCount && (c.uP > 0.002 || c.ambient > 0.004)) this._buildParticles?.()
    if (this.particles) {
      this._q.setFromEuler(this.helixTilt)
      this._helixWorld.makeRotationFromQuaternion(this._q)
      this.particles.update(time, c, this.uniforms.uPivotInv.value, this._helixWorld)
    }
    this.heroFX?.update(time, c.heroOut)
    this.burst?.update(dt)
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  /** Riduce la risoluzione se il dispositivo fatica (media su ~1.5 s). */
  adapt(dt) {
    const f = this._frames
    f.push(dt)
    if (f.length < 90) return
    const avg = f.reduce((a, b) => a + b, 0) / f.length
    f.length = 0
    if (avg > 1 / 42 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.resize(false) // cambia solo la risoluzione: niente lettura del layout durante lo scroll
    }
  }

  /** Punto nel sistema del barattolo (base = 0) -> pixel sullo schermo + visibilita'. */
  project(local, normal, out) {
    const v = this._v.set(local.x, local.y - this.jarH / 2, local.z)
    v.applyMatrix4(this.pivot.matrixWorld)
    const n = this._n.copy(normal).transformDirection(this.pivot.matrixWorld)
    this._camDir.copy(this.camera.position).sub(v).normalize()
    out.facing = n.dot(this._camDir)
    v.project(this.camera)
    out.x = (v.x * 0.5 + 0.5) * this.size.w
    out.y = (-v.y * 0.5 + 0.5) * this.size.h
    return out
  }
}
