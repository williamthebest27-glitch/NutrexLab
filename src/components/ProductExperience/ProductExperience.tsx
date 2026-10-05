'use client'

/*
  ProductExperience per React (Next.js, Vite + React...): un involucro sottile attorno al motore
  in JavaScript della stessa cartella (index.js). React disegna solo la sezione vuota, il motore
  ne crea il contenuto (immagine, canvas, testi) solo nel browser.

    import { ProductExperience } from './components/ProductExperience/ProductExperience'

    <ProductExperience
      type="capsule"
      productName="Coenzima Q10"
      theme={{ accent: '#e0a33a', capsule: '#c8862a' }}
      copy={{ titleA: ['Scienza.', 'Semplificata.'] }}
    />

  - type, productName, productNote, theme, copy, model, poster si possono cambiare quando si vuole:
    stessa scena, testi e colori nuovi; se cambia il tipo si scarica solo il modello che serve.
  - steps (lunghezza in schermate di scroll): se cambia, la sezione si ricrea.
  - le altre opzioni (cartelle, logo inciso, qualita'...) si leggono quando il componente si monta.
  - servono gsap e three nel progetto, e in public/ le cartelle models/nutrexlab, images/nutrexlab
    e draco del sito (oppure modelsPath, postersPath e dracoPath).
*/

import { useEffect, useRef, type CSSProperties } from 'react'
import './productExperience.css'
import type { ProductExperience as Engine, ProductExperienceOptions } from './index.js'

export type {
  ProductType,
  ProductExperienceTheme,
  ProductExperienceCopy,
  ProductExperienceOptions,
  EtchLogo,
} from './index.js'

export interface ProductExperienceProps extends ProductExperienceOptions {
  id?: string
  /** classe in piu' sulla sezione (letta al montaggio: il motore aggiunge le sue) */
  className?: string
  style?: CSSProperties
  /** il motore e' stato creato (per esempio per chiamare init3D() subito) */
  onReady?: (engine: Engine) => void
}

/** Solo i dati che setProduct() sa aggiornare senza ricreare la sezione. */
const productKey = (o: ProductExperienceOptions) =>
  JSON.stringify([
    o.type ?? null,
    o.productName ?? '',
    o.productNote ?? '',
    o.model ?? null,
    o.theme ?? null,
    o.copy ?? null,
    typeof o.poster === 'string' ? o.poster : null,
  ])

export function ProductExperience({ id, className, style, onReady, ...options }: ProductExperienceProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const engineRef = useRef<Engine | null>(null)
  const applied = useRef<string | null>(null)
  const latest = useRef({ options, onReady })
  // la classe resta quella del primo render: se React la riscrivesse cancellerebbe quelle del motore
  const sectionClass = useRef(className ? `pe ${className}` : 'pe').current
  const steps = options.steps ?? 4
  const key = productKey(options)

  // prima degli altri effetti: le loro callback leggono sempre le props dell'ultimo render
  useEffect(() => {
    latest.current = { options, onReady }
  })

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    let alive = true

    // altezza dello schermo stabile, come nel sito: su mobile non cambia quando compare o sparisce
    // la barra degli indirizzi (altrimenti la sezione cambierebbe lunghezza durante lo scroll)
    let vw = window.innerWidth
    let vh = window.innerHeight
    const ownVh = !latest.current.options.getVh
    const touch = matchMedia('(hover: none) and (pointer: coarse)').matches
    const setVh = () => {
      if (ownVh) section.style.setProperty('--pe-vh', `${vh}px`)
    }
    const onResize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      if (touch && w === vw && Math.abs(h - vh) < 160) return
      vw = w
      vh = h
      setVh()
    }
    setVh()
    window.addEventListener('resize', onResize)

    // il motore (three, gsap) si carica solo nel browser e solo qui
    import('./index.js')
      .then(({ createProductExperience }) => {
        if (!alive) return
        const { options, onReady } = latest.current
        const engine = createProductExperience(section, ownVh ? { ...options, getVh: () => vh } : options)
        engineRef.current = engine
        applied.current = productKey(options)
        onReady?.(engine)
      })
      .catch((err) => console.warn('ProductExperience: motore non caricato.', err))

    return () => {
      alive = false
      window.removeEventListener('resize', onResize)
      engineRef.current?.destroy()
      engineRef.current = null
      // la sezione resta alta quanto serve mentre arriva quella nuova (cambio di steps)
      section.classList.add('pe')
    }
  }, [steps])

  // cambio prodotto: stessa scena, testi e colori nuovi
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || applied.current === key) return
    applied.current = key
    const { type, theme, copy, productName, productNote, model, poster } = latest.current.options
    void engine.setProduct({ type, theme, copy, productName, productNote, model, poster })
  }, [key])

  return <section ref={sectionRef} id={id} className={sectionClass} style={{ '--pe-steps': steps, ...style } as CSSProperties} />
}

export default ProductExperience
