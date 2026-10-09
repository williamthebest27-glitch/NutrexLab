/*
  Tipi del motore della sezione 3D (index.js), per l'uso da TypeScript e da ProductExperience.tsx.
  Il sito NutrexLab e' in JavaScript e non li usa.
*/

/** Sceglie l'animazione: polvere nel bicchiere, oppure capsula / compressa accanto al bicchiere. */
export type ProductType = 'powder' | 'capsule' | 'tablet'

/** Forma del prodotto per i tipi che ne hanno piu' d'una (compressa: rotonda di base, oppure ovale). */
export type ProductShape = 'oval'

/** Impaginazione attuale (stessi limiti del CSS della sezione). */
export type Layout = 'desktop' | 'tablet' | 'mobile'

/** Colori dello studio e del prodotto (esadecimali sRGB, es. '#d45c95'); quelli assenti restano di default. */
export interface ProductExperienceTheme {
  /** fondo quasi nero */
  bgLow?: string
  /** alone dietro al bicchiere */
  bgGlow?: string
  /** luce sul piano */
  pool?: string
  /** nuvola della polvere nell'acqua */
  cloud?: string
  /** controluce sui bordi */
  rim?: string
  /** accenti dell'interfaccia: ultima riga dei titoli, etichette, sequenza */
  accent?: string
  /** polvere nel misurino */
  powder?: string
  /** capsula (tutta bianca: testa e corpo; la polvere dentro e' bianca) */
  capsuleBody?: string
  /** compressa e puntini */
  tablet?: string
  speckle?: string
  /** 'scuro': studio del render di Blender con il bicchiere renderizzato (immagini in vetro/scuro/) */
  studio?: 'dark' | 'scuro'
  /** luce sul piano: intensita' (moltiplica pool) e raggio della pozza attorno al bicchiere (m) */
  poolGain?: number
  poolR?: number
  /** punto del nero dell'immagine finale (luminanza lineare, 0-0.3): i toni fino a qui diventano neri (0 = spento) */
  blackPoint?: number
  /** fondo CSS della sezione (bordi sfumati), se diverso da bgLow */
  cssBg?: string
}

/** [testo grande, testo piccolo, evidenziata] di un'etichetta agganciata al 3D (evidenziata: titolo nel colore d'accento). */
export type PinCopy = [title: string, text: string, accent?: boolean]

/** Testi della sezione; quelli assenti restano quelli di default del tipo (copy.js). */
export interface ProductExperienceCopy {
  eyebrow?: string
  /** righe del titolo d'apertura (una voce per riga, l'ultima nel colore d'accento) */
  titleA?: string[]
  /** righe del titolo finale */
  titleB?: string[]
  /** dose: sul prodotto; water: sul bicchiere; aside: sui pezzi a parte (solo con aside > 0) */
  pins?: { dose?: PinCopy; water?: PinCopy; aside?: PinCopy }
  /**
   * fino a tre benefici: capsule e compresse attorno al prodotto nella macro, al posto di pins.dose;
   * polvere attorno al bicchiere alla fine
   */
  benefits?: PinCopy[]
}

export interface ProductExperienceQuality {
  tier: 'low' | 'mid' | 'high'
  /** risoluzione massima (rapporto pixel) */
  dpr: number
  /** risoluzione minima se i 60 fps non tengono */
  minDpr: number
  /** campioni MSAA (0 = spento) */
  msaa: number
  insideScale: number
  /** quantita' di particelle della polvere (0..1) */
  particles: number
  /** dispersione cromatica del vetro (0 = spenta) */
  dispersion: number
  floorReflect: number
}

/** Logo vettoriale da incidere sul vetro (formato di src/ui/logo-paths.js del sito). */
export interface EtchLogo {
  viewBox: string
  /** tracciato con fill-rule evenodd (fori) */
  hex?: string
  letters?: string[]
  lab?: string[]
  paths?: string[]
}

export interface EtchOptions {
  /** larghezza del logo sul vetro in metri (default 0.042) */
  width?: number
  /** altezza dal piano in metri (default 0.038) */
  y?: number
  /** intensita' 0..1 (default 0.85) */
  strength?: number
}

