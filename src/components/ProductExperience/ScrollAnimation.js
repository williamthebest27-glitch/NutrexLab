import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/*
  Controllo tramite lo scroll (GSAP + ScrollTrigger).

  Una sola timeline GSAP in pausa, lunga 1 (= 0..100% della sezione), descrive tutto: tempo del
  racconto, camera, prodotto, effetti e testi. ScrollTrigger la "scrubba" mentre lo stage della
  sezione e' pinnato (pin: true): la scena e' sempre funzione della posizione di scroll, quindi
  tornando indietro torna indietro. Un secondo trigger anima l'ingresso (prima del pin).

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
 */
export function createScrollAnimation({ section, stage, steps, getVh, scrub, main, intro, onActive, onUpdate }) {
  const triggers = [
    ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: () => `+=${steps * getVh()}`,
      pin: stage,
      pinSpacing: false,
      scrub,
      animation: main,
      invalidateOnRefresh: true,
      onUpdate,
    }),
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => onActive?.(self.isActive),
    }),
  ]
  if (intro) {
    triggers.push(
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'top top',
        scrub,
        animation: intro,
        invalidateOnRefresh: true,
      }),
    )
  }
  return {
    triggers,
    get progress() {
      return main.progress()
    },
    kill() {
      for (const t of triggers) t.kill(true)
    },
  }
}

export { gsap, ScrollTrigger }
