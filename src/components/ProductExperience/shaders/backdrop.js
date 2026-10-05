import { NOISE, ENV, GLASS, STUDIO } from './chunks.js'

/*
  Fondale curvo dello studio (pavimento che sale nella parete senza spigolo), nello strato posteriore.
  Colori in chunks.js (pe_studio). In piu' il riflesso del bicchiere sul pavimento lucido:
  il raggio riflesso dal pavimento incontra il bicchiere? Se si', una traccia dei suoi bordi
  luminosi, sfumata con la distanza (il pavimento e' satinato).
*/

export const backdropVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const backdropFragment = /* glsl */ `
#include <common>
${NOISE}
${ENV}
${GLASS}
${STUDIO}
uniform float uFloorReflect;
varying vec3 vWorld;
void main() {
  vec3 P = vWorld;
  vec3 c = pe_studio(P);
  if (P.y < 0.02 && uFloorReflect > 0.0) {
    vec3 I = normalize(P - cameraPosition);
    vec3 R = reflect(I, vec3(0.0, 1.0, 0.0));
    float t = pe_cylIn(P, R, uROut);
    if (t < 1e8) {
      vec3 H = P + R * t;
      if (H.y < uHeight) {
        // distanza del raggio dall'asse: vicino al profilo il vetro e' luminoso
        vec2 rd = normalize(R.xz);
        float b = abs(rd.x * P.z - rd.y * P.x) / uROut;
        float edge = smoothstep(0.78, 0.95, b) * (1.0 - smoothstep(0.96, 1.0, b));
        float fade = exp(-H.y / 0.035) * exp(-max(length(P.xz) - uROut, 0.0) / 0.05);
        c += (edge * 0.55 + 0.03) * pe_env(vec3(R.x, 0.3, R.z), 0.2) * fade * uFloorReflect;
      }
    }
  }
  gl_FragColor = vec4(c, 1.0);
}
`
