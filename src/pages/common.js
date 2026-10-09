import '@fontsource-variable/archivo/wdth.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '../styles/base.css'
import '../styles/pages.css'

import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import Lenis from 'lenis'
import { MEDIA } from '../config.js'
import { mountLogos, composeLogo } from '../ui/logo.js'
import { initNavLinks } from '../ui/navLinks.js'
import { initNavMenu } from '../ui/navMenu.js'
import { createMobileMenu } from '../ui/mobileMenu.js'
import { initPointer } from '../ui/pointer.js'
import { prepareText, show } from '../ui/text.js'
import { makeGrain } from '../ui/grain.js'
import { bindCartCount } from '../shop/cart.js'
import { initCookieNotice } from '../ui/cookieNotice.js'
import { ready as i18nReady } from '../i18n/index.js'
import { initLangPicker } from '../i18n/picker.js'

// lingua del sito scelta dal visitatore (src/i18n): le pagine disegnano gia' nella lingua giusta
await i18nReady

gsap.registerPlugin(SplitText)

/*
  Struttura comune delle pagine (Acquista, Carrello, Contatti...): stessa navbar della
  homepage con il sottomenu di Acquista, menu mobile, footer con il logo che si compone,
  scroll morbido e testi che salgono dalla maschera entrando in scena (come nella homepage).
*/

const html = document.documentElement
export const reduced = matchMedia(MEDIA.reduced).matches
const phone = matchMedia(MEDIA.mobile)
export const isPhone = () => phone.matches

/**
 * Prepara la pagina. Ritorna { lenis, ready }: ready si risolve quando i testi sono divisi e
 * pronti a comparire (font caricati), da li' si possono aggiungere le proprie animazioni.
 */
export function initPage() {
  html.classList.add('is-page')
  html.style.setProperty('--vh', `${window.innerHeight}px`)
  mountLogos()
  initNavLinks()
  initNavMenu()
  initLangPicker()
  bindCartCount()
  makeGrain()

  const lenis = reduced ? null : new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -96 } })
  createMobileMenu({ lenis, reduced })
  initPointer(null, { reduced }) // pulsanti magnetici
  navState()
  footerLogo()
  // l'esagono finale dei titoli e' nascosto da subito: compare con il suo titolo
  const dots = document.querySelectorAll('.hexdot')
  if (!reduced && dots.length) gsap.set(dots, { scale: 0, transformOrigin: '50% 50%' })

  const ready = fontsReady().then(() => {
    prepareText(reduced)
    observeReveals()
  })
  // avviso sui cookie dopo l'ingresso dei titoli
  ready.then(() => setTimeout(initCookieNotice, 1200))
  return { lenis, ready }
}

function fontsReady() {
  const fonts = document.fonts
  if (!fonts) return Promise.resolve()
  const load = Promise.all([fonts.load('600 1em "Archivo Variable"'), fonts.load('500 1em "IBM Plex Mono"')]).catch(() => {})
  return Promise.race([load.then(() => fonts.ready), new Promise((r) => setTimeout(r, 1500))])
}

/**
 * Navbar: compatta appena si scorre (come nella homepage), chiara sopra le parti scure
 * ([data-nav-dark] e il footer).
 */
function navState() {
  const nav = document.querySelector('[data-nav]')
  if (!nav) return
  let dark = []
  let compact = null
  let inverse = null
  const measure = () => {
    const y = window.scrollY
    dark = [...document.querySelectorAll('[data-nav-dark], [data-footer]')].map((el) => {
      const r = el.getBoundingClientRect()
      return [r.top + y, r.bottom + y]
    })
  }
  const update = () => {
    const y = window.scrollY
    const mid = y + 30 // linea centrale della navbar compatta
    const c = y > 40
    const inv = dark.some(([a, b]) => mid >= a && mid <= b)
    if (c !== compact) nav.classList.toggle('is-compact', (compact = c))
    if (inv !== inverse) nav.classList.toggle('is-inverse', (inverse = inv))
  }
  const refresh = () => {
    measure()
    update()
  }
  refresh()
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', refresh)
  // il contenuto cambia altezza (carrello, filtri, font): le parti scure si spostano
  new ResizeObserver(refresh).observe(document.body)
}

/** Il logo del footer si compone quando entra in scena (sul telefono solo una dissolvenza). */
function footerLogo() {
  const footer = document.querySelector('[data-footer]')
  const svg = footer?.querySelector('.footer__brand .logo')
  if (!svg) return
  const tl = composeLogo(svg, { reduced: reduced || phone.matches, speed: 1.15 })
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) tl.play()
      else if (e.boundingClientRect.top > 0) tl.reverse()
    },
    { rootMargin: '0px 0px -25% 0px' },
  ).observe(footer)
}

/** Titoli e testi ([data-split], [data-reveal]) compaiono entrando nello schermo, uno dopo l'altro. */
function observeReveals() {
  const io = new IntersectionObserver(
    (entries) => {
      let i = 0
      for (const e of entries) {
        if (!e.isIntersecting) continue
        io.unobserve(e.target)
        const delay = parseFloat(e.target.dataset.delay || '0') + Math.min(i++ * 0.08, 0.4)
        show(e.target, { delay, reduced })
        const dot = e.target.parentElement?.querySelector(':scope > .hexdot')
        if (dot && !reduced) {
          gsap.fromTo(dot, { scale: 0, rotation: -140 }, { scale: 1, rotation: 0, duration: 1, ease: 'back.out(2.6)', delay: delay + 0.45 })
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  )
  document.querySelectorAll('[data-split], [data-reveal]').forEach((el) => io.observe(el))
}

/**
 * Elementi che salgono e compaiono entrando in scena, a gruppi (schede dei prodotti, righe).
 * Sono nascosti da subito; con after (di solito ready di initPage) cominciano a comparire solo dopo,
 * insieme ai titoli. (Nascondendoli solo a pagina pronta, con una rete lenta si vedevano comparire,
 * sparire all'arrivo dei font e rientrare.) observe(el) per gli elementi aggiunti dopo.
 */
export function rise(els, { y = 56, stagger = 0.08, after = null } = {}) {
  const list = [...els]
  const hide = (el) => gsap.set(el, { autoAlpha: 0, y: reduced ? 0 : y })
  const begin = after ?? Promise.resolve()
  hide(list)
  const io = new IntersectionObserver(
    (entries) => {
      const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target)
      if (!batch.length) return
      batch.forEach((el) => io.unobserve(el))
      gsap.to(batch, {
        autoAlpha: 1,
        y: 0,
        duration: reduced ? 0.5 : 1.1,
        ease: 'expo.out',
        stagger: reduced ? 0 : stagger,
        overwrite: 'auto',
        clearProps: 'transform',
      })
    },
    { rootMargin: '0px 0px -6% 0px' },
  )
  begin.then(() => list.forEach((el) => io.observe(el)))
  return {
    observe(el) {
      hide(el)
      begin.then(() => io.observe(el))
    },
  }
}

/** Testo sicuro da inserire in HTML. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
