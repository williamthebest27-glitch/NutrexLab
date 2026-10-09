import { NOISE, ENV, PROJECT, GLASS, STUDIO } from './chunks.js'

/*
  Superficie dell'acqua (disco con menisco da glass.glb), nello strato posteriore.
  Increspature: fino a 4 sorgenti (dove cade la polvere, dove entra la capsula) con un'ampiezza
  guidata dallo scroll e una fase che scorre nel tempo reale, piu' un moto di fondo quasi fermo.
  Dall'alto si vede: riflesso dello studio (Fresnel dell'acqua), il contenuto subito sotto
  (tInside) e, attraverso acqua e fondo spesso del bicchiere, il pavimento con la caustica.
*/

export const waterVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const waterFragment = /* glsl */ `
#include <common>
${NOISE}
${ENV}
${PROJECT}
${GLASS}
${STUDIO}
uniform sampler2D tInside;
uniform vec4 uRipples[4];      // xz sorgente, fase iniziale, ampiezza
uniform float uAmbient;        // moto di fondo
uniform float uCloud;
uniform vec3 uCloudColor;
uniform vec3 uWaterAbsorb;
uniform vec3 uKeyDir;
varying vec3 vWorld;
varying vec3 vNormal;

vec2 pe_waves(vec2 q) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 s = uRipples[i];
    if (s.w <= 0.0) continue;
    vec2 d = q - s.xy;
    float r = length(d) + 1e-5;
    float ph = r * 420.0 - uTime * 10.0 + s.z;
    float env = s.w * exp(-r * 38.0);
    g += env * cos(ph) * 420.0 * (d / r);
  }
  // moto di fondo: tre onde lente in direzioni diverse
  g += uAmbient * vec2(
    cos(q.x * 180.0 + uTime * 1.3) * 0.6 + cos((q.x + q.y) * 140.0 - uTime * 0.9) * 0.4,
    cos(q.y * 170.0 - uTime * 1.1) * 0.6 + cos((q.x - q.y) * 150.0 + uTime * 0.7) * 0.4
  );
  return g;
}

void main() {
  vec3 P = vWorld;
  float r = length(P.xz);
  vec3 Ng = normalize(vNormal);
  // le increspature si spengono contro il vetro (dove domina il menisco)
  vec2 g = pe_waves(P.xz) * (1.0 - smoothstep(uRIn - 0.004, uRIn - 0.0008, r));
  vec3 N = normalize(Ng + vec3(-g.x, 0.0, -g.y) * 0.0012);
  vec3 V = normalize(cameraPosition - P);
  vec3 I = -V;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  // riflette lo studio vero (parete scura con l'alone) e solo un velo delle luci
  vec3 R = reflect(I, N);
  vec3 refl = pe_studio(pe_backdropHit(P, R)) * 0.9 + pe_env(R, 0.02) * 0.22;

  vec3 T = refract(I, N, 1.0 / 1.333);
  vec4 ins = texture2D(tInside, clamp(pe_uv(P + T * 0.012), vec2(0.002), vec2(0.998)));

  // sotto: fondo del bicchiere e pavimento, oppure la parete se il raggio la incontra prima
  vec3 Nb;
  float tb = pe_bowl(P, T, Nb);
  vec3 B = P + T * tb;
  vec3 deep;
  float depth = tb;
  if (length(B.xz) < pe_rIn(B.y)) {
    // fondo interno a coppa, fondo pieno, pavimento (o l'incavo sotto il fondo)
    vec3 T3 = refract(T, Nb, 1.333 / 1.5);
    float tir;
    vec3 Fl = pe_bottomSeen(B, T3, tir);
    deep = pe_floor(Fl) * (0.85 - 0.5 * tir) + pe_env(reflect(T, Nb), 0.2) * 0.02;
  } else {
    float tw = pe_cylOut(P, T, uRIn);
    depth = tw;
    vec3 Wp = P + T * tw;
    deep = pe_studio(pe_backdropHit(Wp, T)) * 0.8 + pe_env(T, 0.1) * 0.02;
  }
  deep *= exp(-uWaterAbsorb * depth);
  vec3 under = ins.rgb + deep * (1.0 - ins.a);
  float cloud = 1.0 - exp(-uCloud * depth * 34.0);
  float lit = 0.6 + 0.4 * max(dot(-T, uKeyDir), 0.0);
  under = mix(under, uCloudColor * lit, cloud);

  vec3 c = under * (1.0 - F) + refl * F;
  // menisco: dove l'acqua sale sul vetro diventa una riga di luce
  float men = smoothstep(uRIn - 0.0018, uRIn - 0.0002, r);
  c += pe_env(reflect(I, Ng), 0.06) * men * 0.35;
  gl_FragColor = vec4(c, 1.0);
}
`
