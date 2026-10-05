import * as THREE from 'three'
import { glassVertex, glassBackFragment, glassFrontFragment } from './shaders/glass.js'
import { waterVertex, waterFragment } from './shaders/water.js'
import { backdropVertex, backdropFragment } from './shaders/backdrop.js'
import { screenVertex, copyFragment, outputFragment } from './shaders/composite.js'
import { ProductLighting } from './ProductLighting.js'

/*
  Scena 3D del set fotografico: renderer, studio, bicchiere d'acqua e i tre strati di rendering.

    1. INSIDE (tInside, mezza risoluzione): quello che sta DENTRO l'acqua (la polvere che si
       scioglie). Fondo trasparente, alfa premoltiplicata.
    2. BACK (tBack + profondita', HDR): tutto il resto della scena senza la parete del bicchiere rivolta
       alla camera: fondale, superficie dell'acqua (che legge INSIDE), meta' lontana del vetro,
       misurino, polvere in caduta, capsula e compressa.
    3. MAIN (HDR): BACK, poi la "lente" (glass.js) che rifrange BACK e INSIDE come farebbero vetro e
       acqua veri.
    4. SCHERMO: MAIN con vignettatura, tone mapping e dithering.

  Cosi' la polvere sospesa nell'acqua si vede ingrandita e deformata dal bicchiere (con le
  trasparenze standard di three.js non si potrebbe: le particelle finirebbero davanti al vetro).
  Unita': metri, bicchiere con il fondo in (0, 0, 0), camera verso -Z.
*/

export const WALL_Z = -0.85

function blankTexture() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1)
  t.needsUpdate = true
  return t
}

