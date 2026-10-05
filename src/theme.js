/*
  Tema colori del prodotto attivo sulla pagina (le parti 3D si aggiornano in Stage/HeroFX/Silk).
  Le custom properties sono registrate con @property in base.css: durante il cambio prodotto
  la classe .is-theming le fa sfumare insieme, poi viene tolta (lo scroll resta immediato).
*/

let themingTimer = 0

/** Custom properties del tema: palette della narrazione + colori fissi della pagina. */
function themeVars(theme) {
  const p = theme.palette
  return {
    '--paper': p.paper,
    '--mist': p.mist,
    '--ink': p.ink,
    '--plum': p.plum,
    '--night': p.night,
    '--abyss': p.abyss,
    '--wine': p.wine,
    '--berry': p.berry,
    '--berry-hi': p.berryHi,
    ...theme.css,
  }
}

/** Applica il tema alla pagina; con animate i colori sfumano per `duration` secondi. */
export function applyCssTheme(theme, { animate = false, duration = 1.4 } = {}) {
  const root = document.documentElement
  if (animate) {
    // (solo se cambia: una custom property nuova sulla radice fa ricalcolare lo stile di tutta la pagina)
    const dur = `${duration}s`
    if (root.style.getPropertyValue('--theme-dur') !== dur) root.style.setProperty('--theme-dur', dur)
    root.classList.add('is-theming')
    clearTimeout(themingTimer)
    themingTimer = setTimeout(() => root.classList.remove('is-theming'), duration * 1000 + 150)
  }
  for (const [name, value] of Object.entries(themeVars(theme))) root.style.setProperty(name, value)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.palette.paper)
}

// liquido di RITUALE: superficie a onda, sfumatura dal pelo dell'acqua al fondo
const LIQUID_OFFSETS = [0, 0.025, 0.12, 0.3, 1]

/** Sostituisce il colore del liquido (immagine: non sfuma, va cambiato a lettere vuote). */
export function setLiquid(theme) {
  const stops = theme.liquid.map((c, i) => `<stop offset='${LIQUID_OFFSETS[i]}' stop-color='${c}'/>`).join('')
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 300' preserveAspectRatio='none'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>${stops}</linearGradient></defs>` +
    `<path d='M0 10C40 4 80 4 120 10S200 16 240 10V300H0z' fill='url(#g)'/></svg>`
  // sulla parola RITUALE, l'unica che la usa: sulla radice ogni elemento della pagina la ereditava
  // e andava ricalcolato a ogni cambio prodotto
  const target = document.querySelector('.hero-ritual__word') ?? document.documentElement
  target.style.setProperty('--rit-liquid', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`)
}
