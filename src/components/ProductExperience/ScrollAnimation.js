import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/*
  Controllo tramite lo scroll (GSAP + ScrollTrigger).

  Una sola timeline GSAP in pausa, lunga 1 (= 0..100% della sezione), descrive tutto: tempo del
  racconto, camera, prodotto, effetti e testi. ScrollTrigger la "scrubba" mentre lo stage della
  sezione e' pinnato (pin: true): la scena e' sempre funzione della posizione di scroll, quindi
  tornando indietro torna indietro. Un secondo trigger anima l'ingresso (prima del pin). I trigger
  restano gli stessi per tutta la vita della sezione; le timeline si possono ricostruire.

  pinSpacing: false perche' l'altezza della sezione (passi + 1 viewport) e' gia' nel CSS: la pagina
  non cambia lunghezza quando il JS arriva (il sito calcola le posizioni delle sezioni dai passi).
*/

/**
 * Keyframe -> tween GSAP. keys: [{ at: 0..1, ease?, ...valori }]: per ogni proprieta' un fromTo tra
 * due chiavi consecutive che la contengono (ease della chiave di arrivo). Deterministico in entrambi
 * i versi dello scroll.
 */
export function addTrack(tl, target, keys, defaultEase = 'sine.inOut') {
  const props = new Set()
  for (const k of keys) for (const p of Object.keys(k)) if (p !== 'at' && p !== 'ease') props.add(p)
  for (const p of props) {
    const ks = keys.filter((k) => k[p] !== undefined)
    // valore iniziale scritto subito (non con un tl.set a 0: GSAP lo annullerebbe tornando a 0)
    target[p] = ks[0][p]
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i]
      const b = ks[i + 1]
      if (a[p] === b[p] || b.at <= a.at) continue
      tl.fromTo(
        target,
        { [p]: a[p] },
        { [p]: b[p], duration: b.at - a.at, ease: b.ease ?? defaultEase, immediateRender: false },
        a.at,
      )
    }
  }
}

/**
 * Valori delle chiavi al progresso `at`: gli stessi che la timeline costruita da addTrack
 * mostrerebbe in quel punto, calcolati senza muoverla (niente rendering di tutte le tween).
 */
export function sampleKeys(keys, at, out = {}, defaultEase = 'sine.inOut') {
  for (const tr of keyTracks(keys, defaultEase)) {
    let v = tr.v[0]
    for (let i = 0; i < tr.at.length - 1; i++) {
      const a = tr.at[i]
      const b = tr.at[i + 1]
      if (at < a || b <= a) break
      if (at >= b) v = tr.v[i + 1]
      else v = tr.v[i] + (tr.v[i + 1] - tr.v[i]) * tr.ease[i + 1]((at - a) / (b - a))
    }
    out[tr.p] = v
  }
  return out
}

/** Chiavi divise per proprieta', con le funzioni di ease gia' pronte (una volta per lista). */
const tracksCache = new WeakMap()
function keyTracks(keys, defaultEase) {
  const hit = tracksCache.get(keys)
  if (hit?.defaultEase === defaultEase) return hit.tracks
  const props = new Set()
  for (const k of keys) for (const p of Object.keys(k)) if (p !== 'at' && p !== 'ease') props.add(p)
  const tracks = [...props].map((p) => {
    const ks = keys.filter((k) => k[p] !== undefined)
    return { p, at: ks.map((k) => k.at), v: ks.map((k) => k[p]), ease: ks.map((k) => gsap.parseEase(k.ease ?? defaultEase)) }
  })
  tracksCache.set(keys, { defaultEase, tracks })
  return tracks
}

/**
 * Posizioni (yPercent) di una riga nascosta sotto / sopra la sua maschera. La maschera e' alta
 * 1.14em (riga 0.86em + 0.14em sopra e sotto per accenti e discendenti): le maiuscole accentate
 * salgono 0.13em sopra la riga e Q, J e virgole scendono fino a 0.93em, quindi servono almeno
 * +132% e -125%. Con 112% restava visibile un filo delle lettere per tutto il tempo d'attesa.
 */
export const LINE_BELOW = 145
export const LINE_ABOVE = -130

/** Righe di testo mascherate: entrano dal basso, escono verso l'alto (scrubbate). */
export function addLines(tl, lines, { at, out = null, dur = 0.06, outDur = 0.05, stagger = 0.012 }) {
  if (!lines.length) return
  tl.fromTo(
    lines,
    { yPercent: LINE_BELOW, opacity: 1 },
    { yPercent: 0, duration: dur, ease: 'power3.out', stagger, immediateRender: false },
    at,
  )
  if (out != null) {
    tl.fromTo(
      lines,
      { yPercent: 0 },
      { yPercent: LINE_ABOVE, duration: outDur, ease: 'power2.in', stagger: stagger * 0.6, immediateRender: false },
      out,
    )
  }
}

/** Elemento che compare con dissolvenza e un piccolo spostamento. */
export function addFade(tl, el, { at, out = null, dur = 0.04, y = 14 }) {
  if (!el) return
  tl.fromTo(el, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out', immediateRender: false }, at)
  if (out != null) {
    tl.fromTo(el, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -y, duration: dur, ease: 'power2.in', immediateRender: false }, out)
  }
}

/**
 * ScrollTrigger della sezione: pin dello stage con la timeline principale, ingresso prima del pin,
 * attivazione del rendering solo quando la sezione e' (quasi) sullo schermo.
 * Le timeline le chiede a ogni aggiornamento a timelines() ({ main, intro }): ricostruirle (testi
 * nuovi, scena 3D pronta, cambio prodotto) non tocca i trigger. Ricrearli voleva dire togliere e
 * rimettere il pin e rimisurare la pagina (fino a 100 ms su un telefono) proprio mentre ci si
 * avvicina alla sezione.
 */
export function createScrollAnimation({ section, stage, steps, getVh, scrub = true, timelines, onActive, onUpdate }) {
  // scrub: true = la timeline segue lo scroll; un numero = la raggiunge in quei secondi
  const lag = typeof scrub === 'number' && scrub > 0 ? scrub : 0
  const drive = (tl, p) => {
    if (!tl) return
    if (lag) gsap.to(tl, { progress: p, duration: lag, ease: 'power3', overwrite: true })
    else tl.progress(p)
  }
  const pin = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${steps * getVh()}`,
    pin: stage,
    pinSpacing: false,
    onUpdate: (self) => {
      drive(timelines().main, self.progress)
      onUpdate?.(self)
    },
    onRefresh: (self) => drive(timelines().main, self.progress),
  })
  const active = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => onActive?.(self.isActive),
  })
  const intro = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'top top',
    onUpdate: (self) => drive(timelines().intro, self.progress),
    onRefresh: (self) => drive(timelines().intro, self.progress),
  })
  const triggers = [pin, active, intro]
  return {
    triggers,
    /** dove si trova lo scroll: progresso della timeline principale e dell'ingresso */
    get progress() {
      return pin.progress
    },
    get introProgress() {
      return intro.progress
    },
    kill() {
      for (const t of triggers) t.kill(true)
    },
  }
}

export { gsap, ScrollTrigger }
