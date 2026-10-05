import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

const numberFormats = new Map()
function format(value, decimals) {
  if (!numberFormats.has(decimals)) {
    numberFormats.set(
      decimals,
      new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        useGrouping: 'always', // 10.000 anche con 4-5 cifre
      }),
    )
  }
  return numberFormats.get(decimals).format(value)
}

/** Divide i testi [data-split] in righe/lettere mascherate, nascoste fino alla rivelazione. */
export function prepareText(reduced) {
  document.querySelectorAll('[data-split]').forEach((el) => {
    const byChars = el.dataset.split === 'chars'
    // data-mask="none": lettere libere (entrate con zoom o rotazione 3D invece che dalla maschera)
    const masked = el.dataset.mask !== 'none'
    el._state = 'hidden'
    el._split = SplitText.create(el, {
      type: byChars ? 'lines,chars' : 'lines',
      mask: masked ? 'lines' : undefined,
      linesClass: 'line',
      charsClass: 'char',
      autoSplit: true,
      onSplit(self) {
        // dopo un re-split (resize / font) riapplica lo stato corrente
        const targets = byChars ? self.chars : self.lines
        const shown = el._state === 'shown'
        if (reduced || !masked) gsap.set(targets, { autoAlpha: shown ? 1 : 0 })
        else gsap.set(targets, { yPercent: shown ? 0 : 112, visibility: shown ? 'inherit' : 'hidden' })
        el.dispatchEvent(new CustomEvent('split', { detail: self }))
      },
    })
    gsap.set(el, { visibility: 'visible' })
  })

  document.querySelectorAll('[data-reveal]:not([data-split])').forEach((el) => {
    el._state = 'hidden'
    gsap.set(el, { autoAlpha: 0 })
  })
}

function targetsOf(el) {
  const s = el._split
  if (!s) return null
  return s.chars?.length ? { list: s.chars, chars: true } : { list: s.lines, chars: false }
}

/** Rivela un elemento. dir = 1 scorrendo in giu', -1 tornando su. */
export function show(el, { dir = 1, delay = 0, reduced = false } = {}) {
  if (el._state === 'shown') return
  el._state = 'shown'
  const t = targetsOf(el)
  if (reduced || el.hasAttribute('data-reveal-fade') || el.dataset.mask === 'none') {
    gsap.to(t ? t.list : el, { autoAlpha: 1, duration: reduced ? 0.5 : 0.7, delay, ease: 'power2.out', overwrite: true })
  } else if (t) {
    gsap.fromTo(
      t.list,
      { yPercent: dir > 0 ? 112 : -112, visibility: 'inherit' },
      {
        yPercent: 0,
        duration: t.chars ? 1.1 : 1.0,
        ease: 'expo.out',
        stagger: t.chars ? Math.min(0.03, 0.5 / t.list.length) : 0.08,
        delay,
        overwrite: true,
      },
    )
  } else {
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 26 * dir, filter: 'blur(8px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.95, ease: 'power3.out', delay, overwrite: true },
    )
  }
  countUp(el, delay + 0.1)
}

export function hide(el, { dir = 1, reduced = false } = {}) {
  if (el._state === 'hidden') return
  el._state = 'hidden'
  const t = targetsOf(el)
  if (reduced || el.hasAttribute('data-reveal-fade') || el.dataset.mask === 'none') {
    gsap.to(t ? t.list : el, { autoAlpha: 0, duration: 0.35, overwrite: true })
  } else if (t) {
    gsap.to(t.list, {
      yPercent: dir > 0 ? -112 : 112,
      duration: 0.6,
      ease: 'power3.in',
      stagger: t.chars ? Math.min(0.014, 0.25 / t.list.length) : 0.04,
      overwrite: true,
      // fuori dalla maschera virgole, apostrofi, accenti e code (Q) sporgono dal riquadro della
      // lettera e ne resterebbe visibile un filo sul bordo: a riposo le lettere nascoste spariscono
      onComplete: () => gsap.set(t.list, { visibility: 'hidden' }),
    })
  } else {
    gsap.to(el, { autoAlpha: 0, y: -20 * dir, filter: 'blur(8px)', duration: 0.45, ease: 'power2.in', overwrite: true })
  }
}

/** Numeri che salgono fino al valore reale indicato in data-count. */
export function countUp(root, delay = 0) {
  const list = root.matches?.('[data-count]') ? [root] : [...root.querySelectorAll('[data-count]')]
  for (const el of list) {
    const end = parseFloat(el.dataset.count)
    const decimals = parseInt(el.dataset.decimals || '0', 10)
    const o = { v: 0 }
    el._count?.kill()
    el.textContent = format(0, decimals)
    el._count = gsap.to(o, {
      v: end,
      duration: end > 100 ? 1.8 : 1.3,
      delay,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = format(decimals ? o.v : Math.round(o.v), decimals)
      },
    })
  }
}
