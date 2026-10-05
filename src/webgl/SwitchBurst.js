import * as THREE from 'three'
import gsap from 'gsap'

/*
  Esplosione di particelle colorate al cambio prodotto (desktop, nella hero). Quando il nuovo
  barattolo arriva, dal suo contorno partono scintille ed esagoni (come il logo) nei colori del
  prodotto: si allontanano di poco, alcuni davanti e alcuni dietro al barattolo, rallentano e
  spariscono restandogli attorno.
  Il moto di ogni particella e' calcolato nello shader dal tempo trascorso (nessun lavoro per
  particella sulla CPU). Misure in altezze di barattolo: il gruppo e' scalato come il barattolo
  e rivolto alla camera.
*/

const DURATION = 1.6 // secondi: poi tutto torna invisibile

const particleVertex = /* glsl */ `
uniform float uTime;
uniform float uScale; // px per metro a distanza 1
uniform float uUnit; // metri per altezza di barattolo
uniform vec2 uAxis; // coseno e seno dell'inclinazione del barattolo sullo schermo
uniform vec2 uEll; // semiassi del contorno del barattolo sullo schermo (altezze)
uniform vec3 uPal[7];
attribute vec4 aDir; // x deviazione (rad), y velocita' in profondita', z scarto dal contorno, w ritardo (s)
attribute vec4 aMove; // x velocita' (altezze/s), y attrito, z -, w durata (s)
attribute vec4 aLook; // x dimensione (altezze), y tipo (0 scintilla, 1 esagono), z colore, w caso
attribute vec2 aStart; // x angolo sul contorno, y profondita' di partenza
varying vec3 vColor;
varying float vAlpha;
varying float vType;
varying float vSpin;
void main() {
  float t = uTime - aDir.w;
  float life = aMove.w;
  vAlpha = 0.0;
  vType = aLook.y;
  vSpin = 0.0;
  vColor = vec3(0.0);
  if (t <= 0.0 || t >= life) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  // punto di partenza sul contorno del barattolo e direzione verso l'esterno (normale all'ellisse)
  vec2 e = vec2(cos(aStart.x) * uEll.x, sin(aStart.x) * uEll.y);
  vec2 n = normalize(vec2(cos(aStart.x) / uEll.x, sin(aStart.x) / uEll.y));
  float cj = cos(aDir.x);
  float sj = sin(aDir.x);
  n = mat2(cj, sj, -sj, cj) * n;
  mat2 R = mat2(uAxis.x, uAxis.y, -uAxis.y, uAxis.x);
  float k = aMove.y;
  float d = aMove.x * (1.0 - exp(-k * t)) / k;
  vec3 P = vec3(R * (e + n * (aDir.z + d)), aStart.y + aDir.y * d);
  if (aLook.y > 0.5) P.y -= 0.18 * t * t; // gli esagoni ricadono piano
  vec4 mv = modelViewMatrix * vec4(P, 1.0);
  gl_Position = projectionMatrix * mv;
  float u = t / life;
  gl_PointSize = uScale * aLook.x * (1.0 - 0.5 * u) * uUnit / -mv.z;
  vColor = uPal[int(aLook.z + 0.5)];
  float a = smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.4, 1.0, u));
  if (aLook.y < 0.5) a *= 0.7 + 0.3 * sin(uTime * 38.0 + aLook.w * 40.0); // le scintille brillano
  vAlpha = a;
  vSpin = aLook.w * 6.2832 + t * (2.5 + aLook.w * 6.0);
}
`

const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vType;
varying float vSpin;
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
void main() {
  if (vAlpha < 0.003) discard;
  vec2 q = gl_PointCoord - 0.5;
  float a;
  vec3 col = vColor;
  if (vType < 0.5) {
    // scintilla con il nucleo chiaro
    float d = length(q);
    a = smoothstep(0.5, 0.1, d);
    col = mix(vColor, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.6);
  } else {
    // esagono (come il logo) che ruota su se stesso, con la luce in alto
    float c = cos(vSpin);
    float s = sin(vSpin);
    q = mat2(c, -s, s, c) * q;
    a = 1.0 - smoothstep(-0.02, 0.03, sdHex(q, 0.34));
    col *= 0.85 + 0.3 * smoothstep(0.15, -0.3, q.y);
  }
  a *= vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}
