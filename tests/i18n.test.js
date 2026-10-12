// Traduzioni del sito (src/i18n): ogni testo italiano da tradurre ha la sua traduzione in tutte le lingue,
// con gli stessi segnaposto {x} e gli stessi tag HTML. Testi controllati: HTML delle pagine e delle parti
// comuni (data-i18n, data-i18n-attr), pagine del catalogo generate in build, t()/tp() del JavaScript e
// dati del sito (content.js, catalog.js, products.js, testi della sezione del bicchiere, titoli di pages.js).
// I testi di WooCommerce no: si cambiano nel pannello (finche' manca la traduzione si vedono in italiano).
// npm test
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['en', 'fr', 'de', 'es']
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href)

// chiave di un testo: la stessa della build e del server (src/i18n/static.js), come norm() del browser
const { norm, i18nElements } = await imp('src/i18n/static.js')

// testi che non si traducono: marchio, numeri e unita', sigle, indirizzi email
const SKIP = /^(Nutrex Lab|[\d\s.,%/+-]+\s*(mg|g|µg|kg|ml|UI|GDU|GDU\/g)?|[A-Z0-9-]{2,12}|\S+@\S+|mg|g|µg|kg|ml)$/
const letters = /[A-Za-zÀ-ÿ]/
const needs = (s) => letters.test(s) && !SKIP.test(norm(s))

// ---------------------------------------------------------------------------
// dizionari
const dicts = {}
for (const l of LANGS) {
  const parts = (await imp(`src/i18n/locales/${l}.js`)).default
  const entries = []
  for (const part of Object.values(parts)) entries.push(...Object.entries(part))
  dicts[l] = { entries, map: new Map(entries.map(([it, tr]) => [norm(it), tr])) }
}

// ---------------------------------------------------------------------------
// testi italiani del sito
const attr = (attrs, name) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(attrs)?.[1] ?? null

/**
 * Testi da tradurre in un HTML: contenuto degli elementi con data-i18n (e data-i18n-text) e attributi di
 * data-i18n-attr. Gli stessi che traduce la build per le pagine /de/... (translateHtml di src/i18n/static.js).
 */
function fromHtml(html, where) {
  const out = []
  for (const el of i18nElements(html)) {
    for (const name of el.names) {
      const v = attr(el.attrs, name)
      if (v) out.push([v, `${where}: ${name} di <${el.tag}>`])
    }
    if (el.inner) out.push([el.inner.text, `${where}: <${el.tag}>`])
  }
  return out
}

const files = (dir, ext) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? (['node_modules', 'locales', 'public', 'dist'].includes(d.name) ? [] : files(join(dir, d.name), ext)) : d.name.endsWith(ext) ? [join(dir, d.name)] : [],
  )

const texts = []
for (const f of [...readdirSync(ROOT).filter((f) => f.endsWith('.html')), ...files('integratori', '.html'), ...files('src/partials', '.html')]) {
  const html = readFileSync(join(ROOT, f), 'utf8')
  texts.push(...fromHtml(html, f))
  // titolo e descrizione scritti nell'HTML (le altre pagine li hanno da src/seo/pages.js): li traduce setMeta
  const title = /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]
  const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1]
  if (title) texts.push([title, `${f}: <title>`])
  if (description) texts.push([description, `${f}: descrizione`])
}

// pagine e parti generate in build (vite.config.js, src/seo/build.js)
const build = await imp('src/seo/build.js')
const catalog = await imp('src/seo/catalog.js')
texts.push(...fromHtml(build.staticGrid('tutti'), 'griglia:tutti'), ...fromHtml(build.shopFaq(), 'faq:integratori'))
texts.push(...fromHtml(build.shopCategories(), 'categorie:tutti'), ...fromHtml(build.lineSection(), 'seo:linea'))
for (const c of catalog.CATEGORIES) texts.push(...fromHtml(build.catalogMain(c.slug), `catalogo:${c.slug}`))

