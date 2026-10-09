import * as THREE from 'three'
import { glassVertex, glassBackFragment, glassFrontFragment } from './shaders/glass.js'
import { waterVertex, waterFragment } from './shaders/water.js'
import { backdropVertex, backdropFragment } from './shaders/backdrop.js'
import { screenVertex, copyFragment, outputFragment } from './shaders/composite.js'
import { impostorVertex, impostorFragment } from './shaders/impostor.js'
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
    5. Studio scuro: al posto della lente, sopra lo schermo, il bicchiere renderizzato da Blender
       (shaders/impostor.js): vetro, acqua e logo sono i pixel del render (OVER, dopo il tone mapping).

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
  /** size (facoltativa): misura dello stage in px CSS, { w, h }. */
  constructor(canvas, quality, size = null) {
    this.canvas = canvas
    this.quality = quality
    this.dpr = quality.dpr
    // misura giusta prima di creare il contesto: il buffer di disegno nasce gia' grande cosi'.
    // Cambiarla dopo fa aspettare la GPU (controlli sincroni, decine di ms se sta disegnando la pagina)
    if (size) {
      canvas.width = Math.max(1, Math.floor(size.w * this.dpr))
      canvas.height = Math.max(1, Math.floor(size.h * this.dpr))
    }
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
    // estensioni che serviranno piu' avanti, chieste subito: attivarne una fa aspettare la GPU (una
    // chiamata sincrona, lunga se intanto la GPU disegna la pagina). Qui l'attesa c'e' comunque
    // (creazione del contesto); dopo, a meta' preparazione, sarebbe un fotogramma lungo in piu'
    for (const ext of ['KHR_parallel_shader_compile', 'EXT_texture_filter_anisotropic']) renderer.extensions.has(ext)

    this.camera = new THREE.PerspectiveCamera(14, 1, 0.04, 8)
    this.back = new THREE.Scene()
    this.inside = new THREE.Scene()
    this.front = new THREE.Scene()
    this.over = new THREE.Scene()
    this.screen = new THREE.Scene()
    this.screenCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.size = { w: 1, h: 1 }
    this.bufferSize = new THREE.Vector2(1, 1)
    this.clearColor = new THREE.Color(0x060508)

    // piani di taglio: sopra / sotto il pelo dell'acqua (gli oggetti che attraversano la superficie
    // vengono disegnati in due strati)
    this.aboveWater = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.071)
    this.belowWater = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.071)

    this._frames = []
  }

  /**
   * Preparazione a piccoli passi, uno per fotogramma (pause tra l'uno e l'altro), separati dal
   * contesto WebGL: programmi dell'ambiente compilati in parallelo (prepare, facoltativo), ambiente
   * dello studio (buildStudio, PMREM), poi buffer intermedi, fondale e passate finali (init).
   */
  prepare(pause = null) {
    this.lighting ??= new ProductLighting(this.renderer)
    return this.lighting.precompile(pause)
  }

  buildStudio() {
    if (this.envDefines) return
    this.lighting ??= new ProductLighting(this.renderer)
    this.lighting.build()
    this.back.environment = this.lighting.envTexture
    this.inside.environment = this.lighting.envTexture
    this.lighting.rig(this.back)
    this.lighting.rig(this.inside)
    this.envDefines = this.lighting.defines
  }

  init() {
    this.buildStudio()
    this.buildTargets()
    this.u = this.sharedUniforms()
    this.buildBackdrop()
    this.buildComposite()
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
      uInvViewProj: { value: new THREE.Matrix4() },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uROut: { value: 0.037 },
      uRIn: { value: 0.0348 },
      uTaper: { value: 0 },
      uBowl: { value: new THREE.Vector2(0, 0) },
      uPunt: { value: new THREE.Vector2(0, 0) },
      uBubbles: { value: Array.from({ length: 24 }, () => new THREE.Vector4(0, 0, 0, 0)) },
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
      uPhoto: { value: 0 },
      uGlassInside: { value: 0 },
      uPoolR: { value: 0.24 },
      uBlack: { value: 0 },
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
    const u = this.u
    const r = u.uROut.value + u.uTaper.value * (y - u.uWaterY.value) // raggio del vetro a quella quota
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
      { tMain: { value: this.mainRT.texture }, uVignette: { value: 0.5 }, uBlack: this.u.uBlack },
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

  /**
   * Bicchiere e superficie dell'acqua da glass.glb (misure negli extras, in metri). Il bicchiere di
   * bicchiere_3d.py e' un tronco di cono: raggi esterni in alto e alla base (r_top, r_bot), parete,
   * fondo interno a coppa, incavo sotto e le bollicine sulla parete; senza, un cilindro (r_out, r_in).
   */
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
    u.uBase.value = g.base ?? 0.016
    u.uHeight.value = g.height ?? 0.108
    u.uWaterY.value = g.water_level ?? 0.071
    u.uMeniscus.value = g.meniscus ?? 0.0014
    const cone = g.r_top != null && g.r_bot != null && g.wall != null
    const taper = cone ? (g.r_top - g.r_bot) / u.uHeight.value : 0
    // raggi della parete al pelo dell'acqua (gli shader li allargano o stringono con uTaper)
    u.uTaper.value = taper
    u.uROut.value = cone ? g.r_bot + taper * u.uWaterY.value : g.r_out ?? 0.037
    u.uRIn.value = cone ? u.uROut.value - g.wall : g.r_in ?? 0.0348
    u.uBowl.value.set(g.bowl_r ?? 0, g.sag ?? 0)
    u.uPunt.value.set(g.punt_r ?? 0, g.punt_d ?? 0)
    // bollicine: [angolo, quota, raggio] per ognuna, in fila
    const b = g.bubbles ?? []
    u.uBubbles.value.forEach((v, i) => (i * 3 + 2 < b.length ? v.set(b[i * 3], b[i * 3 + 1], b[i * 3 + 2], 0) : v.set(0, 0, 0, 0)))
    this.waterY = u.uWaterY.value
    this.aboveWater.constant = -this.waterY
    this.belowWater.constant = this.waterY
    this.glassInfo = {
      // ingombro: il raggio piu' grande (al bordo); rIn al pelo dell'acqua
      rOut: cone ? g.r_top : u.uROut.value,
      rIn: u.uRIn.value,
      rBase: cone ? g.r_bot : u.uROut.value,
      taper,
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
        // la profondita' del vetro lontano dice alla lente dove lo strato posteriore mostra il
        // bicchiere stesso: attraverso l'acqua li' si vede lo studio, non il retro del vetro
        depthWrite: true,
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
    // bicchiere renderizzato da Blender (studio scuro): inclinazioni e campo delle immagini
    // (quote della bollicina piu' bassa e della piu' alta: fuori da li' lo shader non le cerca)
    const by = b.filter((_, i) => i % 3 === 1)
    const bubbleY = by.length ? [Math.min(...by), Math.max(...by)] : [1, 0]
    this.impMeta = g.imp_n
      ? { e0: g.imp_e0, step: g.imp_step, n: g.imp_n, w: g.imp_w, h: g.imp_h, cy: g.imp_cy, lip: g.rim ?? 0.00125, bubbleY }
      : null
    this.wantImpostor()
  }

  /**
   * Studio scuro: scarica (una volta) le immagini del bicchiere renderizzato (vetro/<studio>/) e
   * prepara il quadro su cui si disegnano. resolveUrl(file): indirizzo di un file dei modelli (lo
   * imposta il motore).
   */
  wantImpostor() {
    const m = this.impMeta
    const set = this.studioKind
    if (set === 'dark' || !set || !m || this.impSet === set) return
    // un altro studio: via le immagini dell'altro (si torna al vetro calcolato finche' non arrivano)
    this.dropImpostor()
    this.impSet = set
    const url = this.resolveUrl ?? ((file) => `/models/nutrexlab/${file}`)
    const small = this.quality.tier === 'low' ? '_m' : ''
    const files = Array.from({ length: m.n }, (_, k) => `vetro/${set}/vetro_e${String(Math.round(m.e0 + m.step * k)).padStart(2, '0')}${small}.webp`)
    // decodifica fuori dal thread principale; alfa non premoltiplicata, righe dal basso come le texture
    const loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' })
    const job = (this.impLoading = Promise.all(files.map((f) => loader.loadAsync(url(f)))).then((bitmaps) => {
      if (this.disposed || this.impLoading !== job) return bitmaps.forEach((b) => b.close?.())
      this.impTextures = bitmaps.map((b) => {
        const t = new THREE.Texture(b)
        t.colorSpace = THREE.SRGBColorSpace
        t.flipY = false
        t.premultiplyAlpha = false
        t.minFilter = THREE.LinearMipmapLinearFilter
        t.generateMipmaps = true
        t.anisotropy = 4
        t.needsUpdate = true
        return t
      })
      const deg = Math.PI / 180
      const mat = this.material({
        vertexShader: impostorVertex,
        fragmentShader: impostorFragment(m.n),
        uniforms: {
          tImp: { value: this.impTextures },
          uImpE0: { value: m.e0 * deg },
          uImpStep: { value: m.step * deg },
          uImpFrame: { value: new THREE.Vector3(m.w, m.h, m.cy) },
          uImpLip: { value: m.lip },
          uBubbleY: { value: new THREE.Vector2(m.bubbleY[0], m.bubbleY[1]) },
        },
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
      // quadro rivolto alla camera, piu' grande del bicchiere visto da qualunque parte
      this.impostor = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), mat)
      this.impostor.position.set(0, m.cy, 0)
      this.impostor.frustumCulled = false
      this.over.add(this.impostor)
      this.applyStudio()
    }))
    job.catch(() => {}) // (senza immagini resta il vetro calcolato)
  }

  /** Libera le immagini del bicchiere renderizzato (cambio di studio, fine). */
  dropImpostor() {
    for (const t of this.impTextures ?? []) {
      t.image?.close?.()
      t.dispose()
    }
    this.impTextures = null
    if (this.impostor) {
      this.over.remove(this.impostor)
      this.impostor.geometry.dispose()
      this.impostor.material.dispose()
      this.impostor = null
    }
    this.impLoading = null
    this.impSet = null
  }

  /** Bicchiere renderizzato pronto per lo studio attuale? Allora niente vetro calcolato. */
  get impostorOn() {
    return !!this.impostor && this.impSet === this.studioKind
  }

  applyStudio() {
    const on = this.impostorOn
    for (const o of [this.lens, this.glassBack, this.water]) if (o) o.visible = !on
    // la polvere dentro il bicchiere (anche sopra l'acqua) va nello strato interno, che il bicchiere
    // renderizzato mostra sopra la sua immagine
    this.u.uGlassInside.value = on ? 1 : 0
  }

  /**
   * Il quadro del bicchiere renderizzato rivolto alla camera. Le immagini sono tutte nello shader:
   * ogni pixel prende le due con l'inclinazione del suo raggio, anche nei primi piani in cui dall'alto
   * al basso del bicchiere l'inclinazione cambia di molti gradi (nessun pixel con un'immagine che
   * cambia di colpo quando la camera si muove).
   */
  updateImpostor(cam) {
    this.impostor.quaternion.copy(cam.quaternion)
  }

  /**
   * Colori dello studio dal tema del prodotto (fondo quasi nero tinto, alone, nuvola). Con
   * studio: 'scuro' lo studio del render di Blender, con il bicchiere renderizzato: piano illuminato
   * attorno al bicchiere (pool * poolGain, raggio poolR), ombra lunga verso destra-davanti, riflessi
   * dalla stanza della foto, niente vignettatura.
   */
  setTheme(t) {
    const u = this.u
    const kind = t.studio === 'scuro' ? 'scuro' : 'dark'
    const photo = kind !== 'dark'
    u.uBgLow.value.set(t.bgLow)
    u.uBgGlow.value.set(t.bgGlow)
    u.uPool.value.set(t.pool).multiplyScalar(t.poolGain ?? 1)
    u.uPoolR.value = t.poolR ?? 0.24
    // immagine finale: i toni scuri fino al punto del nero diventano neri (studio scuro: fondo nero)
    u.uBlack.value = t.blackPoint ?? 0
    u.uCloudColor.value.set(t.cloud)
    u.uPhoto.value = photo ? 1 : 0
    this.keyShadow ??= u.uShadowDir.value.clone()
    if (photo) u.uShadowDir.value.set(0.36, 0.93).normalize()
    else u.uShadowDir.value.copy(this.keyShadow)
    // (studi della foto: niente vignettatura, come nel render; il bicchiere si disegna dopo)
    this.outputMaterial.uniforms.uVignette.value = photo ? 0 : 0.5
    this.clearColor.set(t.bgLow)
    // ambiente dei riflessi dell'altro studio: stessa misura, cambia solo la texture
    if (this.lighting.rebuild(kind)) {
      u.envMap.value = this.lighting.envTexture
      this.back.environment = this.lighting.envTexture
      this.inside.environment = this.lighting.envTexture
    }
    this.lighting.setTheme(t.rim, kind)
    this.studioKind = kind
    this.wantImpostor()
    this.applyStudio()
  }

  // ---------------------------------------------------------------------------
  resize(width, height) {
    this.size = { w: width, h: height }
    const r = this.renderer
    // il buffer di disegno si rifa' solo se la misura cambia davvero (ogni volta la GPU va aspettata);
    // un solo cambio, non due (setPixelRatio + setSize ne facevano uno intermedio)
    const c = this.canvas
    if (c.width !== Math.max(1, Math.floor(width * this.dpr)) || c.height !== Math.max(1, Math.floor(height * this.dpr))) {
      r.setDrawingBufferSize(width, height, this.dpr)
    }
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
    this.u.uInvViewProj.value.copy(this.u.uViewProj.value).invert()

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
    // studio scuro: il bicchiere renderizzato, sopra lo schermo (i suoi pixel restano quelli del render)
    if (this.impostorOn) {
      this.updateImpostor(cam)
      r.render(this.over, cam)
    }
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
   * pause (facoltativa): attesa tra una passata e l'altra. Preparare i programmi di una passata
   * costa qualche ms di JavaScript (decine su un telefono): uno per fotogramma.
   */
  async warmup(pause = null) {
    const r = this.renderer
    // studio scuro: prima le immagini del bicchiere (scaricate mentre si preparava il resto)
    if (this.impLoading) await this.impLoading.catch(() => {})
    const compile = (scene, camera, target) => {
      r.setRenderTarget(target)
      const job = r.compileAsync ? r.compileAsync(scene, camera) : (r.compile(scene, camera), null)
      r.setRenderTarget(null)
      return job
    }
    const passes = [
      () => compile(this.inside, this.camera, this.insideRT),
      () => compile(this.back, this.camera, this.backRT),
      () => compile(this.front, this.camera, this.mainRT),
      () => {
        this.quad.material = this.copyMaterial
        return compile(this.screen, this.screenCamera, this.mainRT)
      },
      // (stesso quad: la seconda passata va compilata dopo aver ripreso il materiale)
      () => {
        this.quad.material = this.outputMaterial
        return compile(this.screen, this.screenCamera, null)
      },
      () => (this.impostor ? compile(this.over, this.camera, null) : null),
    ]
    // il browser le compila in parallelo (KHR_parallel_shader_compile) mentre si avviano le altre
    const jobs = []
    for (const pass of passes) {
      if (jobs.length && pause) await pause()
      jobs.push(pass())
    }
    await Promise.all(jobs)
  }

  /**
   * Primo uso della GPU a piccoli pezzi, da eseguire uno per fotogramma prima di mostrare il canvas:
   * buffer intermedi (texture e framebuffer, MSAA compreso), poi gli strati uno alla volta (caricano
   * geometrie, particelle e texture). Al primo fotogramma vero non resta niente da preparare.
   */
  primeSteps() {
    const r = this.renderer
    const pass = (scene, target) => () => {
      r.setRenderTarget(target)
      r.render(scene, this.camera)
      r.setRenderTarget(null)
    }
    return [
      () => {
        for (const rt of [this.insideRT, this.backRT, this.mainRT]) r.initRenderTarget(rt)
        r.initTexture(this.u.uEtch.value)
      },
      pass(this.inside, this.insideRT),
      pass(this.back, this.backRT),
      pass(this.front, this.mainRT),
      // immagini del bicchiere renderizzato: una per passo (caricarle sulla GPU costa qualche ms)
      ...(this.impTextures ?? []).map((t) => () => r.initTexture(t)),
    ]
  }

  dispose() {
    // (anche a meta' preparazione: init() puo' non esserci ancora stato)
    this.disposed = true
    this.dropImpostor()
    for (const rt of [this.backRT, this.insideRT, this.mainRT]) rt?.dispose()
    this.copyMaterial?.dispose()
    this.lighting?.dispose()
    for (const s of [this.back, this.inside, this.front, this.screen, this.over]) {
      s.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) [].concat(o.material).forEach((m) => m.dispose())
      })
    }
    this.outputMaterial?.dispose()
    this.renderer.dispose()
    // libera subito il contesto WebGL (in un'app a pagina singola i contesti aperti sono pochi)
    this.renderer.forceContextLoss()
  }
}
