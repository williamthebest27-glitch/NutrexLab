/*
  Testi di default della sezione (italiano, come il resto del sito). Ogni prodotto puo' sostituirli
  passando `copy` (vedi index.js): i dati (dosi, numero di capsule...) vanno presi dall'etichetta,
  niente indicazioni sulla salute che non siano autorizzate.
*/

/** Sequenza narrativa della polvere: PRODOTTO -> PRECISIONE -> PREPARAZIONE -> ATTIVAZIONE -> RISULTATO. */
export const STEPS = ['Prodotto', 'Precisione', 'Preparazione', 'Attivazione', 'Risultato']

/** Capsule e compresse (il prodotto gira attorno al bicchiere, poi la macro). */
export const SHOWCASE_STEPS = ['Prodotto', 'Forma', 'Dettaglio', 'Precisione', 'Risultato']

export const stepsFor = (type) => (type === 'powder' ? STEPS : SHOWCASE_STEPS)

/** Titolo finale, con il bicchiere: lo stesso per tutti i prodotti. */
const ROUTINE = ['La tua', 'routine', 'quotidiana.']

export const DEFAULT_COPY = {
  powder: {
    eyebrow: '', // nessuna frase sopra il titolo
    titleA: ['Precisione', 'in ogni', 'misurino.'],
    titleB: ROUTINE,
    pins: {
      dose: ['10 g', 'Un misurino raso'],
      water: ['1 bicchiere', "D'acqua, una volta al giorno"],
    },
  },
  capsule: {
    eyebrow: '', // nessuna frase sopra il titolo
    titleA: ['Scienza.', 'Semplificata.'],
    titleB: ROUTINE,
    pins: {
      dose: ['Capsula vegetale', 'In due parti'],
      water: ['1 bicchiere', "D'acqua"],
    },
  },
  tablet: {
    eyebrow: '', // nessuna frase sopra il titolo
    titleA: ['Scienza.', 'Semplificata.'],
    titleB: ROUTINE,
    pins: {
      dose: ['1 compressa', 'Ogni giorno'],
      water: ['1 bicchiere', "D'acqua"],
    },
  },
}

/** Unisce i testi del prodotto a quelli di default del tipo. */
export function resolveCopy(type, copy = {}) {
  const base = DEFAULT_COPY[type] ?? DEFAULT_COPY.powder
  return {
    ...base,
    ...copy,
    pins: { ...base.pins, ...(copy.pins ?? {}) },
  }
}