// JavaScript: t('...') e tp(n, '...', '...') (src/i18n/index.js ha solo esempi nei commenti), anche nella
// pagina prodotto preparata sul server (server/)
const STR = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`
const unq = (a, b) => (a ?? b).replace(/\\(['"])/g, '$1')
for (const f of [...files('src', '.js'), ...files('server', '.js')]) {
  if (f.replace(/\\/g, '/').endsWith('src/i18n/index.js')) continue
  const src = readFileSync(join(ROOT, f), 'utf8')
  for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*` + STR, 'g'))) texts.push([unq(m[1], m[2]), `${f}: t()`])
  // HTML scritto dal JavaScript con il testo italiano e data-i18n (lo traduce translateDom)
  for (const m of src.matchAll(/data-i18n>([^<$`{}]+)<\//g)) texts.push([m[1], `${f}: data-i18n`])
  for (const m of src.matchAll(new RegExp(String.raw`\btp\([^,()]+(?:\([^()]*\))?,\s*` + STR + String.raw`\s*,\s*` + STR, 'g'))) {
    texts.push([unq(m[1], m[2]), `${f}: tp()`], [unq(m[3], m[4]), `${f}: tp()`])
  }
}

// dati del sito tradotti con localize() / t()
const KEYS_SKIP = new Set(['id', 'slug', 'woo', 'category', 'quality', 'icon', 'model', 'form', 'shape', 'swatch', 'src', 'srcset', 'thumbnail', 'href', 'url', 'path', 'sku', 'type', 'code'])
function walk(value, where, key = '') {
  if (typeof value === 'string') {
    if (!KEYS_SKIP.has(key) && !/^(#|rgba?\(|\/|https?:)/.test(value)) texts.push([value, where])
  } else if (Array.isArray(value)) value.forEach((v) => walk(v, where, key))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, where, k)
}
const { COPY } = await imp('src/content.js')
walk(COPY, 'src/content.js')
const { PRODUCTS: LINE } = await imp('src/products.js')
for (const p of LINE) texts.push([p.name, 'src/products.js'], [p.note, 'src/products.js'])
for (const list of [catalog.PRODUCTS, catalog.CATEGORIES, Object.values(catalog.QUALITY), [catalog.SHOP]]) walk(list, 'src/seo/catalog.js')
const pe = await imp('src/components/ProductExperience/copy.js')
walk([pe.DEFAULT_COPY, pe.STEPS, pe.SHOWCASE_STEPS], 'ProductExperience/copy.js')
const { PAGES } = await imp('src/seo/pages.js')
for (const [k, p] of Object.entries(PAGES)) texts.push([p.title, `src/seo/pages.js ${k}`], [p.description, `src/seo/pages.js ${k}`])
// SEO nelle altre lingue (src/seo/localize.js): anteprime social e testi dei dati strutturati
const JSONLD_TEXT = new Set(['name', 'description', 'text', 'caption', 'value'])
function jsonldTexts(v, where, key = '') {
  if (typeof v === 'string') {
    if (key === 'category') v.split(' > ').forEach((part) => texts.push([part, where]))
    else if (JSONLD_TEXT.has(key)) texts.push([v, where])
  } else if (Array.isArray(v)) v.forEach((x) => jsonldTexts(x, where, key))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) jsonldTexts(x, where, k)
}
for (const [k, p] of Object.entries(PAGES)) {
  if (p.socialTitle) texts.push([p.socialTitle, `src/seo/pages.js ${k}: socialTitle`])
  jsonldTexts(p.jsonld, `src/seo/pages.js ${k}: dati strutturati`)
}
texts.push([catalog.SOCIAL_IMAGE.alt, 'src/seo/catalog.js: SOCIAL_IMAGE'])

const wanted = new Map()
for (const [it, where] of texts) if (it && needs(it) && !wanted.has(norm(it))) wanted.set(norm(it), where)

// ---------------------------------------------------------------------------
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const tags = (s) =>
  [...norm(s).matchAll(/<\s*(\/?)\s*([a-zA-Z][\w-]*)([^>]*)>/g)]
    .map((m) => `${m[1]}${m[2].toLowerCase()}${attr(m[3], 'href') ? ` href=${attr(m[3], 'href')}` : ''}`)
    .sort()

describe('traduzioni', () => {
  test(`ci sono testi da controllare (${wanted.size})`, () => assert.ok(wanted.size > 500))

  for (const l of LANGS) {
    test(`${l}: ogni testo del sito ha la traduzione`, () => {
      const missing = [...wanted].filter(([k]) => !dicts[l].map.has(k)).map(([k, where]) => `${where}: ${k.slice(0, 90)}`)
      assert.deepEqual(missing, [])
    })

    test(`${l}: stessi segnaposto {x} e stessi tag HTML dell'italiano`, () => {
      const bad = []
      for (const [it, tr] of dicts[l].entries) {
        if (typeof tr !== 'string' || !tr.trim()) bad.push(`vuota: ${it.slice(0, 80)}`)
        else if (placeholders(it).join() !== placeholders(tr).join()) bad.push(`segnaposto: ${it.slice(0, 80)}`)
        else if (tags(it).join() !== tags(tr).join()) bad.push(`tag: ${it.slice(0, 80)}`)
      }
      assert.deepEqual(bad, [])
    })
  }

  test('tutte le lingue traducono gli stessi testi', () => {
    const keys = (l) => [...dicts[l].map.keys()].sort()
    for (const l of LANGS.slice(1)) {
      const a = new Set(keys(LANGS[0]))
      const b = new Set(keys(l))
      assert.deepEqual(
        [[...a].filter((k) => !b.has(k)).map((k) => `solo ${LANGS[0]}: ${k.slice(0, 80)}`), [...b].filter((k) => !a.has(k)).map((k) => `solo ${l}: ${k.slice(0, 80)}`)],
        [[], []],
      )
    }
  })
})


