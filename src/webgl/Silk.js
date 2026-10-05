// Sfondo della hero: raso perlato con pieghe morbide, generato in tempo reale.
// Canvas separato e a bassa risoluzione (e' sfocato per natura): costa pochissimo.

const vertex = /* glsl */ `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uAspect;
uniform vec3 uLight;
uniform vec3 uShade;
uniform vec3 uTint;
uniform vec3 uSheen;
uniform vec3 uRim;
out vec4 outColor;

float folds(vec2 p, float t) {
  vec2 q = p + 0.13 * vec2(sin(p.y * 2.1 + t * 0.06), sin(p.x * 1.7 - t * 0.05));
  float v = 0.0;
  v += 0.62 * sin(dot(q, vec2(1.25, 2.05)) * 1.75 + t * 0.09);
  v += 0.34 * sin(dot(q, vec2(-1.65, 0.95)) * 2.45 - t * 0.07 + 1.3);
  v += 0.17 * sin(dot(q, vec2(0.45, -2.3)) * 3.9 + t * 0.11 + 2.1);
  v += 0.08 * sin(dot(q, vec2(2.6, 1.4)) * 6.3 - t * 0.13 + 0.7);
  return v;
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0) * 2.0;
  float t = uTime;
  float e = 0.003;
  float c = folds(p, t);
  float dx = (folds(p + vec2(e, 0.0), t) - c) / e;
  float dy = (folds(p + vec2(0.0, e), t) - c) / e;
  vec3 n = normalize(vec3(-dx * 0.13, -dy * 0.13, 1.0));

  vec3 L = normalize(vec3(-0.42, 0.62, 0.66));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float sheen = pow(max(dot(n, normalize(L + V)), 0.0), 34.0);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);

  // colori del tema del prodotto (luce e ombra del raso, riflesso del nastro)
  vec3 col = mix(uShade, uLight, smoothstep(0.35, 0.99, diff));
  col += uSheen * sheen * 0.3;
  col -= uRim * rim;

  // riflesso colorato del nastro di liquido (a destra in basso e a sinistra)
  float pinkR = smoothstep(0.75, 0.0, length((uv - vec2(0.8, 0.3)) * vec2(1.4, 1.0)));
  float pinkL = smoothstep(0.55, 0.0, length((uv - vec2(0.12, 0.36)) * vec2(1.2, 1.6)));
  col = mix(col, uTint, pinkR * 0.26 + pinkL * 0.1);

  // vignettatura morbida + dithering contro il banding
  col *= 0.955 + 0.045 * smoothstep(1.25, 0.25, length(uv - vec2(0.5, 0.55)));
  col += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}
`

const SILK_KEYS = ['light', 'shade', 'tint', 'sheen', 'rim']
const srgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

export class Silk {
  constructor(canvas, theme) {
    this.canvas = canvas
    const gl = (this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false }))
    if (!gl) throw new Error('WebGL2 non disponibile per lo sfondo')
    const prog = gl.createProgram()
    for (const [type, src] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
      gl.attachShader(prog, s)
    }
    gl.linkProgram(prog)
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      time: gl.getUniformLocation(prog, 'uTime'),
      aspect: gl.getUniformLocation(prog, 'uAspect'),
    }
    this.colors = {}
    for (const key of SILK_KEYS) {
      this.u[key] = gl.getUniformLocation(prog, `u${key[0].toUpperCase()}${key.slice(1)}`)
      this.colors[key] = new Float32Array(3)
    }
    this.setTheme(theme)
    this.active = true
    this.resize()
  }

  /** Colori del raso: tema a sfumato verso il tema b (k 0..1). */
  setTheme(a, b = a, k = 1) {
    for (const key of SILK_KEYS) {
      const ca = srgb(a.silk[key])
      const cb = srgb(b.silk[key])
      for (let i = 0; i < 3; i++) this.colors[key][i] = ca[i] + (cb[i] - ca[i]) * k
    }
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const scale = Math.min(1, (window.devicePixelRatio || 1) * 0.6)
    this.canvas.width = Math.max(2, Math.round(w * scale))
    this.canvas.height = Math.max(2, Math.round(h * scale))
    this.aspect = w / h
  }

  render(time) {
    if (!this.active) return
    const gl = this.gl
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.time, time)
    gl.uniform1f(this.u.aspect, this.aspect)
    for (const key of SILK_KEYS) gl.uniform3fv(this.u[key], this.colors[key])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