export class ProductScene {
  constructor(canvas, quality) {
    this.canvas = canvas
    this.quality = quality
    const renderer = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
    }))
    renderer.autoClear = false
    renderer.outputColorSpace = THREE.SRGBColorSpace
    // AgX: ombre morbide senza saturare i neri tinti dello studio, alte luci del vetro che non bruciano
    renderer.toneMapping = THREE.AgXToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.localClippingEnabled = true
    renderer.debug.checkShaderErrors = !!import.meta.env?.DEV

    this.camera = new THREE.PerspectiveCamera(14, 1, 0.04, 8)
    this.back = new THREE.Scene()
    this.inside = new THREE.Scene()
    this.front = new THREE.Scene()
    this.screen = new THREE.Scene()
    this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.lighting = new ProductLighting(renderer)
    this.back.environment = this.lighting.envTexture
    this.inside.environment = this.lighting.envTexture
    this.lighting.rig(this.back)
    this.lighting.rig(this.inside)
    this.envDefines = this.lighting.defines

    this.dpr = quality.dpr
    this.size = { w: 1, h: 1 }
    this.bufferSize = new THREE.Vector2(1, 1)
    this.clearColor = new THREE.Color(0x060508)

    this.buildTargets()
    this.u = this.sharedUniforms()
    this.buildBackdrop()
    this.buildComposite()

    // piani di taglio: sopra / sotto il pelo dell'acqua (gli oggetti che attraversano la superficie
    // vengono disegnati in due strati)
    this.aboveWater = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.071)
    this.belowWater = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.071)

    this._frames = []
  }

  buildTargets() {
    const q = this.quality
    const common = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      stencilBuffer: false,
    }
    this.backRT = new THREE.WebGLRenderTarget(1, 1, {
      ...common,
      depthBuffer: true,
      depthTexture: new THREE.DepthTexture(1, 1),
      samples: q.msaa,
    })
    this.insideRT = new THREE.WebGLRenderTarget(1, 1, { ...common, depthBuffer: true })
    this.mainRT = new THREE.WebGLRenderTarget(1, 1, { ...common, depthBuffer: false })
  }

  sharedUniforms() {
    const keyDir = this.lighting.keyDir
    return {
      envMap: { value: this.lighting.envTexture },
      uEnvIntensity: { value: 1.0 },
      uViewProj: { value: new THREE.Matrix4() },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uROut: { value: 0.037 },
      uRIn: { value: 0.0348 },
      uBase: { value: 0.016 },
      uHeight: { value: 0.108 },
      uWaterY: { value: 0.071 },
      uWallZ: { value: WALL_Z },
      uMeniscus: { value: 0.0014 },
      uBgLow: { value: new THREE.Color(0x0d0b10) },
      uBgGlow: { value: new THREE.Color(0x2a1a24) },
      uPool: { value: new THREE.Color(0x1d1a1f) },
      uCausticColor: { value: new THREE.Color(1.0, 0.96, 0.9) },
      uCaustic: { value: 0.1 },
      uShadowDir: { value: new THREE.Vector2(-keyDir.x, -keyDir.z).normalize() },
      uKeyDir: { value: keyDir },
      uCloud: { value: 0 },
      uCloudColor: { value: new THREE.Color(0.72, 0.71, 0.69) },
      uWaterAbsorb: { value: new THREE.Vector3(0.9, 0.32, 0.22) },
      uGlassAbsorb: { value: new THREE.Vector3(2.6, 0.7, 1.1) },
      uDispersion: { value: this.quality.dispersion },
      uRipple: { value: 0 },
      uRipples: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
      uAmbient: { value: 0.0007 },
      uFloorReflect: { value: this.quality.floorReflect },
      tBack: { value: this.backRT.texture },
      tDepth: { value: this.backRT.depthTexture },
      tInside: { value: this.insideRT.texture },
      uEtch: { value: blankTexture() },
      uEtchOn: { value: 0 },
      uEtchRect: { value: new THREE.Vector4(Math.PI / 2, 0.04, 0.55, 0.006) },
      uGlassRot: { value: 0 },
    }
  }

  /**
   * Logo inciso sul vetro (texture in bianco su nero), centrato sul fronte del bicchiere.
   * width = larghezza lungo la circonferenza (m), y = quota del centro (m).
   */
  setEtch({ texture, aspect }, { width = 0.042, y = 0.038, strength = 0.85 } = {}) {
    const r = this.u.uROut.value
    const u = this.u
    u.uEtch.value = texture
    u.uEtchRect.value.set(Math.PI / 2, y, width / r / 2, width / aspect / 2)
    u.uEtchOn.value = strength
  }

  /** Materiale con gli uniform condivisi (stessi oggetti: aggiornati una volta per tutti). */
  material(params) {
    const { uniforms = {}, defines = {}, ...rest } = params
    return new THREE.ShaderMaterial({
      ...rest,
      uniforms: { ...this.u, ...uniforms },
      defines: { ...this.envDefines, ...defines },
    })
  }

  // ---------------------------------------------------------------------------
  /** Fondale curvo: pavimento che sale nella parete di fondo senza spigolo (raggio 0.5 m). */
  buildBackdrop() {
    const R = 0.5
    const prof = []
    for (let z = 4; z > WALL_Z + R; z -= 0.25) prof.push([z, 0])
    for (let k = 0; k <= 24; k++) {
      const a = (Math.PI / 2) * (k / 24)
      prof.push([WALL_Z + R - Math.sin(a) * R, R - Math.cos(a) * R])
    }
    for (let y = R + 0.25; y <= 4.01; y += 0.25) prof.push([WALL_Z, y])
    const xs = [-4, -1, 0, 1, 4]
    const pos = []
    const idx = []
    for (const x of xs) for (const [z, y] of prof) pos.push(x, y, z)
    const n = prof.length
    for (let i = 0; i < xs.length - 1; i++) {
      for (let k = 0; k < n - 1; k++) {
        const a = i * n + k
        const b = (i + 1) * n + k
        idx.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    this.backdrop = new THREE.Mesh(
      geo,
      this.material({ vertexShader: backdropVertex, fragmentShader: backdropFragment, side: THREE.DoubleSide }),
    )
    this.backdrop.renderOrder = -10
    this.backdrop.frustumCulled = false
    this.back.add(this.backdrop)
  }

  buildComposite() {
    const pass = (fragmentShader, uniforms, extra = {}) =>
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        fragmentShader,
        uniforms,
        depthTest: false,
        depthWrite: false,
        ...extra,
      })
    this.copyMaterial = pass(copyFragment, {
      tBack: this.u.tBack,
      uTexel: { value: new THREE.Vector2(1, 1) },
      uFxaa: { value: this.quality.msaa > 0 ? 0 : 1 },
    })
    this.outputMaterial = pass(
      outputFragment,
      { tMain: { value: this.mainRT.texture }, uVignette: { value: 0.5 } },
      { dithering: true },
    )
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.outputMaterial)
    this.quad.frustumCulled = false
    this.screen.add(this.quad)
  }

  /** Una passata a tutto schermo con il materiale `mat` verso `target`. */
  blit(mat, target) {
    this.quad.material = mat
    this.renderer.setRenderTarget(target)
    this.renderer.render(this.screen, this.screenCamera)
  }

  /** Bicchiere e superficie dell'acqua da glass.glb (misure negli extras). */
  setGlass(root) {
    let glass = null
    let water = null
    root.traverse((o) => {
      if (!o.isMesh) return
      if (o.name.startsWith('Bicchiere')) glass = o
      else if (o.name.startsWith('Acqua')) water = o
    })
    if (!glass || !water) throw new Error('glass.glb: mancano Bicchiere o Acqua_Superficie')
    const g = glass.userData
    const u = this.u
    u.uROut.value = g.r_out ?? 0.037
    u.uRIn.value = g.r_in ?? 0.0348
    u.uBase.value = g.base ?? 0.016
    u.uHeight.value = g.height ?? 0.108
    u.uWaterY.value = g.water_level ?? 0.071
    u.uMeniscus.value = g.meniscus ?? 0.0014
    this.waterY = u.uWaterY.value
    this.aboveWater.constant = -this.waterY
    this.belowWater.constant = this.waterY
    this.glassInfo = {
      rOut: u.uROut.value,
      rIn: u.uRIn.value,
      base: u.uBase.value,
      height: u.uHeight.value,
      waterY: this.waterY,
    }

    this.glassBack = new THREE.Mesh(
      glass.geometry,
      this.material({
        vertexShader: glassVertex,
        fragmentShader: glassBackFragment,
        side: THREE.DoubleSide,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
      }),
    )
    this.glassBack.renderOrder = 50
    this.lens = new THREE.Mesh(
      glass.geometry,
      this.material({
        vertexShader: glassVertex,
        fragmentShader: glassFrontFragment,
        side: THREE.FrontSide,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
        dithering: true,
      }),
    )
    this.water = new THREE.Mesh(
      water.geometry,
      this.material({ vertexShader: waterVertex, fragmentShader: waterFragment }),
    )
    this.water.renderOrder = 1
    for (const m of [this.glassBack, this.lens, this.water]) m.frustumCulled = false
    this.back.add(this.glassBack, this.water)
    this.front.add(this.lens)
  }

  /** Colori dello studio dal tema del prodotto (fondo quasi nero tinto, alone, nuvola). */
  setTheme(t) {
    const u = this.u
    u.uBgLow.value.set(t.bgLow)
    u.uBgGlow.value.set(t.bgGlow)
    u.uPool.value.set(t.pool)
    u.uCloudColor.value.set(t.cloud)
    this.clearColor.set(t.bgLow)
    this.lighting.setTheme(t.rim)
  }

  // ---------------------------------------------------------------------------
  resize(width, height) {
    this.size = { w: width, h: height }
    const r = this.renderer
    r.setPixelRatio(this.dpr)
    r.setSize(width, height, false)
    r.getDrawingBufferSize(this.bufferSize)
    const W = this.bufferSize.x
    const H = this.bufferSize.y
    this.backRT.setSize(W, H)
    this.mainRT.setSize(W, H)
    const s = this.quality.insideScale
    this.insideRT.setSize(Math.max(1, Math.round(W * s)), Math.max(1, Math.round(H * s)))
    this.u.uViewport.value.set(W, H)
    this.copyMaterial.uniforms.uTexel.value.set(1 / W, 1 / H)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  /** Lato del pixel di schermo in metri a distanza `dist` dalla camera (per le particelle). */
  pixelScale() {
    return this.bufferSize.y / (2 * Math.tan((this.camera.fov * Math.PI) / 360))
  }

  render(time) {
    const r = this.renderer
    const cam = this.camera
    this.u.uTime.value = time
    cam.updateMatrixWorld()
    this.u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)

    r.setRenderTarget(this.insideRT)
    r.setClearColor(0x000000, 0)
    r.clear(true, true, false)
    r.render(this.inside, cam)

    r.setRenderTarget(this.backRT)
    r.setClearColor(this.clearColor, 1)
    r.clear(true, true, false)
    r.render(this.back, cam)

    // immagine principale: strato posteriore + lente del bicchiere (HDR lineare), poi lo schermo
    this.blit(this.copyMaterial, this.mainRT)
    r.render(this.front, cam)
    this.blit(this.outputMaterial, null)
  }

  /** Abbassa la risoluzione se il dispositivo non tiene i 60 fps (media su ~1 s). */
  adapt(dt) {
    const f = this._frames
    f.push(dt)
    if (f.length < 60) return false
    const avg = f.reduce((a, b) => a + b, 0) / f.length
    f.length = 0
    const floor = this.quality.minDpr
    if (avg > 1 / 48 && this.dpr > floor) {
      this.dpr = Math.max(floor, this.dpr - 0.2)
      this.resize(this.size.w, this.size.h)
      return true
    }
    return false
  }

  /**
   * Compila tutti gli shader prima della prima immagine, in parallelo e senza fermare la pagina.
   * Va fatto con il render target giusto: le tre scene finiscono in buffer intermedi (lineari, senza
   * tone mapping), solo l'ultima passata va sullo schermo. Compilandole verso lo schermo three
   * prepara varianti che non usa mai e al primo fotogramma compila quelle vere in modo sincrono:
   * pagina ferma per secondi proprio mentre ci si avvicina alla sezione.
   */
  async warmup() {
    const r = this.renderer
    const compile = (scene, camera, target) => {
      r.setRenderTarget(target)
      const job = r.compileAsync ? r.compileAsync(scene, camera) : (r.compile(scene, camera), null)
      r.setRenderTarget(null)
      return job
    }
    // tutte insieme: il browser le compila in parallelo (KHR_parallel_shader_compile)
    const jobs = [
      compile(this.inside, this.camera, this.insideRT),
      compile(this.back, this.camera, this.backRT),
      compile(this.front, this.camera, this.mainRT),
    ]
    this.quad.material = this.copyMaterial
    jobs.push(compile(this.screen, this.screenCamera, this.mainRT))
    // (stesso quad: la seconda passata va compilata dopo aver ripreso il materiale)
    this.quad.material = this.outputMaterial
    jobs.push(compile(this.screen, this.screenCamera, null))
    await Promise.all(jobs)
  }

  dispose() {
    for (const rt of [this.backRT, this.insideRT, this.mainRT]) rt.dispose()
    this.copyMaterial.dispose()
    this.lighting.dispose()
    for (const s of [this.back, this.inside, this.front, this.screen]) {
      s.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) [].concat(o.material).forEach((m) => m.dispose())
      })
    }
    this.outputMaterial.dispose()
    this.renderer.dispose()
    // libera subito il contesto WebGL (in un'app a pagina singola i contesti aperti sono pochi)
    this.renderer.forceContextLoss()
  }
}