// ---------------------------------------------------------------------------
// plugin WordPress (pagamento e area clienti su WooCommerce): i testi di nutrex_headless_t() e
// nutrex_headless_tp() nei file PHP, tradotti in wordpress/nutrex-headless/lang/<lingua>.json
const PLUGIN = join(ROOT, 'wordpress/nutrex-headless')
const phpFiles = (dir) =>
  readdirSync(join(PLUGIN, dir))
    .filter((f) => f.endsWith('.php'))
    .map((f) => join(dir, f))
const PHP_STR = `'((?:[^'\\\\]|\\\\.)*)'`
const phpText = (s) => s.replace(/\\(['\\])/g, '$1')
const pluginTexts = new Map()
for (const file of [...phpFiles('includes'), ...phpFiles('templates'), 'nutrex-headless.php']) {
  const src = readFileSync(join(PLUGIN, file), 'utf8')
  for (const m of src.matchAll(new RegExp(`nutrex_headless_t\\(\\s*${PHP_STR}`, 'g'))) pluginTexts.set(phpText(m[1]), file)
  for (const m of src.matchAll(new RegExp(`nutrex_headless_tp\\([^,]+,\\s*${PHP_STR}\\s*,\\s*${PHP_STR}`, 'g'))) {
    pluginTexts.set(phpText(m[1]), file)
    pluginTexts.set(phpText(m[2]), file)
  }
}
const pluginDicts = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(join(PLUGIN, `lang/${l}.json`), 'utf8'))]))

describe('traduzioni del plugin WordPress (pagamento e area clienti)', () => {
  test(`ci sono testi da controllare (${pluginTexts.size})`, () => assert.ok(pluginTexts.size > 60))

  for (const l of LANGS) {
    test(`${l}: ogni testo ha la traduzione, con gli stessi segnaposto {x} e tag HTML`, () => {
      const dict = pluginDicts[l]
      const bad = []
      for (const [it, file] of pluginTexts) {
        const tr = dict[it]
        if (typeof tr !== 'string' || !tr.trim()) bad.push(`manca (${file}): ${it.slice(0, 80)}`)
        else if (placeholders(it).join() !== placeholders(tr).join()) bad.push(`segnaposto: ${it.slice(0, 80)}`)
        else if (tags(it).join() !== tags(tr).join()) bad.push(`tag: ${it.slice(0, 80)}`)
      }
      assert.deepEqual(bad, [])
    })

    test(`${l}: nessuna traduzione di un testo che non c'e' piu'`, () => {
      assert.deepEqual(Object.keys(pluginDicts[l]).filter((it) => !pluginTexts.has(it)), [])
    })
  }
})
