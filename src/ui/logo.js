import gsap from 'gsap'
import { LOGO } from './logo-paths.js'

let uid = 0

/** SVG del logo: monogramma, lettere NUTREX (ognuna animabile) e LAB. */
export function logoSVG(label = 'Nutrex Lab') {
  const id = `logo-clip-${++uid}`
  const letters = LOGO.letters.map((d) => `<path class="logo__l" d="${d}"/>`).join('')
  const lab = LOGO.lab.map((d) => `<path class="logo__b" d="${d}"/>`).join('')
  return `<svg class="logo" viewBox="${LOGO.viewBox}" role="img" aria-label="${label}">
    <defs><clipPath id="${id}"><rect x="290" y="40" width="960" height="214"/></clipPath></defs>
    <path class="logo__hex" d="${LOGO.hex}" fill-rule="evenodd"/>
    <g class="logo__word" clip-path="url(#${id})">${letters}</g>
    <g class="logo__lab">${lab}</g>
  </svg>`
}

/** Sostituisce i segnaposto [data-logo] (che contengono il testo di riserva) con l'SVG. */
export function mountLogos() {
  document.querySelectorAll('[data-logo]').forEach((el) => {
    el.innerHTML = logoSVG()
  })
}

/**
 * Il logo "si compone": il monogramma disegna il contorno e si riempie,
 * le lettere salgono dalla maschera una dopo l'altra, poi compare LAB.
 */
export function composeLogo(svg, { reduced = false, speed = 1 } = {}) {
  const hex = svg.querySelector('.logo__hex')
  const letters = svg.querySelectorAll('.logo__l')
  const lab = svg.querySelectorAll('.logo__b')
  const tl = gsap.timeline({ paused: true })

  if (reduced) {
    gsap.set(svg, { autoAlpha: 0 })
    tl.to(svg, { autoAlpha: 1, duration: 0.6 })
    return tl
  }

  const len = hex.getTotalLength()
  gsap.set(hex, {
    strokeDasharray: len,
    strokeDashoffset: len,
    fillOpacity: 0,
    strokeWidth: 5,
    rotation: -24,
    scale: 0.84,
    transformOrigin: '50% 50%',
  })
  gsap.set(letters, { y: 230 })
  gsap.set(lab, { autoAlpha: 0, y: 34 })
  gsap.set(svg, { autoAlpha: 1 })

  tl.to(hex, { strokeDashoffset: 0, duration: 1.25, ease: 'power2.inOut' }, 0)
    .to(hex, { rotation: 0, scale: 1, duration: 1.5, ease: 'expo.out' }, 0)
    .to(hex, { fillOpacity: 1, duration: 0.55, ease: 'power2.out' }, 0.95)
    .to(hex, { strokeWidth: 0, duration: 0.45, ease: 'power1.out' }, 1.15)
    .to(letters, { y: 0, duration: 1.05, ease: 'expo.out', stagger: 0.065 }, 0.42)
    .to(lab, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 1.05)
  tl.timeScale(speed)
  return tl
}

/** Punto da cui parte lo zoom: il centro del monogramma (dentro la diagonale bianca della N). */
export const LOGO_ORIGIN = LOGO.origin.join(' ')
