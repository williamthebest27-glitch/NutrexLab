/*
  Versata della polvere (PowderExperience): punti di partenza, velocita' e tempi di ~30.000 granelli,
  nuvola lattiginosa, increspature e opalescenza dell'acqua. E' il calcolo piu' pesante della
  sezione (centinaia di ms su un telefono): gira in un worker (powderPour.worker.js), fuori dal
  thread della pagina, cosi' lo scroll non si ferma mai. Nessuna dipendenza (ne' three ne' GSAP):
  stesse formule di kit.js e di three.js (Quaternion.setFromEuler 'YZX', Vector3), stesso
  generatore casuale con lo stesso seme, quindi gli stessi granelli di prima a ogni caricamento.

  input: {
    samples: [{ T, fill, px, py, pz, yaw, roll, pitch }]  stato del misurino durante la versata
    rimR, waterY, total, gravity, drag: { grain, dust }, counts: { grain, dust, veil, plume }
  }
*/

const DEG = Math.PI / 180

/** Generatore casuale con seme (identico a random() di kit.js). */
function random(seed = 1) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp01 = (x) => Math.min(1, Math.max(0, x))

/** Caduta con attrito lineare (fall() di kit.js, pe_fall degli shader). */
function fall(t, p0, v0, g, k, out) {
  const e = Math.exp(-k * t)
  const vt = -g / k
  out.x = p0.x + (v0.x * (1 - e)) / k
  out.y = p0.y + vt * t + ((v0.y - vt) * (1 - e)) / k
  out.z = p0.z + (v0.z * (1 - e)) / k
  return out
}

/** Tempo d'impatto con il piano y = level (stessa bisezione dello shader). */
function hitTime(p0, v0, level, g, k) {
  let lo = 0
  let hi = 4
  const v = { x: 0, y: 0, z: 0 }
  for (let i = 0; i < 14; i++) {
    const mid = 0.5 * (lo + hi)
    if (fall(mid, p0, v0, g, k, v).y > level) lo = mid
    else hi = mid
  }
  return hi
}

/** Tabella campionata su [t0, t1] (Table di kit.js): solo i valori. */
function table(t0, t1, n) {
  const v = new Float32Array(n)
  const index = (t) => ((t - t0) / (t1 - t0)) * (n - 1)
  return {
    v,
    add(t, value) {
      const i = Math.round(index(t))
      if (i >= 0 && i < n) v[i] += value
    },
  }
}

