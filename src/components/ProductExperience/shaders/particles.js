/*
  Particelle deterministiche: la posizione e' una funzione del "tempo del racconto" uT (guidato dallo
  scroll, quindi reversibile) piu' un micro-movimento nel tempo reale (la scena resta viva anche a
  scroll fermo). Nessuna simulazione: ogni frame e' ricalcolato da zero.

  Due moti, stesso shader:
  - CADUTA: la polvere lascia il labbro del misurino (aStart, aVel al momento del rilascio),
    cade con attrito, entra nell'acqua, resta un attimo a galla, affonda girando e si scioglie.
  - RILASCIO: i granelli partono gia' sott'acqua dalla superficie della capsula o della compressa
    che si dissolve (aStart sotto il pelo dell'acqua).
  REGION_BELOW: la stessa geometria e' disegnata due volte, sopra l'acqua (strato posteriore) e
  sotto (strato interno, letto dal vetro con la rifrazione).
*/

export const particleVertex = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aVel;
attribute vec4 aSeed;
attribute float aRelease;
attribute float aSize;
uniform float uT;
uniform float uTime;
uniform float uWaterY;
uniform float uRIn;
uniform float uBase;
uniform float uGravity;
uniform float uDrag;
uniform float uFlutter;
uniform float uRaft;
uniform float uSwirl;
uniform float uSink;
uniform float uSpread;
uniform vec2 uDissolve;      // durata minima / massima della dissoluzione (s del racconto)
uniform float uResidue;      // quota di granelli che non si sciolgono del tutto
uniform float uPixel;        // pixel per metro a distanza 1
uniform float uOpacity;
uniform float uLive;
varying float vAlpha;
varying float vShade;
varying float vUnder;

vec3 pe_fall(float t, vec3 p0, vec3 v0) {
  // caduta con attrito lineare: v -> velocita' limite, in forma chiusa
  float k = uDrag;
  float e = exp(-k * t);
  vec3 vt = vec3(0.0, -uGravity / k, 0.0);
  return p0 + vt * t + (v0 - vt) * (1.0 - e) / k;
}

