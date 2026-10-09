/*
  Pezzi GLSL condivisi dagli shader dell'esperienza.
  Convenzioni: metri, asse del bicchiere = Y, fondo del bicchiere a y = 0, camera verso -Z.
  Tutti i colori sono lineari (HDR): la conversione per lo schermo e' in composite.js / glass.js.
*/

/** Rumore 3D a valori (interpolazione quintica) e fbm: grana, dissolvenze, caustiche. */
export const NOISE = /* glsl */ `
float pe_hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float pe_noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(mix(pe_hash(i + vec3(0, 0, 0)), pe_hash(i + vec3(1, 0, 0)), u.x),
                 mix(pe_hash(i + vec3(0, 1, 0)), pe_hash(i + vec3(1, 1, 0)), u.x), u.y),
             mix(mix(pe_hash(i + vec3(0, 0, 1)), pe_hash(i + vec3(1, 0, 1)), u.x),
                 mix(pe_hash(i + vec3(0, 1, 1)), pe_hash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
}
float pe_fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int k = 0; k < 4; k++) {
    s += a * pe_noise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}
`

/**
 * Ambiente dello studio (PMREM, mappatura CubeUV) letto dagli shader personalizzati.
 * I define CUBEUV_* li calcola envDefines() in ProductLighting.js.
 */
export const ENV = /* glsl */ `
uniform sampler2D envMap;
uniform float uEnvIntensity;
#include <cube_uv_reflection_fragment>
vec3 pe_env(vec3 dir, float roughness) {
  return textureCubeUV(envMap, dir, roughness).rgb * uEnvIntensity;
}
`

/** Proiezione di un punto del mondo sullo schermo (uv 0..1) con la camera attuale. */
export const PROJECT = /* glsl */ `
uniform mat4 uViewProj;
vec2 pe_uv(vec3 p) {
  vec4 c = uViewProj * vec4(p, 1.0);
  return c.xy / max(c.w, 1e-5) * 0.5 + 0.5;
}
`

/**
 * Geometria del bicchiere (tronco di cono verticale centrato sull'origine, piu' largo in alto) e del
 * fondale. uROut / uRIn: raggi esterno e interno della parete al pelo dell'acqua; uTaper: di quanto
 * si allarga la parete per ogni metro di altezza (0 = cilindro).
 * pe_cylIn / pe_cylOut: distanza lungo il raggio fino alla parete che al pelo dell'acqua ha raggio r,
 * entrando da fuori / uscendo da dentro (1e9 se non la incontra). pe_wallN: normale della parete.
 * Fondo: interno a coppa (uBowl: raggio della coppa, quanto scende al centro), sotto l'incavo dello
 * stampo (uPunt: raggio, profondita'); a zero sono piani.
 */
