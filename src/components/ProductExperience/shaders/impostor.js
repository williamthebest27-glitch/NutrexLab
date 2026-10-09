import { PROJECT, GLASS } from './chunks.js'

/*
  Bicchiere renderizzato (studio scuro): vetro, acqua e logo inciso non si calcolano qui, sono le
  immagini del render di Blender (sezione bicchiere/blender/bicchiere_3d.py --impostor), una per
  inclinazione della camera, riprese con raggi paralleli nello studio del render. Il bicchiere e' tondo: per ogni pixel
  conta solo da quanto in alto arriva il raggio. Si prende il punto del bicchiere che il raggio
  incontra per primo (parete esterna, superficie dell'acqua o parete interna dall'alto), lo si ruota
  sull'azimut del raggio e lo si cerca nelle due immagini con l'inclinazione piu' vicina (5 immagini
  attorno a quella della camera: uImpE0 e' l'inclinazione della prima, uImpStep il passo).

  Sopra le immagini (gia' in spazio schermo, dopo il tone mapping: i pixel restano quelli del
  render) solo quello che entra nel bicchiere: lo strato interno (polvere in acqua, rifratta come
  farebbe l'acqua; sopra l'acqua, dietro la parete sottile, senza spostamento) e l'acqua che si
  intorbida. Un oggetto davanti al bicchiere (profondita' dello strato posteriore) resta davanti.
*/

