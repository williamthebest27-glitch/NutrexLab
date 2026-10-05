import './productExperience.css'
import { ProductExperience } from './ProductExperienceCore.js'

/*
  NutrexLab ProductExperience: sezione 3D pinnata, riutilizzabile per ogni prodotto.

  JavaScript (come nel sito):
    import { createProductExperience } from './components/ProductExperience/index.js'
    const exp = createProductExperience(document.querySelector('#rituale'), {
      type: 'powder',                          // powder | capsule | tablet: sceglie l'animazione
      model: '/models/nutrexlab/scoop.glb',    // facoltativo: modello del prodotto al posto di quello del tipo
      productName: 'Collagene marino',
    })

  HTML dichiarativo:
    <section data-product-experience data-type="capsule" data-product-name="Omega 3"></section>
    mountProductExperiences()

  React: ProductExperience.tsx nella stessa cartella (il motore e' in ProductExperienceCore.js).
*/

export { ProductExperience }
export { STEPS, DEFAULT_COPY } from './copy.js'

export function createProductExperience(section, options = {}) {
  return new ProductExperience(section, options)
}

/** Monta tutte le sezioni [data-product-experience] (data-type, data-model, data-product-name, data-steps). */
export function mountProductExperiences(root = document, defaults = {}) {
  return [...root.querySelectorAll('[data-product-experience]')].map(
    (el) =>
      new ProductExperience(el, {
        ...defaults,
        type: el.dataset.type ?? defaults.type,
        model: el.dataset.model ?? defaults.model ?? null,
        productName: el.dataset.productName ?? defaults.productName ?? '',
        steps: el.dataset.steps ? parseFloat(el.dataset.steps) : defaults.steps,
      }),
  )
}

/**
 * Colori dello studio dal tema di un prodotto del sito (src/products.js): fondo quasi nero tinto
 * col colore del prodotto, alone dietro al bicchiere, controluce e accenti.
 */
export function themeFromSite(theme) {
  const p = theme.palette
  return {
    // nero/charcoal con appena il colore del prodotto (niente fondi saturi)
    bgLow: mixHex('#050506', p.night, 0.25),
    bgGlow: mixHex('#1c1c1f', p.wine, 0.12),
    pool: mixHex('#131315', p.plum, 0.1),
    cloud: '#dbd8d4',
    rim: theme.rim,
    accent: p.berryHi,
    powder: theme.powder?.[3] ?? '#ffffff',
    capsule: theme.swatch,
    capsuleBody: '#f3f0e9',
    fill: theme.powder?.[0] ?? '#e3b04a',
    tablet: '#efeae1',
    speckle: theme.dust ?? theme.swatch,
  }
}

/** Miscela due colori esadecimali sRGB (t = 0 -> a, t = 1 -> b). */
function mixHex(a, b, t) {
  const ca = parseInt(a.slice(1), 16)
  const cb = parseInt(b.slice(1), 16)
  let out = 0
  for (const sh of [16, 8, 0]) {
    const x = (ca >> sh) & 255
    const y = (cb >> sh) & 255
    out |= Math.round(x + (y - x) * t) << sh
  }
  return `#${out.toString(16).padStart(6, '0')}`
}
