// Matrice scientifica della pagina Benefici, per la redazione e il consulente regolatorio, dai dati di
// src/seo/benefici.js (gli stessi della pagina e di tests/benefici.test.js): per ogni prodotto nutrienti e
// quantita' per dose giornaliera, indicazioni con il loro stato, punti di forza.
// npm run matrice-benefici  ->  docs/matrice-benefici.md
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AREAS, BOTANICALS, CLAIMS, FORMULAS, NUTRIENTS, SIGNIFICANT, SOURCES, areasOf, benefitsCount, claimGroups, joinClaims, nrvPercent } from '../src/seo/benefici.js'
import { PRODUCTS } from '../src/seo/catalog.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const num = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 })
const cell = (s) => String(s).replace(/\|/g, '\\|')
const areaName = (key) => AREAS.find((a) => a.key === key)?.name ?? 'Altre indicazioni'
const productName = (slug) => PRODUCTS.find((p) => p.slug === slug)?.name ?? slug

/** Perche' un'indicazione non va sulla pagina (vuoto se si pubblica). */
function reason(f, [key, status]) {
  const c = CLAIMS[key]
  if (!c) return 'indicazione sconosciuta'
  if (status !== 'verified') return status
  if (c.b) return f.botanicals?.[c.b] ? '' : 'estratto non presente nella formula'
  const amount = f.amounts?.[c.n] ?? 0
  if (amount < NUTRIENTS[c.n].nrv * SIGNIFICANT) return 'sotto il 15% del VNR'
  if (c.condition?.min && amount < c.condition.min) return `servono almeno ${num(c.condition.min)} ${NUTRIENTS[c.n].unit} al giorno`
  return ''
}

const sources = Object.values(SOURCES).map((s) => `- [${s.name}](${s.url}): ${s.note}`)

// ---------------------------------------------------------------------------
// Matrice scientifica
const m = [
  '# Matrice scientifica della pagina Benefici',
  '',
  'File generato da `npm run matrice-benefici` con i dati di `src/seo/benefici.js`: non modificarlo a mano.',
  'Per ogni prodotto: nutrienti e quantità per dose giornaliera, indicazioni sulla salute con il loro stato, punti di forza.',
  '',
  '## Regole',
  '',
  '- **Vitamine e minerali** (`verified`): testo autorizzato dal Reg. (UE) 432/2012 (stessa formulazione del registro UE). Va sulla pagina solo se il nutriente è almeno al 15% del VNR nella dose giornaliera (Reg. UE 1169/2011, allegato XIII) e se le condizioni d’uso specifiche sono rispettate.',
  '- **Estratti vegetali** (`verified`, segnalati sulla pagina come «estratto vegetale»): indicazioni «in attesa» (on hold) a livello UE, usate con gli effetti fisiologici delle linee guida del Ministero della Salute, solo per piante senza indicazioni respinte nel registro UE.',
  '- **needs_review**: da verificare prima di pubblicarla. Non va mai sulla pagina.',
  '- **Punti di forza**: caratteristiche dell’etichetta (attività enzimatica, formato, durata, certificazioni), nessun effetto sulla salute.',
  '',
  'Fonti:',
  '',
  ...sources,
  '',
  '## Riepilogo',
  '',
  '| Prodotto | Aree della pagina | Benefici sulla pagina | Benefici non consentiti |',
  '|---|---|---:|---:|',
  ...FORMULAS.map((f) => `| ${cell(productName(f.slug))} | ${areasOf(f).map(areaName).join(', ') || '–'} | ${benefitsCount(f)} | ${f.blocked.length} |`),
  '',
]

FORMULAS.forEach((f, i) => {
  m.push(`## ${i + 1}. ${productName(f.slug)} (\`${f.slug}\`)`, '')
  m.push(`- Fonte: ${f.source}`, `- Dose giornaliera: ${f.dose}`, `- Aree della pagina: ${areasOf(f).map(areaName).join(', ') || 'nessuna'}`, '')

  const nutrients = Object.keys(f.amounts)
  if (nutrients.length) {
    m.push('**Nutrienti con indicazioni autorizzate (per dose giornaliera)**', '')
    m.push('| Nutriente | Quantità | VNR | % VNR | Quantità significativa (≥ 15%) |', '|---|---:|---:|---:|:---:|')
    for (const n of nutrients) {
      const { name, nrv, unit } = NUTRIENTS[n]
      m.push(`| ${name} | ${num(f.amounts[n])} ${unit} | ${num(nrv)} ${unit} | ${num(nrvPercent(f, n))}% | ${f.amounts[n] >= nrv * SIGNIFICANT ? 'sì' : 'no'} |`)
    }
    m.push('')
  }
  for (const [b, amount] of Object.entries(f.botanicals ?? {})) {
    const p = BOTANICALS[b]
    m.push(`**Estratto vegetale**: ${p.name} (${p.latin}, ${p.part}), ${amount} per dose. Effetti delle linee guida ministeriali: ${p.lgm}`, '')
  }

  if (f.claims.length) {
    m.push('**Indicazioni sulla salute**', '')
    m.push('| Stato | Indicazione | Fonte | Area | Condizioni d’uso | Sulla pagina |', '|---|---|---|---|---|---|')
    for (const c of f.claims) {
      const claim = CLAIMS[c[0]]
      const why = reason(f, c)
      const from = claim?.b ? `linee guida ministeriali (${claim.lgm})` : 'Reg. (UE) 432/2012'
      m.push(`| ${c[1]} | ${cell(claim?.it ?? c[0])} | ${cell(from)} | ${areaName(claim?.area)} | ${cell(claim?.condition?.text ?? '–')} | ${why ? `no (${why})` : 'sì'} |`)
    }
    m.push('')
    // le frasi come le legge il cliente: in ogni area un ingrediente una volta, con le parole dei testi ufficiali
    m.push('**Testo sulla pagina** (un ingrediente per area, le parti comuni dei testi ufficiali scritte una volta)', '')
    for (const g of claimGroups(f)) {
      for (const same of g.ingredients) m.push(`- ${areaName(g.area)}: ${cell(joinClaims(same.map((c) => c.it)))}.`)
    }
    m.push('')
  }
  if (f.features?.length) {
    m.push('**Punti di forza (dall’etichetta)**', '', ...f.features.map((x) => `- ${x}`), '')
  }
  if (f.warnings) m.push(`**Avvertenze dell’etichetta**: ${f.warnings}`, '')
})

mkdirSync(resolve(root, 'docs'), { recursive: true })
writeFileSync(resolve(root, 'docs/matrice-benefici.md'), m.join('\n'))
console.log(`scritta docs/matrice-benefici.md (${FORMULAS.length} prodotti)`)
