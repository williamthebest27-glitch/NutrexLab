// Traduzioni delle indicazioni raggruppate della pagina Benefici: in ogni gruppo di un prodotto le indicazioni
// dello stesso ingrediente sono una frase sola (joinClaims di src/seo/benefici.js). Qui le stesse frasi nelle
// altre lingue, costruite con le stesse regole dai testi ufficiali gia' tradotti in
// src/i18n/locales/<lingua>/benefici.js. Da rilanciare quando cambiano le indicazioni di un prodotto: i test
// (tests/benefici.test.js) segnalano le frasi mancanti o vecchie.
// npm run traduzioni-benefici  ->  src/i18n/locales/<lingua>/benefici-gruppi.js
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FORMULAS, claimGroups, joinClaims } from '../src/seo/benefici.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = { en: 'English', fr: 'français', de: 'Deutsch', es: 'español' }

// frase italiana -> testi ufficiali italiani che la compongono (ogni frase una volta)
const joined = new Map()
for (const f of FORMULAS) {
  for (const g of claimGroups(f)) {
    for (const same of g.ingredients) {
      if (same.length < 2) continue
      const texts = same.map((c) => c.it)
      joined.set(joinClaims(texts), texts)
    }
  }
}

for (const [lang, name] of Object.entries(LANGS)) {
  const official = (await import(pathToFileURL(resolve(root, `src/i18n/locales/${lang}/benefici.js`)).href)).default
  const lines = [...joined].map(([it, texts]) => {
    const own = texts.map((t) => {
      if (!official[t]) throw new Error(`${lang}: manca la traduzione di "${t}" in src/i18n/locales/${lang}/benefici.js`)
      return official[t]
    })
    return `  ${JSON.stringify(it)}: ${JSON.stringify(joinClaims(own, lang))},`
  })
  const file = [
    `// Pagina Benefici, indicazioni raggruppate per ingrediente, traduzione: ${name}.`,
    '// File generato da `npm run traduzioni-benefici` (scripts/traduzioni-benefici.mjs) con i testi ufficiali di',
    `// src/i18n/locales/${lang}/benefici.js: non modificarlo a mano.`,
    'export default {',
    ...lines,
    '}',
    '',
  ]
  writeFileSync(resolve(root, `src/i18n/locales/${lang}/benefici-gruppi.js`), file.join('\n'))
}
console.log(`scritte src/i18n/locales/{${Object.keys(LANGS).join(',')}}/benefici-gruppi.js (${joined.size} frasi)`)
