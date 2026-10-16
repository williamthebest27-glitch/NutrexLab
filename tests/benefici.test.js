// Pagina Benefici (src/seo/benefici.js, src/seo/benefici-page.js): un prodotto alla volta, come la homepage.
// Nella vista di ogni prodotto solo le sue indicazioni consentite: autorizzate dal Reg. UE 432/2012 (nutriente
// almeno al 15% del VNR nella dose giornaliera, condizioni d'uso rispettate) o, per gli estratti vegetali,
// effetti delle linee guida del Ministero della Salute; raggruppate per area e, in ogni area, una frase per
// ingrediente con le parole dei testi ufficiali (anche nelle altre lingue); almeno tre benefici per prodotto,
// mai quelle respinte o da verificare. "Come funziona" coerente con le indicazioni pubblicate; foto, barattoli
// 3D, prezzo e link presenti.
// npm test
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const {
  AREAS,
  BOTANICALS,
  CLAIMS,
  FORMULAS,
  IMAGES,
  NUTRIENTS,
  SIGNIFICANT,
  SOURCES,
  areasOf,
  benefitsCount,
  claimGroups,
  formulaBySlug,
  joinClaims,
  nrvPercent,
  publishable,
  publishedClaims,
} = await import('../src/seo/benefici.js')
const { beneficiMain } = await import('../src/seo/benefici-page.js')
const { PRODUCTS: CATALOG, productPath } = await import('../src/seo/catalog.js')
const { PRODUCTS: LINE } = await import('../src/products.js')
const { PAGES } = await import('../src/seo/pages.js')
// testi ufficiali tradotti e frasi raggruppate per ingrediente (npm run traduzioni-benefici)
const LANGS = ['en', 'fr', 'de', 'es']
const official = {}
const joined = {}
for (const l of LANGS) {
  official[l] = (await import(`../src/i18n/locales/${l}/benefici.js`)).default
  joined[l] = (await import(`../src/i18n/locales/${l}/benefici-gruppi.js`)).default
}
/** Frase di un ingrediente sulla pagina: tutte le sue indicazioni del gruppo. */
const sentence = (same) => joinClaims(same.map((c) => c.it))

const html = beneficiMain()
const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
/** Testo visibile di un pezzo di HTML: senza tag, con gli spazi uniformi. */
const textOf = (h) => decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')
const pageText = textOf(html)

/** HTML della vista di un prodotto (benefici e formula). */
function viewOf(slug) {
  const at = html.indexOf(`<article class="bx-view" data-view="${slug}"`)
  assert.ok(at >= 0, `vista di ${slug}`)
  return html.slice(at, html.indexOf('</article>', at))
}
/** HTML della parte della hero di un prodotto. */
function heroOf(slug) {
  const at = html.indexOf(`<div class="bx-hp" data-view="${slug}"`)
  assert.ok(at >= 0, `hero di ${slug}`)
  return html.slice(at, html.indexOf('</h2>', at) + 2000)
}
/** Gruppi di una vista: [chiave dell'area, 'altre' o 'forza', HTML]. */
function groupsOf(slug) {
  return [...viewOf(slug).matchAll(/<section class="bx-group[^"]*" id="benefici-[^"]+?-([a-z]+)"[^>]*>([\s\S]*?)<\/section>/g)].map((m) => [m[1], m[2]])
}

// come un testo italiano nomina un nutriente (anche negli elenchi: "vitamine B6, B12 e C")
const MENTION = {
  vitC: /[Vv]itamina C\b|[Vv]itamine [^.;:]*\bC\b/,
  vitE: /[Vv]itamina E\b|[Vv]itamine [^.;:]*\bE\b/,
  vitD: /[Vv]itamina D3?\b|[Vv]itamine [^.;:]*\bD3?\b/,
  vitK: /[Vv]itamina K2?\b|[Vv]itamine [^.;:]*\bK2?\b/,
  b1: /[Tt]iamina|\bB1\b/,
  b2: /[Rr]iboflavina|\bB2\b/,
  b6: /\bB6\b/,
  b12: /\bB12\b/,
  zinc: /[Zz]inco/,
  biotin: /[Bb]iotina/,
  copper: /\b[Rr]ame\b/,
  selenium: /[Ss]elenio/,
  mg: /[Mm]agnesio/,
}
const mentioned = (s) => Object.keys(MENTION).filter((n) => MENTION[n].test(s))

