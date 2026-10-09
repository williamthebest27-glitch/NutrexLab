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
 * { studio: 'scuro' }: lo studio del render di Blender, con il bicchiere renderizzato (vetro, acqua
 * e logo inciso sono le immagini del render): fondo nero per tutti i prodotti (punto del nero
 * nella passata finale, blackPoint), piano illuminato solo attorno al bicchiere (capsule e
 * compresse bianche si staccano dal fondo), testi chiari; accento, polvere e pastiglie come nel
 * resto del sito.
 */
export function themeFromSite(theme, { studio = 'dark' } = {}) {
  const p = theme.palette
  if (studio === 'scuro') {
    return {
      studio,
      // la parete grigia del render (luminanza ~0.05 sullo schermo) e quello che se ne vede
      // attraverso il bicchiere diventano nero pieno
      blackPoint: 0.06,
      // fondo della sezione (bordi sfumati): nero come la parete sullo schermo
      cssBg: '#000000',
      bgLow: '#2e2e30',
      bgGlow: '#161617',
      pool: '#ffffff',
      // pozza di luce solo attorno al bicchiere: i pezzi posati accanto restano sul grigio
      poolGain: 1.6,
      poolR: 0.07,
      cloud: '#e2e0dc',
      rim: '#ffffff',
      accent: p.berryHi,
      powder: theme.powder?.[3] ?? '#ffffff',
      capsuleBody: '#f3f0e9',
      tablet: '#efeae1',
      speckle: theme.dust ?? theme.swatch,
    }
  }
  return {
    // nero/charcoal con appena il colore del prodotto (niente fondi saturi)
    bgLow: mixHex('#050506', p.night, 0.25),
    bgGlow: mixHex('#1c1c1f', p.wine, 0.12),
    pool: mixHex('#131315', p.plum, 0.1),
    cloud: '#dbd8d4',
    rim: theme.rim,
    accent: p.berryHi,
    powder: theme.powder?.[3] ?? '#ffffff',
    capsuleBody: '#f3f0e9', // capsula tutta bianca, polvere bianca dentro
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