void main() {
  float age = uT - aRelease;
  vAlpha = 0.0;
  vShade = 1.0;
  vUnder = 0.0;
  if (age <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec3 p0 = aStart;
  vec3 v0 = aVel;
  float tHit = 0.0;
  vec3 hit = p0;
  vec3 vIn = v0;
  bool fromAbove = p0.y > uWaterY;
  if (fromAbove) {
    // tempo d'impatto con il pelo dell'acqua (bisezione: la caduta con attrito non ha forma inversa)
    float lo = 0.0;
    float hi = 4.0;
    for (int i = 0; i < 14; i++) {
      float mid = 0.5 * (lo + hi);
      if (pe_fall(mid, p0, v0).y > uWaterY) lo = mid; else hi = mid;
    }
    tHit = hi;
  }
  vec3 pos;
  float under = 0.0;
  // svolazzo: i granelli fini oscillano nell'aria
  vec3 flutter = vec3(sin(age * 3.1 + aSeed.x * 40.0), 0.0, cos(age * 2.7 + aSeed.y * 40.0)) * uFlutter * aSeed.w * min(age, tHit + 0.001);
  if (fromAbove && age < tHit) {
    pos = pe_fall(age, p0, v0) + flutter;
  } else {
    float tau = age - tHit;
    if (fromAbove) {
      hit = pe_fall(tHit, p0, v0) + vec3(flutter.x, 0.0, flutter.z);
      float k = uDrag;
      vec3 vt = vec3(0.0, -uGravity / k, 0.0);
      vIn = vt + (v0 - vt) * exp(-k * tHit);
    }
    under = 1.0;
    // spinta d'ingresso che si smorza in fretta
    float kp = 3.0 + 4.0 * aSeed.x;
    vec3 plunge = vIn * (1.0 - exp(-kp * tau)) / kp;
    // a galla per un istante (la polvere si bagna), poi affonda girando e si allarga
    float wet = fromAbove ? smoothstep(0.0, uRaft * (0.3 + 1.2 * aSeed.z), tau) : 1.0;
    float sink = tau * uSink * (0.35 + aSeed.z);
    float ang = uSwirl * tau * (0.4 + 0.6 * aSeed.y);
    vec2 c = hit.xz + plunge.xz * wet;
    vec2 xz = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * c;
    float sp = uSpread * sqrt(tau) * (0.4 + aSeed.w);
    vec3 drift = vec3(sin(tau * 0.9 + aSeed.x * 23.0), 0.45 * sin(tau * 0.7 + aSeed.y * 19.0), cos(tau * 0.8 + aSeed.z * 29.0)) * sp;
    pos = vec3(xz.x, hit.y + (plunge.y - sink) * wet - 0.0004, xz.y) + drift;
    // dentro il bicchiere, sopra il fondo
    float r = length(pos.xz);
    float rMax = uRIn - 0.0016;
    if (r > rMax) pos.xz *= rMax / r;
    pos.y = clamp(pos.y, uBase + 0.0008, uWaterY - 0.0003);
    // dissoluzione graduale: ognuno con i suoi tempi, pochi restano sospesi
    float dur = mix(uDissolve.x, uDissolve.y, aSeed.z);
    float fade = 1.0 - smoothstep(dur * 0.35, dur, tau);
    if (aSeed.w > 1.0 - uResidue) fade = max(fade, 0.35);
    vAlpha = fade;
    vShade = 0.82;
  }
  if (under < 0.5) vAlpha = 1.0;
  // micro-movimento continuo nel tempo reale
  pos += vec3(sin(uTime * 0.83 + aSeed.x * 50.0), 0.6 * sin(uTime * 0.61 + aSeed.y * 50.0), cos(uTime * 0.71 + aSeed.z * 50.0))
         * (under > 0.5 ? 0.00035 : 0.00008) * uLive;

  bool inWater = pos.y < uWaterY && length(pos.xz) < uRIn;
  #ifdef REGION_BELOW
    if (!inWater) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  #else
    if (inWater) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  #endif

  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float px = aSize * uPixel / max(-mv.z, 0.01);
  // sotto il pixel: resta di un pixel ma piu' trasparente (niente sfarfallio)
  vAlpha *= clamp(px / 1.3, 0.12, 1.0) * uOpacity;
  vUnder = under;
  vShade *= 0.78 + 0.44 * aSeed.y;
  gl_PointSize = max(px, 1.3);
}
`

export const particleFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uColorWet;
varying float vAlpha;
varying float vShade;
varying float vUnder;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = smoothstep(0.5, 0.18, r) * vAlpha;
  if (a < 0.004) discard;
  // luce dall'alto a sinistra sul granello
  float lit = 0.8 + 0.35 * clamp(-d.x * 1.2 - d.y * 1.4, -0.5, 0.5);
  vec3 c = mix(uColor, uColorWet, vUnder) * vShade * lit;
  gl_FragColor = vec4(c * a, a);
}
`

/*
  Nuvola lattiginosa sott'acqua: pochi sprite grandi e morbidi che nascono dove la polvere entra,
  scendono girando, si allargano e si sciolgono fino a lasciare l'acqua limpida.
*/
export const plumeVertex = /* glsl */ `
attribute vec3 aStart;
attribute vec4 aSeed;
attribute float aRelease;
attribute float aSize;
uniform float uT;
uniform float uTime;
uniform float uWaterY;
uniform float uRIn;
uniform float uBase;
uniform float uSwirl;
uniform float uSink;
uniform float uSpread;
uniform vec2 uDissolve;
uniform float uPixel;
uniform float uOpacity;
uniform float uGrow;
varying float vAlpha;
varying vec2 vRot;
varying float vSeed;
void main() {
  float tau = uT - aRelease;
  if (tau <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; return; }
  float ang = uSwirl * tau * (0.3 + 0.5 * aSeed.y);
  vec2 xz = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * aStart.xz;
  float sp = uSpread * sqrt(tau) * (0.6 + aSeed.w);
  vec3 drift = vec3(sin(tau * 0.5 + aSeed.x * 23.0), 0.0, cos(tau * 0.45 + aSeed.z * 29.0)) * sp;
  float depth = (1.0 - exp(-tau * 1.6)) * (0.004 + 0.012 * aSeed.x) + tau * uSink * (0.3 + aSeed.z);
  vec3 pos = vec3(xz.x, aStart.y - depth, xz.y) + drift;
  pos += vec3(sin(uTime * 0.37 + aSeed.x * 9.0), 0.4 * sin(uTime * 0.29 + aSeed.y * 9.0), cos(uTime * 0.33 + aSeed.z * 9.0)) * 0.0008;
  float r = length(pos.xz);
  float rMax = uRIn - 0.004;
  if (r > rMax) pos.xz *= rMax / r;
  pos.y = clamp(pos.y, uBase + 0.004, uWaterY - 0.002);
  float dur = mix(uDissolve.x, uDissolve.y, aSeed.w);
  float grow = 1.0 - exp(-tau * uGrow);
  vAlpha = smoothstep(0.0, 0.35, tau) * (1.0 - smoothstep(dur * 0.3, dur, tau)) * uOpacity * (0.6 + 0.4 * aSeed.y);
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = aSize * (0.25 + 0.75 * grow);
  gl_PointSize = clamp(size * uPixel / max(-mv.z, 0.01), 1.0, 512.0);
  float a = aSeed.x * 6.2831 + tau * 0.15 * (aSeed.y - 0.5);
  vRot = vec2(cos(a), sin(a));
  vSeed = aSeed.z;
}
`

export const plumeFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vAlpha;
varying vec2 vRot;
varying float vSeed;
float pe_h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pe_n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(pe_h(i), pe_h(i + vec2(1, 0)), u.x), mix(pe_h(i + vec2(0, 1)), pe_h(i + vec2(1, 1)), u.x), u.y);
}
void main() {
  vec2 d = gl_PointCoord - 0.5;
  d = mat2(vRot.x, vRot.y, -vRot.y, vRot.x) * d;
  float r = length(d);
  float fall = smoothstep(0.5, 0.0, r);
  vec2 q = d * 4.0 + vSeed * 17.0;
  float n = pe_n(q) * 0.55 + pe_n(q * 2.1 + uTime * 0.05) * 0.3 + pe_n(q * 4.3) * 0.15;
  float a = fall * fall * smoothstep(0.25, 0.85, n + fall * 0.35) * vAlpha;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor * a, a);
}
`

/* Bollicine d'aria (capsula e compressa entrano in acqua): anello luminoso con centro trasparente. */
export const bubbleVertex = /* glsl */ `
attribute vec3 aStart;
attribute vec4 aSeed;
attribute float aRelease;
attribute float aSize;
uniform float uT;
uniform float uTime;
uniform float uWaterY;
uniform float uRIn;
uniform float uPixel;
varying float vAlpha;
void main() {
  float tau = uT - aRelease;
  float rise = tau * (0.012 + 0.02 * aSeed.x);
  vec3 pos = aStart + vec3(sin(tau * 9.0 + aSeed.y * 30.0) * 0.0006, rise, cos(tau * 8.0 + aSeed.z * 30.0) * 0.0006);
  pos += vec3(sin(uTime * 7.0 + aSeed.x * 20.0), 0.0, cos(uTime * 6.0 + aSeed.y * 20.0)) * 0.00015;
  bool alive = tau > 0.0 && pos.y < uWaterY - 0.0004 && length(pos.xz) < uRIn;
  if (!alive) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; return; }
  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(aSize * uPixel / max(-mv.z, 0.01), 1.5);
  vAlpha = smoothstep(0.0, 0.08, tau) * smoothstep(uWaterY - 0.0004, uWaterY - 0.004, pos.y);
}
`

export const bubbleFragment = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float ring = smoothstep(0.62, 0.9, r) * (1.0 - smoothstep(0.9, 1.0, r));
  float spec = smoothstep(0.22, 0.0, length(d - vec2(-0.16, 0.16)));
  float a = (ring * 0.55 + spec * 0.9 + 0.04) * vAlpha;
  gl_FragColor = vec4(vec3(1.0) * a, a * 0.85);
}
`
