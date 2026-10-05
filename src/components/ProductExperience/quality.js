/*
  Qualita' per dispositivo. Desktop: esperienza completa. Tablet: meno particelle, niente MSAA.
  Mobile: risoluzione e particelle ridotte, vetro senza dispersione cromatica, ma stessa scena
  (non diventa un'immagine statica). La risoluzione scende ancora da sola se i 60 fps non tengono.
*/

const MEDIA = {
  mobile: '(max-width: 767px), (max-width: 1023px) and (orientation: portrait)',
  tablet: '(min-width: 768px) and (max-width: 1023px) and (orientation: landscape)',
}

export function currentLayout() {
  if (matchMedia(MEDIA.mobile).matches) return 'mobile'
  if (matchMedia(MEDIA.tablet).matches) return 'tablet'
  return 'desktop'
}

export function detectQuality(layout) {
  const dpr = window.devicePixelRatio || 1
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 8
  if (layout === 'mobile') {
    return { tier: 'low', dpr: Math.min(dpr, 1.5), minDpr: 0.85, msaa: 0, insideScale: 0.5, particles: 0.4, dispersion: 0, floorReflect: 0.6 }
  }
  if (layout === 'tablet' || cores <= 4 || memory <= 4) {
    return { tier: 'mid', dpr: Math.min(dpr, 1.5), minDpr: 1, msaa: 0, insideScale: 0.5, particles: 0.65, dispersion: 0.35, floorReflect: 1 }
  }
  return { tier: 'high', dpr: Math.min(dpr, 1.6), minDpr: 1, msaa: 2, insideScale: 0.5, particles: 1, dispersion: 0.5, floorReflect: 1 }
}

/** WebGL2 disponibile? (senza: immagine statica e testi, la sezione non resta vuota) */
export function webglAvailable() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext() // libera subito il contesto di prova
    return true
  } catch {
    return false
  }
}