export function computePour({ samples, rimR, waterY, total, gravity: G, drag: DRAG, counts }) {
  const f0 = samples[0].fill
  const f1 = samples[samples.length - 1].fill
  const keys = Object.keys(samples[0])
  // stato del misurino quando la polvere e' scesa a una certa frazione (quantile 0..1). Dentro
  // emit() u cresce sempre: la ricerca riparte dal campione trovato per il granello prima
  let cursor = 0
  const state = {}
  const at = (u) => {
    const target = f0 - u * (f0 - f1)
    let i = cursor
    while (i < samples.length - 2 && samples[i + 1].fill > target) i++
    cursor = i
    const a = samples[i]
    const b = samples[i + 1]
    const span = a.fill - b.fill
    const f = span > 1e-6 ? clamp01((a.fill - target) / span) : 0
    for (const k of keys) state[k] = a[k] + (b[k] - a[k]) * f
    return state
  }

  const rnd = random(7)
  const impacts = []
  // vettori come oggetti semplici: stesse operazioni, nello stesso ordine, di three.js
  const A = { x: 0, y: 0, z: 0 }
  const dir = { x: 0, y: 0, z: 0 }
  const tan = { x: 0, y: 0, z: 0 }
  const p0 = { x: 0, y: 0, z: 0 }
  const v0 = { x: 0, y: 0, z: 0 }
  const hit = { x: 0, y: 0, z: 0 }
  const normalize = (v) => {
    const s = 1 / (Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1)
    v.x *= s
    v.y *= s
    v.z *= s
  }

  const emit = (count, kind) => {
    const start = new Float32Array(count * 3)
    const vel = new Float32Array(count * 3)
    const seed = new Float32Array(count * 4)
    const release = new Float32Array(count)
    const size = new Float32Array(count)
    cursor = 0
    for (let i = 0; i < count; i++) {
      // quantile: piu' denso a meta' versata, con un piccolo sbuffo iniziale di polvere fine
      let u = (i + rnd()) / count
      if (kind === 'dust') u = Math.pow(u, 1.4)
      const st = at(u)
      // asse della coppa: (0, 1, 0) ruotato dal quaternione degli angoli (ordine YZX)
      const x = st.roll * DEG
      const y = st.yaw * DEG
      const z = st.pitch * DEG
      const c1 = Math.cos(x / 2)
      const c2 = Math.cos(y / 2)
      const c3 = Math.cos(z / 2)
      const s1 = Math.sin(x / 2)
      const s2 = Math.sin(y / 2)
      const s3 = Math.sin(z / 2)
      const qx = s1 * c2 * c3 + c1 * s2 * s3
      const qy = c1 * s2 * c3 + s1 * c2 * s3
      const qz = c1 * c2 * s3 - s1 * s2 * c3
      const qw = c1 * c2 * c3 - s1 * s2 * s3
      const tx = 2 * (qy * 0 - qz * 1)
      const ty = 2 * (qz * 0 - qx * 0)
      const tz = 2 * (qx * 1 - qy * 0)
      A.x = 0 + qw * tx + qy * tz - qz * ty
      A.y = 1 + qw * ty + qz * tx - qx * tz
      A.z = 0 + qw * tz + qx * ty - qy * tx
      // direzione del labbro piu' basso: il "giu'" del mondo senza la componente lungo l'asse
      const ad = A.x * 0 + A.y * -1 + A.z * 0
      dir.x = 0 + A.x * -ad
      dir.y = -1 + A.y * -ad
      dir.z = 0 + A.z * -ad
      if (dir.x * dir.x + dir.y * dir.y + dir.z * dir.z < 1e-8) {
        dir.x = 0
        dir.y = 0
        dir.z = 1
      }
      normalize(dir)
      tan.x = A.y * dir.z - A.z * dir.y
      tan.y = A.z * dir.x - A.x * dir.z
      tan.z = A.x * dir.y - A.y * dir.x
      normalize(tan)
      // la polvere scivola fuori da un tratto stretto del labbro: un nastro compatto
      const spread = kind === 'dust' ? 0.9 : kind === 'veil' ? 0.5 : 0.42
      const delta = (rnd() + rnd() - 1) * spread
      const rr = rimR * (0.94 + 0.05 * rnd())
      const kc = Math.cos(delta) * rr
      const ks = Math.sin(delta) * rr
      p0.x = st.px
      p0.y = st.py
      p0.z = st.pz
      p0.x += dir.x * kc
      p0.y += dir.y * kc
      p0.z += dir.z * kc
      p0.x += tan.x * ks
      p0.y += tan.y * ks
      p0.z += tan.z * ks
      const ka = -0.0012 * rnd()
      p0.x += A.x * ka
      p0.y += A.y * ka
      p0.z += A.z * ka
      const speed = kind === 'dust' ? 0.01 + 0.016 * rnd() : 0.016 + 0.022 * rnd()
      v0.x = A.x * 0.45
      v0.y = A.y * 0.45
      v0.z = A.z * 0.45
      v0.x += dir.x * 0.9
      v0.y += dir.y * 0.9
      v0.z += dir.z * 0.9
      normalize(v0)
      v0.x *= speed
      v0.y *= speed
      v0.z *= speed
      const jitter = kind === 'dust' ? 0.008 : 0.003
      v0.x += (rnd() - 0.5) * jitter
      v0.z += (rnd() - 0.5) * jitter
      start[i * 3] = p0.x
      start[i * 3 + 1] = p0.y
      start[i * 3 + 2] = p0.z
      vel[i * 3] = v0.x
      vel[i * 3 + 1] = v0.y
      vel[i * 3 + 2] = v0.z
      for (let k = 0; k < 4; k++) seed[i * 4 + k] = rnd()
      release[i] = st.T
      size[i] =
        kind === 'dust' ? 0.0004 + 0.0008 * rnd()
        : kind === 'veil' ? 0.0016 + 0.0024 * rnd()
        : 0.0002 + 0.00034 * rnd() * rnd()
      if (kind === 'grain') {
        const th = hitTime(p0, v0, waterY, G, DRAG.grain)
        fall(th, p0, v0, G, DRAG.grain, hit)
        impacts.push({ T: st.T + th, x: hit.x, z: hit.z })
      }
    }
    return { start, vel, seed, release, size }
  }

  const grain = emit(counts.grain, 'grain')
  const dust = emit(counts.dust, 'dust')
  const veil = emit(counts.veil, 'veil')

  // nuvola lattiginosa: nasce dove i granelli entrano in acqua
  impacts.sort((a, b) => a.T - b.T)
  const nPlume = counts.plume
  const plume = {
    start: new Float32Array(nPlume * 3),
    seed: new Float32Array(nPlume * 4),
    release: new Float32Array(nPlume),
    size: new Float32Array(nPlume),
  }
  for (let i = 0; i < nPlume; i++) {
    const im = impacts[Math.floor(rnd() * impacts.length)]
    const a = rnd() * Math.PI * 2
    const r = 0.002 + 0.006 * rnd()
    plume.start.set([im.x + Math.cos(a) * r, waterY - 0.002 - 0.004 * rnd(), im.z + Math.sin(a) * r], i * 3)
    plume.seed.set([rnd(), rnd(), rnd(), rnd()], i * 4)
    plume.release[i] = im.T + 0.05 + 0.25 * rnd()
    plume.size[i] = 0.007 + 0.016 * rnd()
  }

  // increspature (quanti granelli cadono adesso) e opalescenza dell'acqua (si scioglie col tempo)
  const T0 = impacts[0]?.T ?? 0
  const ripple = table(0, total, 320)
  const cloud = table(0, total, 320)
  let mx = 0
  let mz = 0
  for (const im of impacts) {
    ripple.add(im.T, 1)
    mx += im.x
    mz += im.z
  }
  const impactXZ = [mx / Math.max(1, impacts.length), mz / Math.max(1, impacts.length)]
  // morbida nel tempo, normalizzata a 1
  const smoothR = new Float32Array(ripple.v.length)
  for (let i = 0; i < smoothR.length; i++) {
    let acc = 0
    let w = 0
    for (let j = -6; j <= 6; j++) {
      const k = i + j
      if (k < 0 || k >= smoothR.length) continue
      const ww = Math.exp(-(j * j) / 18)
      acc += ripple.v[k] * ww
      w += ww
    }
    smoothR[i] = acc / w
  }
  const peak = Math.max(...smoothR, 1e-6)
  const rippleV = smoothR.map((v) => v / peak)
  // opalescenza: somma, su un impatto ogni 4, di (1 - e^(-dt/0.5)) * e^(-dt/tau) =
  // e^(-dt*a) - e^(-dt*b). Le due somme di esponenziali si aggiornano da un istante al successivo
  const tau = 2.4
  const a1 = 1 / tau
  const b1 = 1 / 0.5 + 1 / tau
  let sumA = 0
  let sumB = 0
  let tPrev = 0
  let next = 0
  for (let i = 0; i < cloud.v.length; i++) {
    const t = (i / (cloud.v.length - 1)) * total
    sumA *= Math.exp(-(t - tPrev) * a1)
    sumB *= Math.exp(-(t - tPrev) * b1)
    tPrev = t
    for (; next < impacts.length && impacts[next].T < t; next++) {
      if (next % 4) continue
      const dt = t - impacts[next].T
      sumA += Math.exp(-dt * a1)
      sumB += Math.exp(-dt * b1)
    }
    cloud.v[i] = sumA - sumB
  }
  const cPeak = Math.max(...cloud.v, 1e-6)
  const cloudV = cloud.v.map((v) => v / cPeak)

  return { grain, dust, veil, plume, ripple: rippleV, cloud: cloudV, impactXZ, firstImpact: T0 }
}

/** Buffer da trasferire (non copiare) tra worker e pagina. */
export function pourTransfer(out) {
  const list = [out.ripple.buffer, out.cloud.buffer]
  for (const sys of [out.grain, out.dust, out.veil, out.plume]) for (const arr of Object.values(sys)) list.push(arr.buffer)
  return list
}