export const impostorVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const impostorFragment = /* glsl */ `
#include <common>
#include <tonemapping_pars_fragment>
${PROJECT}
${GLASS}
uniform sampler2D tImp0;
uniform sampler2D tImp1;
uniform sampler2D tImp2;
uniform sampler2D tImp3;
uniform sampler2D tImp4;
uniform float uImpE0;          // inclinazione della prima immagine (rad)
uniform float uImpStep;        // passo tra le immagini (rad)
uniform vec3 uImpFrame;        // larghezza, altezza del campo (m), quota del centro
uniform sampler2D tDepth;
uniform sampler2D tInside;
uniform vec2 uViewport;
uniform float uCloud;
uniform vec3 uCloudColor;
uniform vec3 uKeyDir;
varying vec3 vWorld;

vec3 pe_srgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

/** Punto P nell'immagine k: proiezione parallela lungo il raggio con inclinazione e. */
vec2 pe_impUv(vec3 Q, float e) {
  return vec2(Q.x / uImpFrame.x, (Q.y * cos(e) - Q.z * sin(e)) / uImpFrame.y) + 0.5;
}

void main() {
  vec3 O = cameraPosition;
  vec3 d = normalize(vWorld - O);

  // primo punto del bicchiere sul raggio
  float region = 0.0;   // 1 parete esterna, 2 acqua dall'alto, 3 parete interna dall'alto
  vec3 P;
  float tF = pe_cylIn(O, d, uROut);
  vec3 H = O + d * tF;
  if (tF < 1e8 && H.y >= 0.0 && H.y <= uHeight) {
    P = H;
    region = 1.0;
  } else if (d.y < -1e-4) {
    vec3 T = O + d * ((uHeight - O.y) / d.y);
    if (length(T.xz) < pe_rOut(uHeight)) {
      vec3 Wp = O + d * ((uWaterY - O.y) / d.y);
      if (length(Wp.xz) < pe_rIn(uWaterY)) {
        P = Wp;
        region = 2.0;
      } else {
        P = T + d * pe_cylOut(T, d, uRIn);
        region = 3.0;
      }
    }
  }
  if (region < 0.5) {
    // fuori: il punto del raggio piu' vicino all'asse (il bordo sfumato viene dalla maschera)
    float a = dot(d.xz, d.xz);
    P = O + d * (a > 1e-9 ? -dot(O.xz, d.xz) / a : 0.0);
  } else {
    // un oggetto davanti al bicchiere resta davanti
    vec4 cp = uViewProj * vec4(P, 1.0);
    float zP = cp.z / cp.w * 0.5 + 0.5;
    if (textureLod(tDepth, gl_FragCoord.xy / uViewport, 0.0).r < zP - 2e-5) discard;
  }

  // il punto ruotato sull'azimut del raggio (le immagini guardano verso -z), rispetto al centro
  float phi = atan(-d.x, -d.z);
  float c = cos(phi);
  float s = sin(phi);
  vec3 Q = vec3(c * P.x - s * P.z, P.y - uImpFrame.z, s * P.x + c * P.z);
  float e = asin(clamp(-d.y, -1.0, 1.0));
  float f = clamp((e - uImpE0) / uImpStep, 0.0, 4.0);
  float w0 = max(0.0, 1.0 - abs(f));
  float w1 = max(0.0, 1.0 - abs(f - 1.0));
  float w2 = max(0.0, 1.0 - abs(f - 2.0));
  float w3 = max(0.0, 1.0 - abs(f - 3.0));
  float w4 = max(0.0, 1.0 - abs(f - 4.0));
  vec4 im = texture2D(tImp0, pe_impUv(Q, uImpE0)) * w0
          + texture2D(tImp1, pe_impUv(Q, uImpE0 + uImpStep)) * w1
          + texture2D(tImp2, pe_impUv(Q, uImpE0 + 2.0 * uImpStep)) * w2
          + texture2D(tImp3, pe_impUv(Q, uImpE0 + 3.0 * uImpStep)) * w3
          + texture2D(tImp4, pe_impUv(Q, uImpE0 + 4.0 * uImpStep)) * w4;
  if (im.a < 0.002) discard;
  vec3 col = im.rgb;   // (alfa non premoltiplicata: ai bordi il colore e' lo studio del render)

  // dentro il bicchiere: lo strato interno e l'acqua torbida
  if (region > 0.5) {
    vec2 uvIn = gl_FragCoord.xy / uViewport;
    float path = 0.0;
    bool water = false;
    if (region > 1.5 && region < 2.5) {
      // acqua vista dall'alto: la polvere che cade e quella appena sotto il pelo, al loro posto
      path = 0.03;
      water = true;
    } else if (region < 1.5 && P.y < uWaterY && P.y > uBase) {
      // acqua attraverso la parete: come la lente del bicchiere (vetro, poi acqua)
      vec3 N = pe_wallN(P);
      vec3 T1 = refract(d, N, 1.0 / 1.5);
      float tc = pe_cylIn(P, T1, uRIn);
      if (tc < 1e8) {
        vec3 Pin = P + T1 * tc;
        vec3 T2 = refract(T1, pe_wallN(Pin), 1.5 / 1.333);
        float tw = pe_cylOut(Pin, T2, uRIn);
        float tb = T2.y < -1e-5 ? (uBase - Pin.y) / T2.y : 1e9;
        float ts = T2.y > 1e-5 ? (uWaterY - Pin.y) / T2.y : 1e9;
        path = min(tw, min(tb, ts));
        uvIn = pe_uv(Pin + T2 * (path * 0.5));
        water = Pin.y < uWaterY;
      }
    }
    vec4 ins = textureLod(tInside, clamp(uvIn, vec2(0.002), vec2(0.998)), 0.0);
    if (ins.a > 0.001) col = AgXToneMapping(ins.rgb) + col * (1.0 - ins.a);
    if (water && uCloud > 0.0) {
      // intorbidamento mentre la polvere si scioglie: lattiginoso, piu' chiaro verso la luce
      float cloud = 1.0 - exp(-uCloud * path * 34.0);
      float lit = 0.6 + 0.4 * max(dot(-d, uKeyDir), 0.0);
      col = mix(col, AgXToneMapping(uCloudColor * lit * 0.6), cloud);
    }
  }
  float a = clamp(im.a, 0.0, 1.0);
  gl_FragColor = vec4(pe_srgb(col) * a, a);
}
`
