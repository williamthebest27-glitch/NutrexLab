/*
  Lingue del sito. L'italiano e' la lingua di partenza: e' quella scritta nell'HTML e nei file del sito
  (e quella che leggono i motori di ricerca). Le altre lingue si applicano nel browser, senza ricaricare
  la pagina (src/i18n/index.js), e la scelta resta per le visite successive (memoria del browser).
  Nessun riconoscimento automatico della lingua del browser: si parte sempre in italiano, a meno che il
  visitatore abbia scelto un'altra lingua o arrivi da un link con ?lang=de (en, fr, de, es).
  Solo dati: lo usa anche lo script nell'<head> (src/partials/head.html) che nasconde la pagina finche'
  la lingua scelta non e' pronta.
*/

export const LANGS = ['it', 'en', 'fr', 'de', 'es']
export const DEFAULT_LANG = 'it'
export const STORAGE_KEY = 'nx_lang'

export const LANG_INFO = {
  it: { name: 'Italiano', short: 'IT', locale: 'it-IT' },
  en: { name: 'English', short: 'EN', locale: 'en-GB' },
  fr: { name: 'Français', short: 'FR', locale: 'fr-FR' },
  de: { name: 'Deutsch', short: 'DE', locale: 'de-DE' },
  es: { name: 'Español', short: 'ES', locale: 'es-ES' },
}

export const isLang = (l) => LANGS.includes(l)

/** Lingua da usare all'apertura: ?lang= nell'indirizzo, poi quella scelta in passato, poi l'italiano. */
export function initialLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (isLang(q)) return q
  } catch {
    // indirizzo non leggibile: si va avanti
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // memoria non disponibile (navigazione privata): italiano
  }
  return DEFAULT_LANG
}

export function saveLang(l) {
  try {
    if (l === DEFAULT_LANG) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, l)
  } catch {
    // niente memoria: la lingua vale solo per questa pagina
  }
}