export interface ProductExperienceOptions {
  type?: ProductType
  /** durata del pin in schermate di scroll (default 4) */
  steps?: number
  productName?: string
  productNote?: string
  /** numero del capitolo davanti al sopratitolo (es. '05') */
  chapter?: string
  /** modello del prodotto al posto di quello del tipo (scoop.glb, capsule.glb o tablet.glb) */
  model?: string | null
  /** forma, per i tipi che ne hanno piu' d'una: 'oval' = compressa ovale con linea di frattura */
  shape?: ProductShape | null
  /** capsule o compresse della dose del giorno: alla fine si posano tutte accanto al bicchiere (default 1) */
  count?: number
  /** pezzi a parte, posati dopo la dose con la loro etichetta (copy.pins.aside), es. il mantenimento */
  aside?: number
  /** indirizzo di ogni modello, per esempio con la versione del file (glass.glb, scoop.glb...) */
  resolveModel?: ((file: string) => string) | null
  /** cartella dei modelli (default '/models/nutrexlab/') */
  modelsPath?: string
  /** cartella delle immagini statiche (default '/images/nutrexlab/') */
  postersPath?: string
  /** immagine statica del prodotto (senza WebGL e mentre la scena si carica); senza, quella del tipo */
  poster?: string | ((layout: Layout) => string) | null
  /** cartella del decoder Draco (default '/draco/') */
  dracoPath?: string
  theme?: ProductExperienceTheme
  copy?: ProductExperienceCopy
  etch?: EtchLogo | null
  etchOptions?: EtchOptions
  /** altezza dello schermo usata per lo scroll, in px (default window.innerHeight) */
  getVh?: () => number
  /** scrub di ScrollTrigger: true o secondi di inerzia (default true) */
  scrub?: boolean | number
  /** anticipo del caricamento della parte 3D (rootMargin, default '150%') */
  lazyMargin?: string
  /** momento tranquillo per la preparazione anticipata (preload); default: browser inattivo */
  calm?: () => Promise<unknown>
  quality?: Partial<ProductExperienceQuality>
}

/** Cambio prodotto: solo i campi passati cambiano. */
export interface ProductUpdate {
  type?: ProductType
  theme?: ProductExperienceTheme
  copy?: ProductExperienceCopy
  productName?: string
  productNote?: string
  model?: string | null
  poster?: string | ((layout: Layout) => string) | null
  shape?: ProductShape | null
  count?: number
  aside?: number
}

export declare class ProductExperience {
  constructor(section: HTMLElement, options?: ProductExperienceOptions)
  readonly section: HTMLElement
  readonly type: ProductType
  /** la scena 3D e' pronta */
  readonly ready: boolean
  /** avvia subito la parte 3D (di solito parte da sola quando la sezione si avvicina) */
  init3D(): Promise<void> | void
  /** prepara la parte 3D in anticipo, a piccoli passi e solo nei momenti tranquilli (options.calm) */
  preload(): Promise<void> | void
  /** testi, colori e dose nuovi; se cambia il tipo (o la forma) scarica solo il modello che serve */
  setProduct(update?: ProductUpdate): Promise<void>
  /** toglie scroll, scena e contenuto della sezione */
  destroy(): void
}

export declare const STEPS: string[]
export declare const DEFAULT_COPY: Record<ProductType, Required<ProductExperienceCopy>>

export declare function createProductExperience(section: HTMLElement, options?: ProductExperienceOptions): ProductExperience

/** Monta tutte le sezioni [data-product-experience] (data-type, data-model, data-product-name, data-steps). */
export declare function mountProductExperiences(root?: ParentNode, defaults?: ProductExperienceOptions): ProductExperience[]

/** Tema di un prodotto del sito NutrexLab (src/products.js). */
export interface SiteTheme {
  palette: { night: string; wine: string; plum: string; berryHi: string; [name: string]: string }
  rim: string
  swatch: string
  powder?: string[]
  dust?: string
}

/** { studio: 'scuro' }: lo studio del render di Blender con il bicchiere renderizzato. */
export declare function themeFromSite(theme: SiteTheme, options?: { studio?: 'dark' | 'scuro' }): ProductExperienceTheme