`

const rand = (a, b) => a + Math.random() * (b - a)

export class SwitchBurst {
  constructor(stage, { count = 900 } = {}) {
    this.stage = stage
    this.t = DURATION
    this.active = false
    this.warm = 3 // primi frame visibili (ma trasparenti) per compilare lo shader subito
    this._axis = new THREE.Vector3()
    this._q = new THREE.Quaternion()

    const dir = new Float32Array(count * 4)
    const move = new Float32Array(count * 4)
    const look = new Float32Array(count * 4)
    const start = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const spark = Math.random() < 0.55
      // partenze sparse attorno al contorno e velocita' diverse: uno scoppio, non un anello
      dir.set([rand(-0.5, 0.5), rand(-0.4, 0.4), rand(-0.05, 0.12), spark ? rand(0, 0.08) : rand(0.02, 0.14)], i * 4)
      // restano attorno al barattolo: si fermano entro mezza altezza dal contorno
      if (spark) move.set([rand(0.6, 2.3), rand(4.0, 5.5), 0, rand(0.55, 1.0)], i * 4)
      else move.set([rand(0.5, 1.6), rand(3.0, 4.0), 0, rand(0.9, 1.5)], i * 4)
      look.set([spark ? rand(0.009, 0.02) : rand(0.02, 0.04), spark ? 0 : 1, Math.floor(Math.random() * 7), Math.random()], i * 4)
      start.set([Math.random() * Math.PI * 2, rand(-0.2, 0.2)], i * 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 4))
    g.setAttribute('aMove', new THREE.BufferAttribute(move, 4))
    g.setAttribute('aLook', new THREE.BufferAttribute(look, 4))
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 2))
    this.u = {
      uTime: { value: 1e3 },
      uScale: { value: 1 },
      uUnit: { value: 0.122 },
      uAxis: { value: new THREE.Vector2(1, 0) },
      uEll: { value: new THREE.Vector2(0.3, 0.5) },
      uPal: { value: Array.from({ length: 7 }, () => new THREE.Color()) },
    }
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.u,
        vertexShader: particleVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
      }),
    )
    this.points.frustumCulled = false
    this.points.renderOrder = 3
    // gruppo rivolto alla camera, centrato sul barattolo
    this.face = new THREE.Group()
    this.face.add(this.points)
    stage.scene.add(this.face)
  }

  resize(bufferHeight, fovDeg) {
    this.u.uScale.value = bufferHeight / (2 * Math.tan((fovDeg * Math.PI) / 360))
  }

  /** Esplosione nei colori del tema del prodotto appena arrivato. */
  fire(theme) {
    const pal = this.u.uPal.value
    const colors = [theme.ribbon[1], theme.ribbon[2], theme.drop, theme.powder[0], theme.powder[2], theme.powder[4], theme.edge]
    colors.forEach((hex, i) => pal[i].set(hex))
    this.t = 0
    this.active = true
    this.face.visible = true
    this.update(0)
  }

  /** Contorno del barattolo sullo schermo: inclinazione dell'asse e semiassi (in altezze). */
  outline() {
    const s = this.stage
    const axis = this._axis.set(0, 1, 0).applyQuaternion(s.pivot.quaternion)
    axis.applyQuaternion(this._q.copy(s.camera.quaternion).invert())
    const len = Math.hypot(axis.x, axis.y) || 1
    const ang = Math.atan2(-axis.x, axis.y)
    this.u.uAxis.value.set(Math.cos(ang), Math.sin(ang))
    const rad = (0.5 * s.jarW) / s.jarH
    // inclinato verso la camera si vedono anche il tappo e il fondo: il contorno si allunga un poco
    this.u.uEll.value.set(rad * 1.04 + 0.015, 0.5 * len + rad * Math.abs(axis.z) * 0.8 + 0.015)
  }

  update(dt) {
    if (!this.active) {
      if (this.warm > 0 && --this.warm === 0) this.face.visible = false
      return
    }
    this.t += dt * gsap.globalTimeline.timeScale() // segue il tempo delle animazioni (anche se rallentato)
    const s = this.stage
    const unit = s.jarH * s.pivot.scale.x // il barattolo cresce mentre arriva: l'esplosione con lui
    this.face.scale.setScalar(unit)
    this.face.quaternion.copy(s.camera.quaternion)
    this.outline()
    this.u.uTime.value = this.t
    this.u.uUnit.value = unit
    if (this.t > DURATION) {
      this.active = false
      this.face.visible = false
      this.u.uTime.value = 1e3
    }
  }
}
