/**
 * Traccia a keyframe con interpolazione cubica monotona (Steffen):
 * movimento continuo tra le pose, nessun "rimbalzo" oltre i valori indicati.
 *
 * keys: [{ t, ...props, lin? }] ordinati per t. I valori non indicati
 * vengono ereditati dal keyframe precedente. `lin: true` rende lineare il
 * tratto che parte da quel keyframe (utile per seguire lo scroll 1:1).
 */
export class Track {
  constructor(keys) {
    const props = new Set()
    for (const k of keys) for (const p of Object.keys(k)) if (p !== 't' && p !== 'lin') props.add(p)
    this.props = [...props]

    let prev = {}
    const filled = keys.map((k) => {
      const { lin, ...rest } = k
      prev = { ...prev, ...rest }
      return prev
    })
    // proprieta' introdotte piu' tardi: valgono all'indietro fino all'inizio
    for (const p of this.props) {
      const first = filled.find((k) => k[p] !== undefined)[p]
      for (const k of filled) if (k[p] === undefined) k[p] = first
    }

    this.ts = filled.map((k) => k.t)
    this.lin = keys.map((k) => !!k.lin)
    this.series = {}
    for (const p of this.props) {
      const v = filled.map((k) => k[p])
      this.series[p] = { v, m: steffen(this.ts, v) }
    }
    this.i = 0
  }

  sample(t, out = {}) {
    const ts = this.ts
    const n = ts.length
    if (t <= ts[0] || n === 1) {
      for (const p of this.props) out[p] = this.series[p].v[0]
      return out
    }
    if (t >= ts[n - 1]) {
      for (const p of this.props) out[p] = this.series[p].v[n - 1]
      return out
    }
    let i = this.i
    while (i > 0 && t < ts[i]) i--
    while (i < n - 2 && t >= ts[i + 1]) i++
    this.i = i

    const h = ts[i + 1] - ts[i]
    const s = (t - ts[i]) / h
    if (this.lin[i]) {
      for (const p of this.props) {
        const v = this.series[p].v
        out[p] = v[i] + (v[i + 1] - v[i]) * s
      }
      return out
    }
    const s2 = s * s
    const s3 = s2 * s
    const h00 = 2 * s3 - 3 * s2 + 1
    const h10 = s3 - 2 * s2 + s
    const h01 = -2 * s3 + 3 * s2
    const h11 = s3 - s2
    for (const p of this.props) {
      const { v, m } = this.series[p]
      out[p] = h00 * v[i] + h10 * h * m[i] + h01 * v[i + 1] + h11 * h * m[i + 1]
    }
    return out
  }
}

function steffen(x, y) {
  const n = x.length
  const m = new Float64Array(n)
  if (n < 3) return m
  const h = []
  const d = []
  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i]
    d[i] = (y[i + 1] - y[i]) / h[i]
  }
  // estremi a velocita' zero: partenza e arrivo morbidi
  m[0] = 0
  m[n - 1] = 0
  for (let i = 1; i < n - 1; i++) {
    const p = (d[i - 1] * h[i] + d[i] * h[i - 1]) / (h[i - 1] + h[i])
    m[i] = (Math.sign(d[i - 1]) + Math.sign(d[i])) * Math.min(Math.abs(d[i - 1]), Math.abs(d[i]), 0.5 * Math.abs(p))
  }
  return m
}
