import gsap from 'gsap'
import { MEDIA } from '../config.js'

/**
 * Interazioni del puntatore (il cursore resta quello normale del sistema):
 * - il barattolo si inclina leggermente verso il mouse
 * - bottoni magnetici sui dispositivi con mouse
 */
export function initPointer(stage, { reduced }) {
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!stage) return
      stage.pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      stage.pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    },
    { passive: true },
  )

  if (reduced || !matchMedia(MEDIA.finePointer).matches) return

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const label = el.querySelector('.btn__label')
    const ex = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' })
    const ey = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' })
    const lx = label && gsap.quickTo(label, 'x', { duration: 0.6, ease: 'power3' })
    const ly = label && gsap.quickTo(label, 'y', { duration: 0.6, ease: 'power3' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      ex(dx * 0.26)
      ey(dy * 0.34)
      lx?.(dx * 0.1)
      ly?.(dy * 0.14)
    })
    el.addEventListener('pointerleave', () => {
      gsap.to([el, label].filter(Boolean), { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)', overwrite: true })
    })
  })
}
