import { OUTPUT } from './chunks.js'

/*
  Passate a tutto schermo.
  COPY:   strato posteriore -> immagine principale (HDR lineare), con FXAA se lo strato non ha MSAA.
  OUTPUT: immagine principale sullo schermo, con vignettatura leggera, tone mapping del renderer,
          sRGB e dithering (niente bande nei neri).
*/

export const screenVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const copyFragment = /* glsl */ `
uniform sampler2D tBack;
uniform vec2 uTexel;
uniform float uFxaa;
varying vec2 vUv;
// lettura senza derivate: i campioni dentro i rami non costringono ad appiattirli (ANGLE / DirectX)
#define pe_back(uv) textureLod(tBack, uv, 0.0)

float pe_luma(vec3 c) { return sqrt(dot(c, vec3(0.299, 0.587, 0.114))); }

vec3 pe_fxaa(vec2 uv) {
  vec3 cM = pe_back(uv).rgb;
  vec3 cN = pe_back(uv + vec2(0.0, uTexel.y)).rgb;
  vec3 cS = pe_back(uv - vec2(0.0, uTexel.y)).rgb;
  vec3 cE = pe_back(uv + vec2(uTexel.x, 0.0)).rgb;
  vec3 cW = pe_back(uv - vec2(uTexel.x, 0.0)).rgb;
  float lM = pe_luma(cM), lN = pe_luma(cN), lS = pe_luma(cS), lE = pe_luma(cE), lW = pe_luma(cW);
  float lo = min(lM, min(min(lN, lS), min(lE, lW)));
  float hi = max(lM, max(max(lN, lS), max(lE, lW)));
  if (hi - lo < max(0.03, hi * 0.12)) return cM;
  // sfuma lungo il bordo (perpendicolare al gradiente di luminosita')
  vec2 grad = vec2(lE - lW, lN - lS);
  vec2 dir = normalize(vec2(-grad.y, grad.x) + 1e-6) * uTexel;
  vec3 a = 0.5 * (pe_back(uv - dir * 0.6).rgb + pe_back(uv + dir * 0.6).rgb);
  return mix(cM, a, 0.75);
}

void main() {
  gl_FragColor = vec4(uFxaa > 0.5 ? pe_fxaa(vUv) : pe_back(vUv).rgb, 1.0);
}
`

export const outputFragment = /* glsl */ `
#include <common>
#include <dithering_pars_fragment>
uniform sampler2D tMain;
uniform float uVignette;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMain, vUv).rgb;
  vec2 v = (vUv - 0.5) * vec2(1.0, 0.82);
  c *= mix(1.0 - uVignette, 1.0, smoothstep(0.78, 0.18, length(v)));
  gl_FragColor = vec4(c, 1.0);
  ${OUTPUT}
}
`