describe('matrice delle indicazioni sulla salute', () => {
  test('ogni nutriente ha il suo VNR e si riconosce nei testi', () => {
    assert.deepEqual(Object.keys(MENTION).sort(), Object.keys(NUTRIENTS).sort())
    for (const n of Object.values(NUTRIENTS)) assert.ok(n.nrv > 0, n.name)
  })

  test('indicazioni: nutrienti e aree esistenti, testo del registro, stati validi', () => {
    for (const [key, c] of Object.entries(CLAIMS)) {
      assert.ok(!c.area || AREAS.some((a) => a.key === c.area), key)
      assert.doesNotMatch(c.it, /\.$/, `${key}: senza punto finale (lo aggiunge la pagina)`)
      if (c.b) {
        // estratto vegetale: un effetto delle linee guida ministeriali per quella pianta, con il suo nome
        assert.ok(!c.n && BOTANICALS[c.b], key)
        assert.ok(BOTANICALS[c.b].lgm.includes(c.lgm), `${key}: ${c.lgm} non e' nelle linee guida`)
        assert.ok(c.it.toLowerCase().includes(BOTANICALS[c.b].name.toLowerCase()), key)
      } else {
        assert.ok(NUTRIENTS[c.n], key)
        assert.match(c.it, /^(La|Lo|Il) .+ (contribuisce|accresce|interviene) /, key)
      }
    }
    for (const f of FORMULAS) {
      for (const [key, status] of f.claims) {
        assert.ok(CLAIMS[key], `${f.slug}: ${key}`)
        assert.ok(['verified', 'needs_review', 'not_applicable'].includes(status), `${f.slug}: ${key} ${status}`)
      }
    }
  })

  test('quantita\' delle formule uguali alla tabella dell\'etichetta (% VNR)', () => {
    const ROW = {
      vitC: /^Vitamina C/,
      vitE: /^Vitamina E/,
      vitD: /^Vitamina D/,
      vitK: /^Vitamina K/,
      b1: /tiamina/i,
      b2: /^Riboflavina/,
      b6: /^Vitamina B6/,
      b12: /^Vitamina B12/,
      zinc: /^Zinco/,
      biotin: /^Biotina/,
      copper: /^Rame/,
      selenium: /^Selenio/,
      mg: /^Magnesio/,
    }
    for (const f of FORMULAS) {
      for (const n of Object.keys(f.amounts)) {
        const row = f.ingredients.find(([name]) => ROW[n].test(name))
        assert.ok(row, `${f.slug}: riga di ${n}`)
        assert.equal(row[2], nrvPercent(f, n), `${f.slug}: ${n}`)
      }
    }
  })

  test('pubblicabile solo se verificata, in quantita\' significativa e con le condizioni rispettate', () => {
    const vitC = formulaBySlug('vitamina-c')
    assert.equal(publishable(vitC, ['vitC.immunitario', 'verified']), true)
    assert.equal(publishable(vitC, ['vitC.immunitario', 'needs_review']), false)
    assert.equal(publishable(vitC, ['vitC.immunitario', 'not_applicable']), false)
    assert.equal(publishable(vitC, ['vitC.inventata', 'verified']), false)
    // 15% del VNR: 12 mg di vitamina C su 80 si', 11,9 mg no
    assert.equal(publishable({ amounts: { vitC: 12 } }, ['vitC.immunitario', 'verified']), true)
    assert.equal(publishable({ amounts: { vitC: 11.9 } }, ['vitC.immunitario', 'verified']), false)
    // magnesio del coenzima Q10: 30 mg, l'8% del VNR
    assert.equal(publishable(formulaBySlug('coenzima-q10'), ['mg.stanchezza', 'verified']), false)
    // vitamina C durante e dopo lo sforzo fisico: almeno 200 mg al giorno
    assert.equal(publishable(formulaBySlug('d-mannosio'), ['vitC.immunitario-sforzo', 'verified']), false)
    assert.equal(publishable(vitC, ['vitC.immunitario-sforzo', 'verified']), true)
  })

  test('ogni indicazione verificata e\' pubblicabile (nessuna scartata in silenzio)', () => {
    for (const f of FORMULAS) {
      for (const c of f.claims) if (c[1] === 'verified') assert.ok(publishable(f, c), `${f.slug}: ${c[0]}`)
      for (const c of publishedClaims(f)) {
        if (c.b) assert.ok(f.botanicals?.[c.b], `${f.slug}: ${c.key}`)
        else assert.ok(f.amounts[c.n] >= NUTRIENTS[c.n].nrv * SIGNIFICANT, `${f.slug}: ${c.key}`)
      }
    }
  })

  test("almeno tre benefici per prodotto (indicazioni consentite o punti di forza dell'etichetta)", () => {
    for (const f of FORMULAS) {
      assert.ok(benefitsCount(f) >= 3, `${f.slug}: ${benefitsCount(f)}`)
      if (!publishedClaims(f).length) assert.ok((f.features?.length ?? 0) >= 3, `${f.slug}: punti di forza`)
    }
  })

  test('estratti vegetali solo se presenti nella formula', () => {
    const vitC = formulaBySlug('vitamina-c')
    assert.equal(publishable(vitC, ['ashwagandha.adattogeno', 'verified']), false)
    assert.equal(publishable(formulaBySlug('ashwagandha'), ['ashwagandha.adattogeno', 'verified']), true)
    assert.equal(publishable(formulaBySlug('ashwagandha'), ['ashwagandha.adattogeno', 'needs_review']), false)
  })

  test('benefici non consentiti: ogni prodotto ha la sua lista, con il motivo', () => {
    for (const f of FORMULAS) {
      assert.ok(Array.isArray(f.blocked) && f.blocked.length > 0, f.slug)
      for (const [label, why] of f.blocked) assert.ok(label && why, `${f.slug}: ${label}`)
    }
  })
})

