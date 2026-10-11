import { LANGS, FALLBACK_LANG } from './langs.js'

/*
  Lingua per chi apre il sito senza averla mai scelta (middleware.js): quella del paese da cui arriva
  (x-vercel-ip-country di Vercel), con la lingua del browser (Accept-Language) solo per scegliere tra le
  lingue di un paese che ne ha piu' d'una (Svizzera, Belgio, Lussemburgo, Canada...) e per i paesi con
  una lingua che il sito non ha (Paesi Bassi, Polonia...: la prima lingua del browser che il sito ha,
  altrimenti l'inglese).
    Italia, San Marino, Vaticano -> italiano        Germania, Austria, Liechtenstein -> tedesco
    Francia, Monaco, Francofonia -> francese         Spagna, America Latina -> spagnolo
    Regno Unito, Irlanda, USA, resto del mondo -> inglese
  Paese sconosciuto: null (resta la pagina dell'indirizzo).
*/

/** Lingua principale del paese (solo le lingue del sito). */
const PRIMARY = {
  it: ['IT', 'SM', 'VA'],
  de: ['DE', 'AT', 'LI', 'CH'],
  fr: [
    'FR', 'MC', 'LU', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF', 'NC', 'PF', 'WF',
    'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GN', 'CM', 'GA', 'CG', 'CD', 'CF', 'TD', 'MG', 'DJ', 'KM', 'BI', 'HT',
  ],
  es: [
    'ES', 'AD', 'MX', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'CU', 'DO', 'PR', 'CO', 'VE', 'EC', 'PE', 'BO', 'CL',
    'AR', 'PY', 'UY', 'GQ',
  ],
  en: ['GB', 'IE', 'US', 'CA', 'AU', 'NZ', 'MT', 'IM', 'JE', 'GG', 'GI', 'ZA'],
}

/** Altre lingue del sito parlate nel paese: le sceglie la lingua del browser. */
const SPOKEN = {
  CH: ['fr', 'it'],
  BE: ['fr', 'de'], // niente lingua principale: il fiammingo non c'e', decide il browser (o l'inglese)
  LU: ['de'],
  CA: ['fr'],
  US: ['es'],
  AD: ['fr'],
  MT: ['it'],
  MA: ['fr'],
  DZ: ['fr'],
  TN: ['fr'],
  LB: ['fr'],
}

const BY_COUNTRY = new Map()
for (const [lang, countries] of Object.entries(PRIMARY)) for (const c of countries) BY_COUNTRY.set(c, lang)

/** Lingue del sito nell'intestazione Accept-Language, in ordine di preferenza ("de-AT,de;q=0.9,en;q=0.8" -> de, en). */
export function browserLangs(header) {
  const items = String(header ?? '')
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)).find(Boolean)
      return { lang: tag.trim().toLowerCase().split('-')[0], q: q ? Number(q[1]) : 1, i }
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  return [...new Set(items.map((x) => x.lang).filter((l) => LANGS.includes(l)))]
}

/** Lingua per il visitatore: country = codice ISO del paese (DE, FR...), acceptLanguage = intestazione del browser. */
export function visitorLang({ country, acceptLanguage } = {}) {
  const c = String(country ?? '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return null
  const primary = BY_COUNTRY.get(c) ?? null
  const spoken = [primary, ...(SPOKEN[c] ?? [])].filter(Boolean)
  const browser = browserLangs(acceptLanguage)
  // paese con piu' lingue: quella del browser, se e' una di quelle del paese
  const local = browser.find((l) => spoken.includes(l))
  if (local) return local
  if (primary) return primary
  // paese con una lingua che il sito non ha: la prima lingua del browser che il sito ha
  return browser[0] ?? FALLBACK_LANG
}