export const GLASS = /* glsl */ `
uniform float uROut;
uniform float uRIn;
uniform float uTaper;
uniform float uBase;
uniform float uHeight;
uniform float uWaterY;
uniform float uWallZ;
uniform vec2 uBowl;
uniform vec2 uPunt;
float pe_rOut(float y) { return uROut + uTaper * (y - uWaterY); }
float pe_rIn(float y) { return uRIn + uTaper * (y - uWaterY); }
vec3 pe_wallN(vec3 p) {
  vec2 n = normalize(p.xz + vec2(1e-7, 0.0));
  return normalize(vec3(n.x, -uTaper, n.y));
}
// parete: x^2 + z^2 = (r + k (y - uWaterY))^2
float pe_cylIn(vec3 o, vec3 d, float r) {
  float k = uTaper;
  float ro = r + k * (o.y - uWaterY);
  float a = dot(d.xz, d.xz) - k * k * d.y * d.y;
  if (a < 1e-9) return 1e9;
  float b = dot(o.xz, d.xz) - k * ro * d.y;
  float c = dot(o.xz, o.xz) - ro * ro;
  float h = b * b - a * c;
  if (h < 0.0) return 1e9;
  float t = (-b - sqrt(h)) / a;
  return t > 1e-6 ? t : 1e9;
}
float pe_cylOut(vec3 o, vec3 d, float r) {
  float k = uTaper;
  float ro = r + k * (o.y - uWaterY);
  float a = dot(d.xz, d.xz) - k * k * d.y * d.y;
  if (a < 1e-9) return 1e9;
  float b = dot(o.xz, d.xz) - k * ro * d.y;
  float c = dot(o.xz, o.xz) - ro * ro;
  float h = max(b * b - a * c, 0.0);
  return max((-b + sqrt(h)) / a, 0.0);
}
/** Raggio nell'acqua che scende verso il fondo interno a coppa: distanza (1e9 se sale), normale verso l'alto. */
float pe_bowl(vec3 o, vec3 d, out vec3 n) {
  n = vec3(0.0, 1.0, 0.0);
  if (d.y > -1e-5) return 1e9;
  if (uBowl.y < 1e-6) return (uBase - o.y) / d.y;
  // calotta sferica: passa per il centro (uBase - sag) e per il bordo della coppa (uBase)
  float R = (uBowl.x * uBowl.x + uBowl.y * uBowl.y) / (2.0 * uBowl.y);
  vec3 c = vec3(0.0, uBase - uBowl.y + R, 0.0);
  vec3 oc = o - c;
  float b = dot(oc, d);
  float h = b * b - (dot(oc, oc) - R * R);
  float t = -b + sqrt(max(h, 0.0));
  n = normalize(c - (o + d * t));
  return t;
}
/**
 * Raggio dentro il fondo pieno che scende verso il piano d'appoggio: punto del pavimento che vede.
 * Nell'incavo il vetro non tocca il pavimento: il raggio esce nell'aria (rifrazione) e scende ancora.
 * tir = 1 se resta intrappolato (riflessione totale sulla calotta).
 */
vec3 pe_bottomSeen(vec3 o, vec3 d, out float tir) {
  tir = 0.0;
  float dy = min(d.y, -1e-4);
  vec3 F = o + d * (-o.y / dy);
  if (uPunt.y < 1e-6 || dot(F.xz, F.xz) > uPunt.x * uPunt.x) return F;
  float R = (uPunt.x * uPunt.x + uPunt.y * uPunt.y) / (2.0 * uPunt.y);
  vec3 c = vec3(0.0, uPunt.y - R, 0.0);
  vec3 oc = o - c;
  float b = dot(oc, d);
  float h = b * b - (dot(oc, oc) - R * R);
  if (h < 0.0) return F;
  vec3 H = o + d * (-b - sqrt(h));
  vec3 T = refract(d, normalize(H - c), 1.5);
  if (dot(T, T) < 0.01) { tir = 1.0; return F; }
  return H + T * (H.y / max(-T.y, 0.05));
}
/** Punto in cui un raggio uscito dal bicchiere incontra pavimento (y = 0) o parete di fondo. */
vec3 pe_backdropHit(vec3 o, vec3 d) {
  float tf = d.y < -1e-4 ? -o.y / d.y : 1e9;
  float tw = d.z < -1e-4 ? (uWallZ - o.z) / d.z : 1e9;
  return o + d * min(min(tf, tw), 3.0);
}
`

/**
 * Pavimento e parete dello studio, condivisi da fondale, superficie dell'acqua e bicchiere
 * (quello che si vede attraverso il fondo spesso): pozza di luce, ombra di contatto, ombra
 * proiettata con la caustica (la luce concentrata dall'acqua) e alone dietro al bicchiere.
 */
