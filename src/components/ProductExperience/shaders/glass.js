import { NOISE, ENV, PROJECT, GLASS, STUDIO, ETCH, OUTPUT } from './chunks.js'

/*
  Bicchiere in due passate (vedi ProductScene.js):
  - BACK: nello strato posteriore (backRT, lineare) la meta' lontana del vetro, parete interna e
    esterna: riflessi dello studio e un velo che scurisce appena quello che c'e' dietro.
  - FRONT ("lente"): sullo schermo, la pelle esterna rivolta alla camera. Per ogni pixel segue il
    raggio dentro il vetro: parete sottile sopra l'acqua, cilindro d'acqua (ingrandisce e ribalta lo
    sfondo, mostra la polvere sospesa vista a meta' percorso), fondo pieno e bordo spesso,
    riflessione totale dove serve. Legge lo strato posteriore (tBack) e il contenuto dell'acqua (tInside).
  Il logo inciso a smeriglio (ETCH) diffonde la luce: si legge chiaro sul fondo scuro.
*/

export const glassVertex = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const glassBackFragment = /* glsl */ `
#include <common>
${NOISE}
${ENV}
${GLASS}
${STUDIO}
${ETCH}
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 P = vWorld;
  float rP = length(P.xz);
  float wall = uROut - uRIn;
  bool rim = P.y > uHeight - wall * 0.8;
  bool outer = rP > uRIn + wall * 0.5;
  vec2 camH = normalize(cameraPosition.xz + vec2(1e-5));
  bool near = dot(P.xz, camH) > 0.0;
  // solo la meta' lontana: la pelle esterna vicina e' la "lente", l'interno vicino la attraversa
  if (rim) { if (near) discard; }
  else if (outer) { if (gl_FrontFacing) discard; }
  else { if (!gl_FrontFacing || P.y < uBase + 0.0008) discard; }

  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - P);
  vec3 q = pe_glassLocal(P) * vec3(80.0, 12.0, 80.0);
  N = normalize(N + vec3(pe_noise(q) - 0.5, 0.0, pe_noise(q + 11.0) - 0.5) * 0.02);
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  vec3 refl = pe_env(reflect(-V, N), 0.025);
  float edge = pow(1.0 - NdV, 2.2);
  float absorb = 0.02 + 0.12 * edge;
  // i profili della meta' lontana si vedono solo attraverso l'acqua, che li ingrandisce: piu' tenui
  F *= mix(1.0, 0.3, edge);
  if (rim) {
    F = max(F, 0.18);
    absorb = 0.3;
  }
  vec3 c = refl * F;
  float a = F + absorb;
  // logo inciso visto da dietro (attraverso il vetro, specchiato)
  float etch = pe_etch(P) * (outer ? 1.0 : 0.0);
  c += etch * (pe_env(N, 0.9) * 0.16 + uBgGlow * 0.5);
  a += etch * 0.3;
  gl_FragColor = vec4(c, clamp(a, 0.0, 0.92));
}
`

