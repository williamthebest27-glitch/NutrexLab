// Modelli 3D e temi dei prodotti: src/products.js (copiati in public/models con `npm run sync-model`).

// palette del collagene (riserva di buildMaster; i temi dei prodotti sono in products.js)
export const COLORS = {
  paper: '#f1f0f3',
  mist: '#e2e1e7',
  ink: '#0e0c11',
  plum: '#1e0b1c',
  night: '#0d0a0f',
  abyss: '#08060a',
  wine: '#3b0b27',
  berry: '#9e2e65',
  berryHi: '#d45c95',
}

export const MEDIA = {
  // i tablet in verticale usano l'impaginazione verticale del mobile
  mobile: '(max-width: 767px), (max-width: 1023px) and (orientation: portrait)',
  tablet: '(min-width: 768px) and (max-width: 1023px) and (orientation: landscape)',
  desktop: '(min-width: 1024px)',
  reduced: '(prefers-reduced-motion: reduce)',
  finePointer: '(hover: hover) and (pointer: fine)',
}

export function currentLayout() {
  if (matchMedia(MEDIA.mobile).matches) return 'mobile'
  if (matchMedia(MEDIA.tablet).matches) return 'tablet'
  return 'desktop'
}

/** Passi di una sezione nel layout: sul telefono una sezione puo' averne meno (data-steps-mobile). */
export function sectionSteps(section, layout = currentLayout()) {
  return parseFloat((layout === 'mobile' && section.dataset.stepsMobile) || section.dataset.steps)
}

/** Altezza di ogni sezione nel layout (--steps, sections.css: passi + 1 viewport). */
export function applySectionSteps(layout = currentLayout()) {
  document.querySelectorAll('[data-section]').forEach((s) => s.style.setProperty('--steps', String(sectionSteps(s, layout))))
}

/** Posizione (in "viewport scrollate") di ogni sezione: ogni sezione occupa passi + 1. */
export function sectionTops(layout = currentLayout()) {
  const tops = {}
  let acc = 0
  document.querySelectorAll('[data-section]').forEach((section) => {
    const steps = sectionSteps(section, layout)
    tops[section.dataset.section] = acc
    acc += steps + 1
  })
  tops.footer = acc
  // il footer e' alto una viewport: lo scroll massimo coincide con il suo inizio + 1 - 1
  tops.end = acc
  return tops
}
