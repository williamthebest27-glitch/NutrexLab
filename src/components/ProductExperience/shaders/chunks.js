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
 * Geometria del bicchiere (cilindro verticale centrato sull'origine) e del fondale.
 * pe_cylIn / pe_cylOut: distanza lungo il raggio fino alla superficie del cilindro di raggio r,
 * entrando da fuori / uscendo da dentro (1e9 se non la incontra).
 */
export const GLASS = /* glsl */ `
uniform float uROut;
uniform float uRIn;
uniform float uBase;
uniform float uHeight;
uniform float uWaterY;
uniform float uWallZ;
float pe_cylIn(vec3 o, vec3 d, float r) {
  float a = dot(d.xz, d.xz);
  if (a < 1e-9) return 1e9;
  float b = dot(o.xz, d.xz);
  float c = dot(o.xz, o.xz) - r * r;
  float h = b * b - a * c;
  if (h < 0.0) return 1e9;
  float t = (-b - sqrt(h)) / a;
  return t > 1e-6 ? t : 1e9;
}
float pe_cylOut(vec3 o, vec3 d, float r) {
  float a = dot(d.xz, d.xz);
  if (a < 1e-9) return 1e9;
  float b = dot(o.xz, d.xz);
  float c = dot(o.xz, o.xz) - r * r;
  float h = max(b * b - a * c, 0.0);
  return max((-b + sqrt(h)) / a, 0.0);
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
/** Alone morbido dietro al bicchiere: un ellissoide 3D, continuo tra pavimento e parete. */
float pe_glow(vec3 p) {
  vec3 d = (p - vec3(0.0, 0.17, uWallZ + 0.08)) * vec3(1.0 / 0.8, 1.0 / 0.52, 1.0 / 0.95);
  return exp(-dot(d, d));
}
vec3 pe_floor(vec3 p) {
  vec2 q = p.xz;
  float r = length(q);
  vec2 pc = q - vec2(0.0, -0.03);
  float pool = exp(-dot(pc, pc) / (0.24 * 0.24));
  float far = exp(-dot(q, q) / (1.2 * 1.2));
  vec3 c = uBgLow * (0.4 + 0.6 * far) + uBgGlow * pe_glow(vec3(p.x, 0.0, p.z)) + uPool * pool;
  // ombra di contatto sotto il bordo del bicchiere
  float ao = smoothstep(uROut * 0.86, uROut * 1.5, r);
  c *= mix(0.18, 1.0, ao);
  // ombra della luce principale (alto a sinistra, davanti): verso destra-dietro
  vec2 sd = normalize(uShadowDir);
  vec2 sp = vec2(dot(q, sd), dot(q, vec2(-sd.y, sd.x)));
  float u = sp.x - uROut * 0.9;
  float len = 0.1;
  float shadow = exp(-pow(sp.y / (uROut * 1.05), 2.0)) * smoothstep(-uROut, 0.0, u) * exp(-max(u, 0.0) / len);
  c *= 1.0 - 0.55 * shadow;
  // caustica: macchia di luce concentrata dall'acqua dentro l'ombra, che vibra con la superficie
  float wob = 0.7 + 0.3 * sin(uTime * 1.7 + sp.y * 260.0) * sin(uTime * 1.1 + sp.x * 170.0);
  float core = exp(-pow(sp.y / (uROut * 0.16), 2.0) - pow((u - 0.03) / 0.028, 2.0));
  float halo = exp(-pow(sp.y / (uROut * 0.5), 2.0) - pow((u - 0.034) / 0.045, 2.0));
  c += uCausticColor * uCaustic * (core * wob + halo * 0.2);
  return c;
}
vec3 pe_wall(vec3 p) {
  float far = exp(-(p.x * p.x) / (1.2 * 1.2)) * smoothstep(1.6, 0.0, p.y);
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

/** Uscita in HDR lineare verso lo schermo: esposizione, tone mapping del renderer, sRGB, dithering. */
export const OUTPUT = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
`
