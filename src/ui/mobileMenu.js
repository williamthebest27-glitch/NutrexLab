import gsap from 'gsap'
import { MEDIA } from '../config.js'
import { composeLogo } from './logo.js'
import { t, onLang } from '../i18n/index.js'

/**
 * Menu mobile (hamburger accanto ad "Acquista ora"): pannello a tutto schermo con le pagine
 * (Homepage, Acquista, Carrello, Contatti, Account) e il logo in fondo.
 *
 * Apertura: il pannello scende dall'alto con il bordo curvo del sipario, le voci salgono dalla
 * maschera una alla volta mentre i filetti si disegnano, poi il logo si compone.
 * Chiusura (piu' rapida): le voci escono verso l'alto, il logo sfuma, il pannello risale.
 * Riaprendo a meta' chiusura la chiusura torna indietro, senza salti.
 * Solo trasformazioni e opacita': fluide anche sui telefoni. Mentre il pannello copre lo schermo
 * la pagina sotto non scorre e (covers) il 3D dietro puo' smettere di disegnare.
 *
 * Classi sulla radice: mnav-open (stato del pulsante: la X) cambia subito; mnav-shown (navbar chiara,
 * pulsante PRODOTTI nascosto) resta finche' il pannello e' sullo schermo.
 *
 * Le voci con data-goto vengono gestite da initNav (main.js): questo modulo va creato prima, cosi'
 * al tocco il menu si chiude e lo scroll riparte prima del salto.
 */
export function createMobileMenu({ lenis = null, reduced = false, onOpen = null } = {}) {
  const root = document.querySelector('[data-mnav]')
  const toggle = document.querySelector('[data-mnav-toggle]')
  if (!root || !toggle) return null

  const html = document.documentElement
  const links = [...root.querySelectorAll('.mnav__link')]
  const panel = root.querySelector('.mnav__panel')
  const curve = root.querySelector('.mnav__curve')
  const words = links.map((a) => a.querySelector('.mnav__t'))
  // numeri delle voci e quanti prodotti ci sono nel carrello (accanto a Carrello)
  const nums = [...root.querySelectorAll('.mnav__n, .mnav__count')]
  const rules = links.map((a) => a.querySelector('.mnav__rule'))
  const logoWrap = root.querySelector('.mnav__logo')
  let openTl = null
  let closeTl = null
  let open = false
  let covers = false
  // testo del pulsante nella lingua del sito (anche dopo un cambio di lingua)
  const label = () => toggle.setAttribute('aria-label', open ? t('Chiudi il menu') : t('Apri il menu'))
  onLang(label)

  /** Timeline di apertura, creata al primo uso (su desktop il menu non esiste). */
  function buildOpen() {
    const t = gsap.timeline({ paused: true })
    if (reduced) {
      t.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power1.out' })
      t.call(() => (covers = open), null, 0.3)
      return t
    }
    // il pannello scende (anche il bordo curvo esce dallo schermo); la curva si allunga in caduta
    t.fromTo(panel, { yPercent: -118 }, { yPercent: 0, duration: 0.8, ease: 'expo.inOut' }, 0)
    t.fromTo(curve, { scaleY: 1.7 }, { scaleY: 0.6, duration: 0.8, ease: 'power2.inOut' }, 0)
    // da qui il pannello copre tutto: il 3D dietro puo' smettere di disegnare
    t.call(() => (covers = open), null, 0.8)
    // voci: salgono dalla maschera una alla volta, filetti e numeri le seguono
    t.fromTo(words, { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'expo.out', stagger: 0.075 }, 0.38)
    t.fromTo(rules, { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: 'expo.out', stagger: 0.075 }, 0.46)
    t.fromTo(nums, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out', stagger: 0.075 }, 0.5)
    // logo: si compone (contorno, riempimento, lettere che salgono)
    const logo = logoWrap?.querySelector('.logo')
    if (logo) {
      t.fromTo(logoWrap, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0.58)
      t.add(composeLogo(logo, { speed: 1.35 }).paused(false), 0.58)
    }
    return t
  }

  /** Chiusura dallo stato attuale (anche a meta' apertura). */
  function buildClose() {
    const done = () => {
      root.classList.remove('is-open')
      html.classList.remove('mnav-shown')
      openTl.pause(0) // voci, filetti e logo tornano allo stato di partenza per la prossima apertura
    }
    const t = gsap.timeline({ onComplete: done })
    if (reduced) return t.to(root, { autoAlpha: 0, duration: 0.25, ease: 'power1.in' })
    t.to(words, { yPercent: -118, duration: 0.42, ease: 'power3.in', stagger: 0.035 }, 0)
    t.to(rules, { scaleX: 0, duration: 0.4, ease: 'power3.in', stagger: 0.035 }, 0)
    t.to(nums, { autoAlpha: 0, x: -6, duration: 0.25, ease: 'power2.in' }, 0)
    if (logoWrap) t.to(logoWrap, { autoAlpha: 0, y: 12, duration: 0.32, ease: 'power2.in' }, 0)
    t.to(panel, { yPercent: -118, duration: 0.68, ease: 'expo.inOut' }, 0.14)
    t.to(curve, { scaleY: 1.7, duration: 0.68, ease: 'power2.inOut' }, 0.14)
    return t
  }

  function setOpen(next, { focus = false } = {}) {
    if (next === open) return
    open = next
    openTl ??= buildOpen()
    toggle.setAttribute('aria-expanded', String(open))
    label()
    root.setAttribute('aria-hidden', String(!open))
    html.classList.toggle('mnav-open', open)
    if (open) {
      onOpen?.()
      lenis?.stop()
      root.classList.add('is-open')
      html.classList.add('mnav-shown')
      if (closeTl && closeTl.progress() < 1) {
        // si stava chiudendo: la chiusura torna indietro, poi l'apertura finisce (se era a meta')
        closeTl.eventCallback('onReverseComplete', () => {
          if (openTl.progress() < 1) openTl.play()
          else covers = open
        })
        closeTl.reverse()
      } else {
        openTl.timeScale(1).play()
      }
      if (focus) setTimeout(() => links[0]?.focus({ preventScroll: true }), 400)
    } else {
      covers = false
      lenis?.start()
      openTl.pause()
      closeTl?.kill()
      closeTl = buildClose()
      if (focus) toggle.focus({ preventScroll: true })
    }
  }

  // (detail 0: attivato da tastiera, il fuoco segue il menu)
  toggle.addEventListener('click', (e) => setOpen(!open, { focus: e.detail === 0 }))
  links.forEach((a) => a.addEventListener('click', () => setOpen(false)))
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false, { focus: true })
  })
  // passando a un layout desktop (rotazione, finestra piu' larga) il menu non c'e' piu'
  matchMedia(MEDIA.mobile).addEventListener('change', (m) => {
    if (m.matches || !open) return
    setOpen(false)
    closeTl?.progress(1)
  })

  return {
    close: () => setOpen(false),
    get isOpen() {
      return open
    },
    /** il pannello copre tutto lo schermo: il 3D dietro puo' non disegnare */
    get covers() {
      return covers
    },
  }
}