export const glassFrontFragment = /* glsl */ `
#include <common>
#include <dithering_pars_fragment>
${NOISE}
${ENV}
${PROJECT}
${GLASS}
${STUDIO}
${ETCH}
uniform sampler2D tBack;
uniform sampler2D tDepth;
uniform sampler2D tInside;
uniform vec2 uViewport;
uniform float uCloud;
uniform vec3 uCloudColor;
uniform vec3 uWaterAbsorb;
uniform vec3 uGlassAbsorb;
uniform float uDispersion;
uniform float uMeniscus;
uniform float uRipple;
uniform vec3 uKeyDir;
varying vec3 vWorld;
varying vec3 vNormal;

// profondita' (0..1) della pelle esterna del vetro in questo pixel
float pe_frontZ;

/**
 * Cosa vede il raggio rifratto: lo strato posteriore dove si proietta il punto W. Se in quel pixel
 * c'e' qualcosa piu' vicino della pelle del vetro (un prodotto davanti al bicchiere) non puo'
 * trovarsi dietro: il raggio vede lo studio nel punto D. Senza questo controllo un oggetto davanti
 * al bicchiere comparirebbe una seconda volta, ribaltato, dentro l'acqua.
 */
vec3 pe_seen(vec3 W, vec3 D) {
  vec2 uv = clamp(pe_uv(W), vec2(0.002), vec2(0.998));
  // textureLod: dentro i rami non servono derivate (i livelli sono senza mipmap). Con texture2D il
  // compilatore DirectX di Windows (ANGLE) appiattiva tutti i rami: secondi di compilazione e ogni
  // pixel calcolava tutti i percorsi del raggio
  if (textureLod(tDepth, uv, 0.0).r < pe_frontZ - 1e-6) return pe_studio(D);
  return textureLod(tBack, uv, 0.0).rgb;
}

/*
  Il raggio della lente viene prima seguito nei rami (solo geometria) e poi colorato una volta sola:
    colore = pe_rB + pe_rA * (sK * sfondo visto + e1K * ambiente(e1) + e2K * ambiente(e2))
  Sfondo (pe_seen + pe_studio) e ambiente (textureCubeUV) compaiono cosi' una volta nello shader invece
  che in ogni ramo: su Windows (ANGLE / DirectX, che espande ogni chiamata) la compilazione bloccava
  la pagina per secondi quando la sezione si preparava.
*/
vec3 pe_rA;                      // filtro del percorso (assorbimento dell'acqua, polvere)
vec3 pe_rB;                      // luce propria del percorso (polvere sospesa, opalescenza)
vec3 pe_sW; vec3 pe_sD; float pe_sK;          // punto dello sfondo visto e peso
vec3 pe_e1D; float pe_e1R; float pe_e1K;      // prima lettura dell'ambiente: direzione, ruvidezza, peso
vec3 pe_e2D; float pe_e2R; float pe_e2K;      // seconda lettura dell'ambiente
float pe_dsp; vec3 pe_dR; vec3 pe_dB;         // dispersione cromatica: punti dei canali rosso e blu

void pe_planSeen(vec3 W, vec3 D, float k) { pe_sW = W; pe_sD = D; pe_sK = k; }
void pe_planEnv(vec3 d, float r, float k) { pe_e1D = d; pe_e1R = r; pe_e1K = k; }

/** Luce intrappolata nel vetro spesso: riflessione totale sulle facce interne (fondo, bordo). */
void pe_planTrapped(vec3 T, float k) {
  pe_e1D = reflect(T, vec3(0.0, -1.0, 0.0)); pe_e1R = 0.06; pe_e1K = 0.06 * k;
  pe_e2D = T; pe_e2R = 0.3; pe_e2K = 0.015 * k;
}

/** Raggio dentro il vetro pieno: esce dalla parete esterna, poggia sul pavimento o sale in acqua. */
float pe_solid(vec3 P, vec3 T, float yTop) {
  float tw = pe_cylOut(P, T, uROut);
  float tb = T.y < -1e-5 ? -P.y / T.y : 1e9;
  float tt = T.y > 1e-5 ? (yTop - P.y) / T.y : 1e9;
  float t = min(tw, min(tb, tt));
  vec3 E = P + T * t;
  if (t == tb) {
    pe_planSeen(E, E, 0.9);
    pe_planTrapped(T, 1.0);
  } else if (t == tt) {
    pe_planSeen(E + T * 0.02, pe_backdropHit(E, T), 1.0);
  } else {
    vec3 Ne = normalize(vec3(E.x, 0.0, E.z));
    vec3 T2 = refract(T, -Ne, 1.5);
    if (dot(T2, T2) < 0.01) {
      pe_planEnv(reflect(T, -Ne), 0.04, 0.85);
    } else {
      vec3 D = pe_backdropHit(E, T2);
      pe_planSeen(D, D, 1.0);
      pe_planTrapped(T, 0.6);
    }
  }
  return t;
}

/** Fondo dello sfondo visto uscendo dall'acqua dal lato opposto, con dispersione cromatica leggera. */
void pe_exitWater(vec3 E, vec3 T2) {
  vec3 Ne = normalize(vec3(E.x, 0.0, E.z));
  vec3 Tg = refract(T2, -Ne, 1.333);
  if (dot(Tg, Tg) < 0.01) {
    pe_planEnv(reflect(T2, -Ne), 0.05, 0.8);
    return;
  }
  vec3 DG = pe_backdropHit(E, Tg);
  pe_planSeen(DG, DG, 1.0);
  if (uDispersion <= 0.0) return;
  vec3 Tr = refract(T2, -Ne, 1.333 - 0.006 * uDispersion);
  vec3 Tb = refract(T2, -Ne, 1.333 + 0.009 * uDispersion);
  pe_dR = dot(Tr, Tr) > 0.01 ? pe_backdropHit(E, Tr) : DG;
  pe_dB = dot(Tb, Tb) > 0.01 ? pe_backdropHit(E, Tb) : DG;
  pe_dsp = 1.0;
}

/** Sfondo in un punto vicino (dispersione); se li' c'e' un oggetto davanti al vetro resta keep. */
vec3 pe_seenNear(vec3 W, vec3 keep) {
  vec2 uv = clamp(pe_uv(W), vec2(0.002), vec2(0.998));
  if (textureLod(tDepth, uv, 0.0).r < pe_frontZ - 1e-6) return keep;
  return textureLod(tBack, uv, 0.0).rgb;
}

void main() {
  vec3 P = vWorld;
  float rP = length(P.xz);
  float wall = uROut - uRIn;
  bool rim = P.y > uHeight - wall * 0.8;
  // solo la pelle esterna (e il bordo): le pareti interne sono nello strato posteriore
  if (!rim && rP < uRIn + wall * 0.5) discard;

  // occlusione: un oggetto davanti al vetro (es. il misurino) resta davanti
  vec2 suv = gl_FragCoord.xy / uViewport;
  if (textureLod(tDepth, suv, 0.0).r < gl_FragCoord.z - 1e-6) discard;
  pe_frontZ = gl_FragCoord.z;

  vec3 N = normalize(vNormal);
  // vetro reale: superficie appena ondulata, si vede solo nei riflessi lunghi
  vec3 q = pe_glassLocal(P) * vec3(80.0, 12.0, 80.0);
  N = normalize(N + vec3(pe_noise(q) - 0.5, 0.0, pe_noise(q + 11.0) - 0.5) * 0.02);
  vec3 V = normalize(cameraPosition - P);
  vec3 I = -V;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.04 + 0.96 * pow(1.0 - NdV, 5.0);
  vec3 refl = pe_env(reflect(I, N), 0.02);

  vec3 T1 = refract(I, N, 1.0 / 1.5);
  float glassPath = wall / max(NdV, 0.25);

  // 1) percorso del raggio (solo geometria): cosa vede e con quali pesi
  pe_rA = vec3(1.0); pe_rB = vec3(0.0);
  pe_sW = P; pe_sD = P; pe_sK = 0.0;
  pe_e1D = N; pe_e1R = 0.0; pe_e1K = 0.0;
  pe_e2D = N; pe_e2R = 0.0; pe_e2K = 0.0;
  pe_dsp = 0.0; pe_dR = P; pe_dB = P;

  if (rim) {
    // bordo pieno arrotondato: la luce resta intrappolata e lo illumina
    vec3 W = pe_backdropHit(P + T1 * wall, T1);
    pe_planSeen(W, W, 0.55);
    pe_planEnv(T1, 0.12, 0.12);
    glassPath = wall * 3.0;
    F = max(F, 0.12);
  } else if (P.y < uBase) {
    // fondo spesso
    glassPath = pe_solid(P, T1, uBase);
  } else {
    float tCav = pe_cylIn(P, T1, uRIn);
    vec3 Pin = P + T1 * tCav;
    float waterLine = uWaterY + uMeniscus * 0.6;
    if (tCav > 1e8 || Pin.y < uBase) {
      // vicino al profilo: il raggio attraversa solo vetro (doppio bordo luminoso/scuro)
      glassPath = pe_solid(P, T1, uHeight);
    } else if (Pin.y < waterLine) {
      // ACQUA
      vec3 Nin = normalize(vec3(Pin.x, 0.0, Pin.z));
      vec3 T2 = refract(T1, Nin, 1.5 / 1.333);
      // leggera distorsione quando la superficie e' agitata
      T2 = normalize(T2 + uRipple * 0.012 * vec3(sin(uTime * 2.1 + Pin.y * 300.0), 0.0, cos(uTime * 1.7 + Pin.y * 260.0)));
      float tw = pe_cylOut(Pin, T2, uRIn);
      float tb = T2.y < -1e-5 ? (uBase - Pin.y) / T2.y : 1e9;
      float ts = T2.y > 1e-5 ? (uWaterY - Pin.y) / T2.y : 1e9;
      float t = min(tw, min(tb, ts));
      vec3 E = Pin + T2 * t;
      if (t == tb) {
        vec3 T3 = refract(T2, vec3(0.0, 1.0, 0.0), 1.333 / 1.5);
        vec3 Fl = E + T3 * (E.y / max(-T3.y, 0.05));
        pe_planSeen(Fl, Fl, 0.85);
        pe_planTrapped(T3, 0.5);
      } else if (t == ts) {
        // superficie vista da sotto: specchio argentato (riflessione totale)
        pe_planEnv(reflect(T2, vec3(0.0, -1.0, 0.0)), 0.03, 0.75);
      } else {
        pe_exitWater(E, T2);
      }
      vec4 ins = textureLod(tInside, clamp(pe_uv(Pin + T2 * (t * 0.5)), vec2(0.002), vec2(0.998)), 0.0);
      // opalescenza mentre la polvere si scioglie: diffusione lattiginosa che segue la luce
      float cloud = 1.0 - exp(-uCloud * t * 34.0);
      float lit = 0.55 + 0.45 * max(dot(-T2, uKeyDir), 0.0);
      // linea scura appena sotto il pelo dell'acqua (riflessione totale del menisco)
      float under = smoothstep(uWaterY - 0.0016, uWaterY - 0.0003, Pin.y) * (1.0 - smoothstep(uWaterY - 0.0003, waterLine, Pin.y));
      float dark = 1.0 - 0.45 * under;
      // = mix(contenuto + fondo assorbito, nuvola, cloud) * dark
      pe_rA = exp(-uWaterAbsorb * t) * ((1.0 - ins.a) * (1.0 - cloud) * dark);
      pe_rB = (ins.rgb * (1.0 - cloud) + uCloudColor * lit * 0.6 * cloud) * dark;
    } else {
      // ARIA sopra l'acqua: parete sottile, si vede lo strato posteriore appena spostato
      vec3 Nin = normalize(vec3(Pin.x, 0.0, Pin.z));
      vec3 T2 = refract(T1, Nin, 1.5);
      if (dot(T2, T2) < 0.01) {
        pe_planEnv(reflect(T1, Nin), 0.04, 0.8);
      } else {
        vec3 Wf = Pin + T2 * pe_cylOut(Pin, T2, uRIn);
        pe_planSeen(Wf, pe_backdropHit(Wf, T2), 1.0);
      }
      // menisco: l'acqua che sale sul vetro riflette la luce dall'alto come una riga sottile
      float men = smoothstep(waterLine + uMeniscus * 1.4, waterLine, Pin.y);
      vec3 nm = normalize(vec3(-Nin.x, 1.1, -Nin.z));
      pe_e2D = reflect(T1, nm); pe_e2R = 0.06; pe_e2K = men * 0.5;
    }
  }

  // 2) colore: sfondo e ambiente letti una volta sola
  vec3 col = vec3(0.0);
  if (pe_sK > 0.0) {
    vec3 S = pe_seen(pe_sW, pe_sD);
    if (pe_dsp > 0.0) S = vec3(pe_seenNear(pe_dR, S).r, S.g, pe_seenNear(pe_dB, S).b);
    col += S * pe_sK;
  }
  if (pe_e1K > 0.0) col += pe_env(pe_e1D, pe_e1R) * pe_e1K;
  if (pe_e2K > 0.0) col += pe_env(pe_e2D, pe_e2R) * pe_e2K;
  col = pe_rB + pe_rA * col;

  // assorbimento del vetro (tinta appena verde-acqua sui percorsi lunghi)
  col *= exp(-uGlassAbsorb * glassPath);
  // logo inciso a smeriglio: la superficie diffonde, il fondo si vede sfocato e piu' chiaro
  float etch = pe_etch(P) * (rim ? 0.0 : 1.0);
  if (etch > 0.0) {
    vec3 frost = col * 0.4 + pe_env(N, 0.9) * 0.2 + uBgGlow * 0.7;
    col = mix(col, frost, etch * 0.9);
    refl = mix(refl, pe_env(reflect(I, N), 0.5), etch);
  }
  col = col * (1.0 - F) + refl * F;

  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
  // bordo morbido sul profilo (anti-aliasing analitico)
  float a = smoothstep(0.0, 0.05, NdV);
  gl_FragColor = vec4(gl_FragColor.rgb * a, a);
}
`
