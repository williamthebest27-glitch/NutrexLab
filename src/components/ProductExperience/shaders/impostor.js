import { PROJECT, GLASS, GRADE } from './chunks.js'

/*
  Bicchiere renderizzato (studio scuro): vetro, acqua e logo inciso non si calcolano qui, sono le
  immagini del render di Blender (sezione bicchiere/blender/bicchiere_3d.py --impostor), una per
  inclinazione della camera, riprese con raggi paralleli nello studio del render. Il bicchiere e' tondo:
  per ogni pixel conta solo da quanto in alto arriva il raggio. Si ruota il raggio sul suo azimut e lo
  si cerca nelle due immagini con l'inclinazione piu' vicina (tutte e n le immagini: uImpE0 e'
  l'inclinazione della prima, uImpStep il passo), mescolate.

  Due immagini vicine vedono quello che c'e' dietro un punto da direzioni diverse (3 gradi): il punto
  cercato nelle immagini deve essere quello che il pixel mostra davvero, altrimenti cio' che sta piu'
  avanti o piu' indietro compare due volte, spostato in alto e in basso (il bordo lontano doppio, un
  secondo bicchiere sopra il primo). Quindi: sopra il bicchiere il bordo lontano, ai lati il punto
  piu' vicino all'asse, sul labbro il labbro, attraverso la parete sopra l'acqua quello che c'e'
  dentro (pelo dell'acqua, parete lontana), sotto l'acqua la parete davanti (logo inciso) e, attorno
  alle bollicine della parete lontana, la parete lontana vista attraverso l'acqua. Dove il raggio di
  una delle due immagini passa per il labbro e il nostro no (o il contrario) conta solo l'altra. Le
  immagini si leggono con il passo di un punto che scorre senza salti (nessuna riga sfocata dove il
  punto salta da davanti a dietro).

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

/** Shader del bicchiere renderizzato per n immagini (una texture per immagine: tImp[0..n-1]). */
export const impostorFragment = (n) => /* glsl */ `
#include <common>
#include <tonemapping_pars_fragment>
${PROJECT}
${GLASS}
${GRADE}
uniform sampler2D tImp[${n}];
uniform float uImpE0;          // inclinazione della prima immagine (rad)
uniform float uImpStep;        // passo tra le immagini (rad)
uniform vec3 uImpFrame;        // larghezza, altezza del campo (m), quota del centro
uniform float uImpLip;         // altezza del labbro arrotondato in cima alla parete (m)
uniform vec4 uBubbles[24];     // bollicine sulla parete interna: angolo, quota, raggio
uniform vec2 uBubbleY;
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

/** Punto Q (ruotato sull'azimut del raggio) nell'immagine con inclinazione e: proiezione parallela. */
vec2 pe_impUv(vec3 Q, float e) {
  return vec2(Q.x / uImpFrame.x, (Q.y * cos(e) - Q.z * sin(e)) / uImpFrame.y) + 0.5;
}

/** Immagine k (le texture di un array si scelgono solo con un indice costante). */
vec4 pe_imp(int k, vec2 uv, vec2 gx, vec2 gy) {
${Array.from({ length: n }, (_, k) => `  ${k ? 'else ' : ''}if (k == ${k}) return textureGrad(tImp[${k}], uv, gx, gy);`).join('\n')}
  return vec4(0.0);
}

/**
 * Dalla parete esterna H (sopra l'acqua) dentro il bicchiere: il pelo dell'acqua visto dall'alto o
 * la parete lontana (la parete sottile non sposta il raggio). Se il raggio non entra resta H.
 */
vec3 pe_inner(vec3 H, vec3 d) {
  float tIn = pe_cylIn(H, d, uRIn);
  if (tIn > 1e8) return H;
  vec3 E = H + d * tIn;
  if (E.y <= uWaterY) return E;
  float t = pe_cylOut(E, d, uRIn);
  if (d.y < -1e-5) t = min(t, (uWaterY - E.y) / d.y);
  else if (d.y > 1e-5) t = min(t, (uHeight - E.y) / d.y);
  return E + d * t;
}

/**
 * Raggio che entra dalla parete esterna in H con direzione dd: il punto della parete lontana che vede
 * attraverso vetro e acqua (rifratto).
 */
vec3 pe_farWall(vec3 H, vec3 dd) {
  vec3 T1 = refract(dd, pe_wallN(H), 1.0 / 1.5);
  float tc = pe_cylIn(H, T1, uRIn);
  if (tc > 1e8) return H;
  vec3 Pin = H + T1 * tc;
  vec3 T2 = refract(T1, pe_wallN(Pin), 1.5 / 1.333);
  return Pin + T2 * pe_cylOut(Pin, T2, uRIn);
}

/**
 * 1 se il punto F della parete interna e' su una bollicina o vicino (rot: dal mondo al riferimento
 * delle immagini, dove sono date le bollicine; uBubbleY: quote della piu' bassa e della piu' alta).
 */
float pe_nearBubble(vec3 F, mat2 rot) {
  if (F.y < uBubbleY.x - 3e-3 || F.y > uBubbleY.y + 3e-3) return 0.0;
  vec2 f = rot * F.xz;
  float th = atan(f.y, f.x);
  float r = length(f);
  float m = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 b = uBubbles[i];
    if (b.z <= 0.0) continue;
    vec2 q = vec2((mod(th - b.x + PI, 2.0 * PI) - PI) * r, F.y - b.y);
    m = max(m, 1.0 - smoothstep(b.z + 4e-4, b.z + 1e-3, length(q)));
  }
  return m;
}

/** 1 se un raggio che attraversa la parete davanti a quota y passa per il labbro, 0 se no. */
float pe_lip(float y) {
  float lo = uHeight - uImpLip * 1.5;
  return smoothstep(lo - 3e-4, lo + 3e-4, y) * (1.0 - smoothstep(uHeight + 2e-4, uHeight + 9e-4, y));
}

void main() {
  vec3 O = cameraPosition;
  vec3 d = normalize(vWorld - O);

  // primo punto del bicchiere sul raggio (P) e punto da cercare nelle immagini (S): dove sta quello
  // che il pixel mostra
  float region = 0.0;   // 1 parete esterna, 2 acqua dall'alto, 3 labbro o parete interna dall'alto
  vec3 P;
  vec3 S;
  float tF = pe_cylIn(O, d, uROut);
  vec3 H = O + d * tF;
  if (tF < 1e8 && H.y >= 0.0 && H.y <= uHeight) {
    P = H;
    S = H;
    region = 1.0;
    // sotto il labbro e sopra l'acqua la parete e' sottile e trasparente: si vede l'interno
    if (H.y > uWaterY && uHeight - H.y > uImpLip * 1.5) S = pe_inner(H, d);
  } else if (d.y < -1e-4) {
    vec3 T = O + d * ((uHeight - O.y) / d.y);
    float rT = length(T.xz);
    if (rT < pe_rOut(uHeight)) {
      vec3 Wp = O + d * ((uWaterY - O.y) / d.y);
      if (rT > pe_rIn(uHeight)) {
        // il labbro, davanti o dietro
        P = T;
        region = 3.0;
      } else if (length(Wp.xz) < pe_rIn(uWaterY)) {
        P = Wp;
        region = 2.0;
      } else {
        P = T + d * pe_cylOut(T, d, uRIn);
        region = 3.0;
      }
      S = P;
    }
  }
  // il punto del raggio piu' vicino all'asse: scorre senza salti (passo delle immagini) e, fuori dal
  // bicchiere, ai lati e' il punto del contorno
  float a = dot(d.xz, d.xz);
  float t0 = a > 1e-9 ? -dot(O.xz, d.xz) / a : 0.0;
  vec3 C = O + d * t0;
  if (region < 0.5) {
    // fuori: sopra il bicchiere quello che si vede vicino e' il bordo lontano, ai lati il contorno
    float rTop = pe_rOut(uHeight);
    vec3 B = O + d * (t0 + sqrt(max(rTop * rTop - dot(C.xz, C.xz), 0.0) / max(a, 1e-9)));
    S = B.y > uHeight ? B : C;
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
  mat2 rot = mat2(c, s, -s, c);
  vec2 sxz = rot * S.xz;
  vec3 Q = vec3(sxz.x, S.y - uImpFrame.z, sxz.y);
  vec2 cxz = rot * C.xz;
  float e = asin(clamp(-d.y, -1.0, 1.0));
  // passo delle immagini sullo schermo dal punto che scorre senza salti
  vec2 uvC = pe_impUv(vec3(cxz.x, C.y - uImpFrame.z, cxz.y), e);
  vec2 gx = dFdx(uvC);
  vec2 gy = dFdy(uvC);
  float f = clamp((e - uImpE0) / uImpStep, 0.0, ${(n - 1).toFixed(1)});
  int k = min(int(f), ${Math.max(0, n - 2)});
  float w = f - float(k);
  float eA = uImpE0 + float(k) * uImpStep;
  float eB = eA + uImpStep;
  // il raggio di un'immagine che passa per S attraversa la parete davanti piu' in basso (A, meno
  // inclinata) o piu' in alto (B) del nostro: se uno dei due attraversa il labbro e il nostro no (o
  // il contrario) la sua immagine mostra il labbro al posto sbagliato (il bordo davanti doppio): conta
  // solo l'altra
  vec3 Sr = vec3(Q.x, S.y, Q.z);
  float yA = Sr.y + sin(eA) * pe_cylOut(Sr, vec3(0.0, sin(eA), cos(eA)), uROut);
  float yB = Sr.y + sin(eB) * pe_cylOut(Sr, vec3(0.0, sin(eB), cos(eB)), uROut);
  float yS = Sr.y + sin(e) * pe_cylOut(Sr, vec3(0.0, sin(e), cos(e)), uROut);
  float wA = (1.0 - w) * (1.0 - abs(pe_lip(yA) - pe_lip(yS)));
  float wB = w * (1.0 - abs(pe_lip(yB) - pe_lip(yS)));
  if (wA + wB < 1e-3) {
    wA = 1.0 - w;
    wB = w;
  }
  vec4 im = (pe_imp(k, pe_impUv(Q, eA), gx, gy) * wA + pe_imp(k + 1, pe_impUv(Q, eB), gx, gy) * wB) / (wA + wB);
  // sotto l'acqua: le bollicine della parete lontana si vedono attraverso l'acqua, piu' in alto o piu'
  // in basso nelle due immagini (due bollicine al posto di una). Dove il raggio, rifratto, arriva su
  // una bollicina, o ci arriva quello di una delle due immagini, le si cerca dove il raggio di ogni
  // immagine vede lo stesso punto della parete lontana
  if (region > 0.5 && region < 1.5 && P.y < uWaterY && P.y > uBase) {
    vec3 dh = vec3(d.x, 0.0, d.z) / sqrt(max(a, 1e-9));
    vec3 F = pe_farWall(P, d);
    vec3 FA = pe_farWall(P, dh * cos(eA) - vec3(0.0, sin(eA), 0.0));
    vec3 FB = pe_farWall(P, dh * cos(eB) - vec3(0.0, sin(eB), 0.0));
    float near = max(pe_nearBubble(F, rot), max(pe_nearBubble(FA, rot), pe_nearBubble(FB, rot)));
    if (near > 0.0) {
      vec3 HA = P + vec3(0.0, F.y - FA.y, 0.0);
      vec3 HB = P + vec3(0.0, F.y - FB.y, 0.0);
      vec2 qA = rot * HA.xz;
      vec2 qB = rot * HB.xz;
      vec4 back = pe_imp(k, pe_impUv(vec3(qA.x, HA.y - uImpFrame.z, qA.y), eA), gx, gy) * (1.0 - w)
                + pe_imp(k + 1, pe_impUv(vec3(qB.x, HB.y - uImpFrame.z, qB.y), eB), gx, gy) * w;
      im = mix(im, back, near);
    }
  }
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
  // punto del nero, come il resto dell'immagine (GRADE nella passata finale)
  col = pe_grade(col);
  float al = clamp(im.a, 0.0, 1.0);
  gl_FragColor = vec4(pe_srgb(col) * al, al);
}
`