export const STUDIO = /* glsl */ `
uniform vec3 uBgLow;
uniform vec3 uBgGlow;
uniform vec3 uPool;
uniform vec3 uCausticColor;
uniform float uCaustic;
uniform float uTime;
uniform vec2 uShadowDir;
uniform float uPhoto;   // 1 = studio della foto (bicchiere renderizzato): ombra lunga, niente caustica
uniform float uPoolR;   // raggio della pozza di luce sul piano attorno al bicchiere (m)
/** Alone morbido dietro al bicchiere: un ellissoide 3D, continuo tra pavimento e parete. */
float pe_glow(vec3 p) {
  vec3 d = (p - vec3(0.0, 0.17, uWallZ + 0.08)) * vec3(1.0 / 0.8, 1.0 / 0.52, 1.0 / 0.95);
  return exp(-dot(d, d));
}
vec3 pe_floor(vec3 p) {
  vec2 q = p.xz;
  float r = length(q);
  vec2 pc = q - vec2(0.0, -0.03);
  float pool = exp(-dot(pc, pc) / (uPoolR * uPoolR));
  float far = exp(-dot(q, q) / (1.2 * 1.2));
  vec3 c = uBgLow * (0.4 + 0.6 * far) + uBgGlow * pe_glow(vec3(p.x, 0.0, p.z)) + uPool * pool;
  // ombra di contatto sotto il bordo del bicchiere (raggio alla base)
  float rB = pe_rOut(0.0);
  float ao = smoothstep(rB * mix(0.86, 0.94, uPhoto), rB * mix(1.5, 1.3, uPhoto), r);
  c *= mix(mix(0.18, 0.42, uPhoto), 1.0, ao);
  // ombra della luce principale (alto a sinistra, davanti: verso destra-dietro; studio della foto:
  // controluce alto dietro a sinistra, ombra lunga e morbida verso destra-davanti, come nel render)
  vec2 sd = normalize(uShadowDir);
  vec2 sp = vec2(dot(q, sd), dot(q, vec2(-sd.y, sd.x)));
  float u = sp.x - uROut * mix(0.9, 0.55, uPhoto);
  float len = mix(0.1, 0.12, uPhoto);
  float wide = uROut * mix(1.05, 0.95, uPhoto) * (1.0 + 0.35 * uPhoto * max(u, 0.0) / 0.1);
  float shadow = exp(-pow(sp.y / wide, 2.0)) * smoothstep(-uROut, 0.0, u) * exp(-max(u, 0.0) / len);
  c *= 1.0 - mix(0.55, 0.92, uPhoto) * shadow;
  // caustica: macchia di luce concentrata dall'acqua dentro l'ombra, che vibra con la superficie
  float wob = 0.7 + 0.3 * sin(uTime * 1.7 + sp.y * 260.0) * sin(uTime * 1.1 + sp.x * 170.0);
  float core = exp(-pow(sp.y / (uROut * 0.16), 2.0) - pow((u - 0.03) / 0.028, 2.0));
  float halo = exp(-pow(sp.y / (uROut * 0.5), 2.0) - pow((u - 0.034) / 0.045, 2.0));
  c += uCausticColor * uCaustic * (1.0 - 0.85 * uPhoto) * (core * wob + halo * 0.2);
  return c;
}
vec3 pe_wall(vec3 p) {
  // (studio della foto: la parete resta illuminata anche in alto, come il fondale del render)
  float far = exp(-(p.x * p.x) / (1.2 * 1.2)) * mix(smoothstep(1.6, 0.0, p.y), 0.9, uPhoto);
  return uBgLow * (0.4 + 0.6 * far) + uBgGlow * pe_glow(p);
}
vec3 pe_studio(vec3 p) {
  // il pavimento sale nella parete senza linea d'orizzonte
  return mix(pe_floor(vec3(p.x, 0.0, p.z)), pe_wall(p), smoothstep(0.0, 0.42, p.y));
}
`

/**
 * Il bicchiere puo' ruotare su se stesso (piatto girevole): le microimperfezioni del vetro e il logo
 * inciso a smeriglio ruotano con lui (il cilindro, perfetto, da solo non mostrerebbe la rotazione).
 * uEtchRect: angolo del centro del logo, quota del centro, mezza larghezza (rad), mezza altezza (m).
 */
export const ETCH = /* glsl */ `
uniform sampler2D uEtch;
uniform float uEtchOn;
uniform vec4 uEtchRect;
uniform float uGlassRot;
vec3 pe_glassLocal(vec3 p) {
  float c = cos(uGlassRot);
  float s = sin(uGlassRot);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
float pe_etch(vec3 p) {
  float th = atan(p.z, p.x) - uGlassRot;
  float d = mod(th - uEtchRect.x + PI, 2.0 * PI) - PI;
  vec2 uv = vec2(0.5 - d / (2.0 * uEtchRect.z), 0.5 + (p.y - uEtchRect.y) / (2.0 * uEtchRect.w));
  // senza rami attorno alla lettura (mipmap del logo): niente codice appiattito su Windows
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return texture2D(uEtch, clamp(uv, 0.0, 1.0)).r * uEtchOn * inside.x * inside.y;
}
`

/**
 * Punto del nero dell'immagine finale (studio scuro): i toni fino a uBlack (luminanza lineare: la
 * parete, il fondo e quello che se ne vede attraverso il vetro e l'acqua) diventano nero pieno; da
 * 0.3 in su (capsule, compresse, misurino, luce sul piano, luci e logo del vetro) l'immagine resta
 * quella che e'; in mezzo una curva morbida, senza scalini. In spazio schermo, dopo il tone mapping,
 * uguale per fondale, oggetti e bicchiere renderizzato. uBlack 0 = spento.
 */
export const GRADE = /* glsl */ `
uniform float uBlack;
vec3 pe_grade(vec3 c) {
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  if (uBlack <= 0.0 || L >= 0.3) return c;
  // da 0 (piatta) a uBlack fino a 0.3 (pendenza 1, come la parte che resta com'e')
  float t = max(L - uBlack, 0.0) / (0.3 - uBlack);
  float m = 1.0 - uBlack / 0.3;
  float o = 0.3 * t * t * ((3.0 - m) + (m - 2.0) * t);
  return c * (o / max(L, 1e-6));
}
`

/** Uscita in HDR lineare verso lo schermo: esposizione, tone mapping del renderer, sRGB, dithering. */
export const OUTPUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
`