describe('una frase per ingrediente', () => {
  test('le parti comuni si scrivono una volta, nessuna parola dei testi ufficiali cambia', () => {
    const it = (...keys) => keys.map((k) => CLAIMS[k].it)
    assert.equal(joinClaims(it('zinc.pelle', 'zinc.capelli', 'zinc.unghie')), 'Lo zinco contribuisce al mantenimento di una pelle normale, capelli normali e unghie normali')
    assert.equal(joinClaims(it('mg.ossa', 'mg.denti')), 'Il magnesio contribuisce al mantenimento di ossa e denti normali')
    assert.equal(
      joinClaims(it('b12.globuli-rossi', 'b12.omocisteina', 'b12.divisione')),
      'La vitamina B12 contribuisce alla normale formazione dei globuli rossi e al normale metabolismo dell’omocisteina e interviene nel processo di divisione delle cellule',
    )
    assert.equal(joinClaims(it('vitC.immunitario')), CLAIMS['vitC.immunitario'].it)
    // tedesco: il verbo separabile in fondo resta in comune
    const de = (...keys) => keys.map((k) => official.de[CLAIMS[k].it])
    assert.equal(joinClaims(de('zinc.pelle', 'zinc.capelli', 'zinc.unghie'), 'de'), 'Zink trägt zur Erhaltung normaler Haut, Haare und Nägel bei')
    // un testo contenuto in un altro: in comune solo il nutriente e il verbo
    assert.equal(
      joinClaims(de('vitC.immunitario', 'vitC.immunitario-sforzo'), 'de'),
      'Vitamin C trägt zu einer normalen Funktion des Immunsystems und zu einer normalen Funktion des Immunsystems während und nach intensiver körperlicher Betätigung bei',
    )
  })

  test('ogni gruppo: ogni ingrediente una volta, tutte le indicazioni pubblicabili', () => {
    for (const f of FORMULAS) {
      const groups = claimGroups(f)
      assert.deepEqual(
        groups.map((g) => g.area),
        [...areasOf(f), ...(publishedClaims(f).some((c) => !c.area) ? [null] : [])],
        f.slug,
      )
      assert.deepEqual(groups.flatMap((g) => g.ingredients.flat().map((c) => c.key)).sort(), publishedClaims(f).map((c) => c.key).sort(), f.slug)
      for (const g of groups) {
        const keys = g.ingredients.map((same) => same[0].n ?? same[0].b)
        assert.equal(new Set(keys).size, keys.length, `${f.slug}: ${g.area}`)
        for (const same of g.ingredients) for (const c of same) assert.equal(c.n ?? c.b, same[0].n ?? same[0].b, `${f.slug}: ${c.key}`)
      }
    }
  })

  test('traduzioni delle frasi: stesse regole sui testi ufficiali di ogni lingua, nessuna frase vecchia', () => {
    const wanted = new Set()
    for (const f of FORMULAS) {
      for (const g of claimGroups(f)) {
        for (const same of g.ingredients) {
          if (same.length < 2) continue
          const it = sentence(same)
          wanted.add(it)
          for (const l of LANGS) {
            const own = same.map((c) => official[l][c.it])
            assert.ok(own.every(Boolean), `${l}: testi ufficiali di ${it}`)
            assert.equal(joined[l][it], joinClaims(own, l), `${l}: ${it} (npm run traduzioni-benefici)`)
          }
        }
      }
    }
    for (const l of LANGS) assert.deepEqual(Object.keys(joined[l]).sort(), [...wanted].sort(), `${l} (npm run traduzioni-benefici)`)
  })
})

