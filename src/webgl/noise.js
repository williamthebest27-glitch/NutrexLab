// Rumore condiviso da barattolo (dissolvenza) e particelle: stessa funzione,
// stesse coordinate, cosi' ogni particella si stacca esattamente dal punto
// in cui la superficie del barattolo sta scomparendo.
export const NOISE = /* glsl */ `
uniform float uJarHeight;

float jarHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float jarValue(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = jarHash(i);
  float b = jarHash(i + vec3(1.0, 0.0, 0.0));
  float c = jarHash(i + vec3(0.0, 1.0, 0.0));
  float d = jarHash(i + vec3(1.0, 1.0, 0.0));
  float e = jarHash(i + vec3(0.0, 0.0, 1.0));
  float g = jarHash(i + vec3(1.0, 0.0, 1.0));
  float h = jarHash(i + vec3(0.0, 1.0, 1.0));
  float k = jarHash(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}

// 0..1: la parte alta (tappo) si dissolve per prima, la base per ultima
float jarNoise(vec3 p) {
  vec3 q = p * (4.6 / uJarHeight);
  float n = jarValue(q) * 0.62 + jarValue(q * 2.17 + 11.3) * 0.38;
  n = smoothstep(0.22, 0.78, n);
  float h = clamp(0.5 - p.y / uJarHeight, 0.0, 1.0);
  return mix(n, h, 0.5);
}
`