describe('pagina Benefici: un prodotto alla volta', () => {
  test('stessi prodotti e stesso ordine del catalogo e del menu PRODOTTI della homepage', () => {
    const slugs = FORMULAS.map((f) => f.slug)
    assert.deepEqual(
      slugs,
      CATALOG.map((p) => p.slug),
    )
    assert.deepEqual(
      slugs,
      LINE.map((p) => p.id),
    )
  })

  test('per ogni prodotto: parte della hero, foto e vista; all\'apertura si vede solo il primo', () => {
    const parts = [...html.matchAll(/<(\w+) class="([^"]+)" data-view="([^"]+)"([^>]*)>/g)].map(([, tag, cls, slug, rest]) => ({ tag, cls, slug, hidden: /\shidden\b/.test(rest) }))
    for (const [i, f] of FORMULAS.entries()) {
      const mine = parts.filter((p) => p.slug === f.slug)
      assert.deepEqual(
        mine.map((p) => p.cls.split(' ')[0]).sort(),
        ['bx-hero__photo', 'bx-hp', 'bx-view'],
        f.slug,
      )
      for (const p of mine) assert.equal(p.hidden, i > 0, `${f.slug}: ${p.cls}`)
    }
    assert.equal(parts.length, FORMULAS.length * 3)
  })

  test('ogni vista mostra solo e tutte le indicazioni pubblicabili del suo prodotto, con le condizioni', () => {
    for (const f of FORMULAS) {
      const text = textOf(viewOf(f.slug))
      const shown = new Set(publishedClaims(f).map((c) => c.key))
      for (const g of claimGroups(f)) for (const same of g.ingredients) assert.ok(text.includes(sentence(same)), `${f.slug}: ${same.map((c) => c.key)}`)
      for (const [key, c] of Object.entries(CLAIMS)) {
        if (!shown.has(key)) assert.ok(!text.includes(c.it), `${f.slug}: ${key}`)
        else if (c.condition) assert.ok(text.includes(c.condition.text), `${f.slug}: condizione di ${key}`)
      }
    }
  })

  test('indicazioni raggruppate per area, un ingrediente una volta per gruppo, nessun gruppo vuoto', () => {
    for (const f of FORMULAS) {
      const claims = publishedClaims(f)
      const groups = groupsOf(f.slug).filter(([k]) => k !== 'forza')
      const expected = claimGroups(f)
      assert.deepEqual(
        groups.map(([k]) => k),
        expected.map((g) => g.area ?? 'altre'),
        f.slug,
      )
      for (const [i, [key, body]] of groups.entries()) {
        const { ingredients } = expected[i]
        assert.ok(ingredients.length > 0, `${f.slug}: ${key}`)
        assert.equal((body.match(/class="bx-claim[ "]/g) ?? []).length, ingredients.length, `${f.slug}: ${key}`)
        for (const same of ingredients) assert.ok(textOf(body).includes(sentence(same)), `${f.slug}: ${key} ${same.map((c) => c.key)}`)
      }
      if (!claims.length) assert.ok(viewOf(f.slug).includes('bx-benefits--features'), f.slug)
      for (const x of f.features ?? []) assert.ok(textOf(viewOf(f.slug)).includes(x), `${f.slug}: ${x}`)
    }
  })

  test('nessun testo da verificare, nessun effetto non autorizzato', () => {
    for (const f of FORMULAS) {
      for (const [label, note] of f.blocked) {
        assert.ok(!pageText.includes(label), `${f.slug}: ${label}`)
        assert.ok(!pageText.includes(note), `${f.slug}: ${note}`)
      }
    }
    // indicazioni respinte nel registro UE (cranberry, vite rossa, bromelina...), indicazioni generiche
    // dell'etichetta e termini non consentiti
    const banned = /microcircol|gambe pesant|pesantezza|cellulit|articolazion|probiotic|antiossidant|anti-?age|antiet[aà]|detox|dimagr|brucia ?grassi|ringiovan|miracol|digestion|guarisc/i
    assert.equal(pageText.match(banned)?.[0] ?? null, null)
    // il cranberry non e' mai associato alle vie urinarie
    assert.doesNotMatch(pageText, /cranberry[^.]*vie urinarie|vie urinarie[^.]*cranberry/i)
  })

  test('"Come funziona": solo nutrienti con indicazioni pubblicate nella formula', () => {
    for (const f of FORMULAS) {
      if (!f.how) continue
      const allowed = new Set(publishedClaims(f).map((c) => c.n))
      for (const n of mentioned(f.how)) assert.ok(allowed.has(n), `${f.slug}: ${n}`)
    }
  })

  test('link: alla scheda del prodotto e ai suoi benefici', () => {
    for (const f of FORMULAS) {
      assert.ok(viewOf(f.slug).includes(`href="${productPath(f.slug)}"`), `${f.slug}: vista`)
      const hero = heroOf(f.slug)
      assert.ok(hero.includes(`href="${productPath(f.slug)}"`), `${f.slug}: hero`)
      assert.ok(hero.includes(`href="#benefici-${f.slug}"`), `${f.slug}: esplora i benefici`)
      assert.ok(hero.includes('data-price'), `${f.slug}: prezzo`)
    }
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))
    for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(id), `#${id}`)
  })

  test('foto, barattoli 3D e immagini di riserva', () => {
    for (const name of [...AREAS.map((a) => a.image), ...FORMULAS.map((f) => f.image)]) {
      assert.ok(IMAGES[name], `testo alternativo di ${name}`)
      for (const suffix of ['', '-m']) assert.ok(existsSync(join(ROOT, `public/images/benefici/${name}${suffix}.webp`)), `${name}${suffix}.webp`)
    }
    for (const f of FORMULAS) {
      assert.ok(existsSync(join(ROOT, `public/images/prodotti/${f.slug}.webp`)), `immagine di riserva di ${f.slug}`)
      assert.ok(existsSync(join(ROOT, `public/models/${f.slug}.glb`)), `barattolo 3D di ${f.slug}`)
      assert.equal((viewOf(f.slug).match(/data-jar-slot=/g) ?? []).length, 2, `${f.slug}: spazi del barattolo`)
    }
    assert.equal((html.match(/bx-slot--hero/g) ?? []).length, 1)
    for (const [img] of html.matchAll(/<img\b[^>]*>/g)) assert.match(img, /\salt="/, img.slice(0, 90))
  })

  test('titoli: un solo h1, livelli senza salti', () => {
    const shell = readFileSync(join(ROOT, 'benefici.html'), 'utf8')
    const levels = [...(shell + html).matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]))
    assert.equal(levels.filter((l) => l === 1).length, 1)
    assert.equal(levels[0], 1)
    for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} poi h${levels[i]}`)
  })

  test('fonti ufficiali, titolo e descrizione, menu prodotti', () => {
    for (const s of Object.values(SOURCES)) assert.match(s.url, /^https:\/\/((eur-lex|ec)\.europa\.eu|www\.salute\.gov\.it)\//, s.name)
    for (const [a] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(a, /rel="noopener/)
    const p = PAGES.benefici
    assert.equal(p.path, '/benefici')
    assert.ok(p.title.length <= 60, p.title)
    assert.ok(p.description.length >= 70 && p.description.length <= 160, p.description)
    assert.match(readFileSync(join(ROOT, 'benefici.html'), 'utf8'), /<nav class="pmenu"[^>]*data-pmenu>/)
  })
})
