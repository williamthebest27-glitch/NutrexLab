// Lingue del sito per Google e per i visitatori: indirizzi /de/..., pagine gia' tradotte con canonical,
// hreflang e dati strutturati della lingua, sitemap con tutte le lingue, lingua in base al paese
// (middleware.js). npm test
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installFakeWoo, WOO_URL } from './fake-woocommerce.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

process.env.WOOCOMMERCE_URL = WOO_URL
process.env.WOOCOMMERCE_CATEGORY = 'nutrex-lab'
const woo = installFakeWoo()
after(() => woo.restore())

const { withLang, splitLang, isPagePath, cookieLang } = await import('../src/i18n/langs.js')
const { visitorLang, browserLangs } = await import('../src/i18n/geo.js')
const { dictionary, translator, translateHtml } = await import('../src/i18n/static.js')
const { translatePage, finishItalian } = await import('../src/seo/translate.js')
const { headTags } = await import('../src/seo/head.js')
const { PAGES } = await import('../src/seo/pages.js')
const { default: middleware, config } = await import('../middleware.js')
const { renderProductPage } = await import('../server/product-page.js')
const { getProduct } = await import('../server/catalog.js')
const sitemapApi = await import('../api/sitemap.js')

const graphOf = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)[1])['@graph']
const node = (graph, type) => graph.find((n) => n['@type'] === type)
const hreflangs = (html) => Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map((m) => [m[1], m[2]]))

describe('indirizzi delle lingue', () => {
  test('prefisso della lingua: italiano senza, le altre con /en /fr /de /es', () => {
    assert.equal(withLang('/integratori', 'de'), '/de/integratori')
    assert.equal(withLang('/', 'fr'), '/fr')
    assert.equal(withLang('/?prodotto=vitamina-c', 'es'), '/es?prodotto=vitamina-c')
    assert.equal(withLang('/de/prodotto/magnesio#recensioni', 'en'), '/en/prodotto/magnesio#recensioni')
    assert.equal(withLang('/de/carrello', 'it'), '/carrello')
    assert.equal(withLang('/de', 'it'), '/')
    assert.deepEqual(splitLang('/de/integratori/collagene'), { lang: 'de', path: '/integratori/collagene' })
    assert.deepEqual(splitLang('/en'), { lang: 'en', path: '/' })
    assert.deepEqual(splitLang('/dentifricio'), { lang: null, path: '/dentifricio' })
  })

  test('solo le pagine hanno una versione per lingua (non file, api, area clienti)', () => {
    for (const p of ['/', '/integratori', '/prodotto/collagene', '/carrello?x=1', '/de/contatti']) assert.ok(isPagePath(p), p)
    for (const p of ['/assets/main.js', '/og.jpg', '/api/cart', '/account?ref=AB', '/images/prodotti/x.webp', 'https://x.it/', '//x.it/a']) {
      assert.ok(!isPagePath(p), p)
    }
  })

  test('cookie della lingua scelta', () => {
    assert.equal(cookieLang('a=1; nx_lang=de; b=2'), 'de')
    assert.equal(cookieLang('nx_lang=it'), 'it')
    assert.equal(cookieLang('nx_lang=xx'), null)
    assert.equal(cookieLang(''), null)
  })
})

describe('lingua in base al paese', () => {
  const v = (country, acceptLanguage = '') => visitorLang({ country, acceptLanguage })

  test('il paese decide: Germania tedesco, Francia francese, Spagna spagnolo, Italia italiano', () => {
    assert.equal(v('DE', 'de-DE,de;q=0.9'), 'de')
    assert.equal(v('DE', 'en-US,en;q=0.9'), 'de', 'dalla Germania in tedesco anche con il browser in inglese')
    assert.equal(v('DE', 'it-IT'), 'de')
    assert.equal(v('AT'), 'de')
    assert.equal(v('FR'), 'fr')
    assert.equal(v('MC'), 'fr')
    assert.equal(v('ES'), 'es')
    assert.equal(v('MX'), 'es')
    assert.equal(v('AR'), 'es')
    assert.equal(v('IT', 'de-DE'), 'it')
    assert.equal(v('SM'), 'it')
    assert.equal(v('GB'), 'en')
    assert.equal(v('US'), 'en')
  })

  test('paesi con piu\' lingue: quella del browser se e\' del paese', () => {
    assert.equal(v('CH', 'fr-CH,fr;q=0.9'), 'fr')
    assert.equal(v('CH', 'it-CH'), 'it')
    assert.equal(v('CH', 'en-US,en;q=0.9'), 'de')
    assert.equal(v('BE', 'fr-BE'), 'fr')
    assert.equal(v('BE', 'nl-BE,nl;q=0.9,en;q=0.8'), 'en', 'fiammingo: inglese, non francese')
    assert.equal(v('CA', 'fr-CA'), 'fr')
    assert.equal(v('US', 'es-US,es;q=0.9'), 'es')
  })

  test('paesi con una lingua che il sito non ha: la lingua del browser, altrimenti l\'inglese', () => {
    assert.equal(v('NL', 'nl-NL,nl;q=0.9,en;q=0.8'), 'en')
    assert.equal(v('NL', 'nl,de;q=0.8'), 'de')
    assert.equal(v('PL', ''), 'en')
    assert.equal(v('JP', 'ja,it;q=0.5'), 'it')
  })

  test('paese sconosciuto: nessuna scelta', () => {
    assert.equal(v(''), null)
    assert.equal(v(undefined), null)
    assert.equal(v('XX1'), null)
  })

  test('Accept-Language: ordine per q, solo le lingue del sito', () => {
    assert.deepEqual(browserLangs('en-US,en;q=0.9,de;q=0.95,fr;q=0'), ['en', 'de'])
    assert.deepEqual(browserLangs('pt-BR, es;q=0.4, it;q=0.6'), ['it', 'es'])
    assert.deepEqual(browserLangs(''), [])
  })
})

describe('middleware: lingua di chi apre il sito', () => {
  const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
  const call = (path, headers = {}, method = 'GET') =>
    middleware(new Request(`https://www.nutrexlab.it${path}`, { method, headers: { 'user-agent': BROWSER, accept: 'text/html,*/*;q=0.8', ...headers } }))
  const location = (res) => res.headers.get('location')
  const passes = (res) => assert.equal(res.headers.get('x-middleware-next'), '1')

  test('dalla Germania in tedesco, dalla Francia in francese (stessa pagina, stessi parametri)', async () => {
    let res = await call('/', { 'x-vercel-ip-country': 'DE' })
    assert.equal(res.status, 302)
    assert.equal(location(res), 'https://www.nutrexlab.it/de')
    res = await call('/integratori/collagene?filtro=polvere', { 'x-vercel-ip-country': 'FR' })
    assert.equal(location(res), 'https://www.nutrexlab.it/fr/integratori/collagene?filtro=polvere')
    res = await call('/prodotto/magnesio', { 'x-vercel-ip-country': 'ES' })
    assert.equal(location(res), 'https://www.nutrexlab.it/es/prodotto/magnesio')
    assert.match(res.headers.get('cache-control'), /no-store/)
  })

  test('dall\'Italia e da paese sconosciuto: la pagina italiana', async () => {
    passes(await call('/', { 'x-vercel-ip-country': 'IT' }))
    passes(await call('/integratori'))
  })

  test('la lingua scelta dal selettore vince sul paese (anche l\'italiano)', async () => {
    passes(await call('/', { 'x-vercel-ip-country': 'DE', cookie: 'nx_lang=it' }))
    const res = await call('/contatti', { 'x-vercel-ip-country': 'IT', cookie: 'nx_cart=x; nx_lang=fr' })
    assert.equal(location(res), 'https://www.nutrexlab.it/fr/contatti')
  })

  test('motori di ricerca e anteprime dei link: sempre la pagina dell\'indirizzo', async () => {
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'facebookexternalhit/1.1',
      'WhatsApp/2.23',
      '',
    ]) {
      passes(await call('/', { 'x-vercel-ip-country': 'US', 'user-agent': ua }))
    }
  })

  test('?lang= dei link: la pagina di quella lingua, e la scelta resta nel cookie', async () => {
    let res = await call('/ordine?numero=123&lang=de')
    assert.equal(location(res), 'https://www.nutrexlab.it/de/ordine?numero=123')
    assert.match(res.headers.get('set-cookie'), /^nx_lang=de; Path=\/; Max-Age=31536000; SameSite=Lax; Secure$/)
    res = await call('/carrello?lang=it', { 'x-vercel-ip-country': 'DE' })
    assert.equal(location(res), 'https://www.nutrexlab.it/carrello')
    assert.match(res.headers.get('set-cookie'), /^nx_lang=it;/)
    res = await call('/carrello?lang=xx')
    assert.equal(location(res), 'https://www.nutrexlab.it/carrello')
    assert.equal(res.headers.get('set-cookie'), null)
  })

  test('niente da fare per richieste non di pagine e per gli indirizzi con la lingua', async () => {
    passes(await call('/', { 'x-vercel-ip-country': 'DE' }, 'POST'))
    passes(await call('/', { 'x-vercel-ip-country': 'DE', accept: 'application/json' }))
    passes(await call('/de/integratori', { 'x-vercel-ip-country': 'FR' }))
  })

  test('gira su tutte le pagine del sito (le stesse della build)', () => {
    const vite = readFileSync(join(ROOT, 'vite.config.js'), 'utf8')
    const pages = [...vite.matchAll(/resolve\('([a-z0-9/-]+)\.html'\)/g)].map((m) => m[1]).filter((f) => !['404', 'prodotto'].includes(f))
    assert.ok(pages.length > 10)
    const re = config.matcher.map((m) => new RegExp(`^${m.replace(/\/:path\*$/, '(?:/.*)?')}$`))
    for (const f of [...pages.map((p) => (p === 'index' ? '/' : `/${p}`)), '/prodotto/collagene']) assert.ok(re.some((r) => r.test(f)), f)
  })
})

describe('pagine tradotte per Google', () => {
  let tr
  before(async () => {
    tr = translator(await dictionary('de'))
  })

  test('testi, attributi, titolo, link e lingua del documento; il numero della voce resta sul testo', () => {
    const html = `<html lang="it"><head><title>Contatti | Nutrex Lab</title><meta name="description" content="Recapiti e modulo di contatto di Nutrex Lab." /></head><body>
      <a class="nav__logo" href="/" aria-label="Nutrex Lab, homepage" data-i18n-attr="aria-label">x</a>
      <p data-i18n>Domande frequenti</p><a href="/integratori/collagene?x=1#a">y</a><a href="/account?ref=AB">z</a>
      <img src="/og.jpg" alt="Collagene marino Nutrex Lab, barattolo da 500 g" data-i18n-attr="alt" /><a href="/og.jpg">f</a>
      <span data-i18n>Questo testo non esiste</span><svg><title>Mastercard</title></svg>
      <script>if (a<b) document.title = '<p data-i18n>Domande frequenti</p>'</script></body></html>`
    const out = translateHtml(html, tr)
    assert.match(out, /<html lang="de" data-src-lang="de">/)
    assert.match(out, /<title data-i18n="\d+">Kontakt \| Nutrex Lab<\/title>/)
    assert.match(out, /<meta name="description" content="Kontaktdaten und Kontaktformular von Nutrex Lab\." data-i18n="\d+" \/>/)
    assert.match(out, /<p data-i18n="\d+">Häufige Fragen<\/p>/)
    assert.match(out, /href="\/de" aria-label="Nutrex Lab, Startseite"/)
    assert.match(out, /data-i18n-at="aria-label:\d+"/)
    assert.match(out, /href="\/de\/integratori\/collagene\?x=1#a"/)
    assert.match(out, /href="\/account\?ref=AB&lang=de"/)
    assert.match(out, /href="\/og\.jpg"/)
    assert.match(out, /<span data-i18n>Questo testo non esiste<\/span>/, 'senza traduzione resta in italiano')
    assert.match(out, /<svg><title>Mastercard<\/title><\/svg>/, 'il titolo delle icone non e\' quello della pagina')
    assert.match(out, /document\.title = '<p data-i18n>Domande frequenti<\/p>'/, 'gli script restano come sono')
  })

  test('il numero sul testo tradotto porta al testo italiano nel dizionario', async () => {
    const out = translateHtml('<p data-i18n>Domande frequenti</p>', tr)
    const n = Number(/<p data-i18n="(\d+)">/.exec(out)[1])
    assert.equal((await dictionary('de')).entries[n][0], 'Domande frequenti')
  })

  test('pagina statica in tedesco: <head> della lingua (canonical, hreflang, Open Graph, dati strutturati)', async () => {
    const page = `<html lang="it"><head><!--nx:seo:chi-siamo-->${headTags(PAGES['chi-siamo'])}<!--/nx:seo--></head><body><nav class="crumbs" aria-label="Percorso" data-i18n-attr="aria-label"><ol><li><a href="/" data-i18n>Home</a></li><li aria-current="page" data-i18n>Chi siamo</li></ol></nav></body></html>`
    const { html, missing } = await translatePage(page, 'de')
    assert.deepEqual(missing, [])
    assert.doesNotMatch(html, /nx:seo/)
    assert.equal(html.match(/<title/g).length, 1)
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.nutrexlab\.it\/de\/chi-siamo" \/>/)
    assert.deepEqual(hreflangs(html), {
      it: 'https://www.nutrexlab.it/chi-siamo',
      en: 'https://www.nutrexlab.it/en/chi-siamo',
      fr: 'https://www.nutrexlab.it/fr/chi-siamo',
      de: 'https://www.nutrexlab.it/de/chi-siamo',
      es: 'https://www.nutrexlab.it/es/chi-siamo',
      'x-default': 'https://www.nutrexlab.it/en/chi-siamo',
    })
    assert.match(html, /<meta property="og:locale" content="de_DE" \/>/)
    assert.match(html, /<meta property="og:url" content="https:\/\/www\.nutrexlab\.it\/de\/chi-siamo" \/>/)
    const graph = graphOf(html)
    const about = node(graph, 'AboutPage')
    assert.equal(about.url, 'https://www.nutrexlab.it/de/chi-siamo')
    assert.equal(about.inLanguage, 'de-DE')
    assert.equal(about.isPartOf['@id'], 'https://www.nutrexlab.it/#sito', 'il sito e\' lo stesso in tutte le lingue')
    assert.notEqual(about.name, PAGES['chi-siamo'].jsonld['@graph'][0].name)
    const crumbs = node(graph, 'BreadcrumbList').itemListElement
    assert.deepEqual(crumbs.map((c) => c.item), ['https://www.nutrexlab.it/de', 'https://www.nutrexlab.it/de/chi-siamo'])
    assert.match(html, /<a href="\/de" data-i18n="\d+">Startseite<\/a>/)
  })

  test('pagina italiana: canonical italiano e le versioni nelle altre lingue', () => {
    const html = finishItalian(`<!--nx:seo:integratori-->${headTags(PAGES.integratori)}<!--/nx:seo-->`)
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.nutrexlab\.it\/integratori" \/>/)
    assert.equal(Object.keys(hreflangs(html)).length, 6)
    assert.match(html, /<meta property="og:locale" content="it_IT" \/>/)
    assert.match(html, /<meta property="og:locale:alternate" content="de_DE" \/>/)
    assert.doesNotMatch(html, /nx:seo/)
  })

  test('pagine noindex: niente hreflang', () => {
    assert.doesNotMatch(headTags(PAGES[404]), /hreflang/)
  })
})

describe('pagina prodotto nelle altre lingue', () => {
  const template = '<html lang="de" data-src-lang="de"><head><title data-i18n="1">Produkt | Nutrex Lab</title></head><body><!-- ssr:prodotto --></body></html>'

  test('titolo, descrizione, canonical, hreflang e dati strutturati in tedesco', async () => {
    const product = await getProduct('collagene')
    const html = await renderProductPage(template, { product, slug: 'collagene', lang: 'de' })
    const de = await dictionary('de')
    const tde = translator(de).t
    assert.equal(html.match(/<title/g).length, 1, 'un solo titolo')
    assert.ok(html.includes(`>${tde('Collagene Marino in Polvere 10.000 mg | Nutrex Lab')}</title>`))
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.nutrexlab\.it\/de\/prodotto\/collagene" \/>/)
    assert.equal(hreflangs(html).fr, 'https://www.nutrexlab.it/fr/prodotto/collagene')
    assert.equal(hreflangs(html)['x-default'], 'https://www.nutrexlab.it/en/prodotto/collagene')
    const graph = graphOf(html)
    const p = node(graph, 'Product')
    assert.equal(p.url, 'https://www.nutrexlab.it/de/prodotto/collagene')
    assert.equal(p.offers.offers[0].url, 'https://www.nutrexlab.it/de/prodotto/collagene')
    assert.equal(p.offers.lowPrice, '44.90', 'prezzi per Google sempre con il punto')
    assert.match(p.category, /^Nahrungsergänzungsmittel > /)
    assert.equal(node(graph, 'ItemPage').inLanguage, 'de-DE')
    assert.deepEqual(
      node(graph, 'BreadcrumbList').itemListElement.map((i) => i.item),
      ['https://www.nutrexlab.it/de', 'https://www.nutrexlab.it/de/integratori', 'https://www.nutrexlab.it/de/integratori/collagene', 'https://www.nutrexlab.it/de/prodotto/collagene'],
    )
    assert.equal(node(graph, 'BreadcrumbList').itemListElement[0].name, tde('Home'))
    // contenuto per chi legge senza JavaScript: testi e link in tedesco
    assert.match(html, /<h2 data-i18n="\d+">Beschreibung<\/h2>/)
    assert.match(html, /href="\/de\/prodotto\/collagene-marino-compresse"/)
    assert.match(html, /href="\/de\/integratori\/collagene"/)
    assert.match(html, /<p>44,90\s€<\/p>/, 'prezzo nel formato tedesco')
  })

  test('voto medio nel formato della lingua', async () => {
    const product = await getProduct('magnesio')
    const html = await renderProductPage(template, { product, slug: 'magnesio', lang: 'en' })
    assert.match(html, /<p>Average rating 4\.5 out of 5 \(2 reviews\)<\/p>/)
  })

  test('prodotto non trovato: titolo nella lingua, noindex', async () => {
    const html = await renderProductPage(template, { product: null, slug: 'niente', status: 404, lang: 'fr' })
    assert.match(html, /<meta name="robots" content="noindex" \/>/)
    assert.doesNotMatch(html, /hreflang|rel="canonical"/)
  })
})

describe('sitemap multilingua', () => {
  test('ogni pagina in tutte le lingue, con le versioni alternative (hreflang) e x-default', async () => {
    const xml = await (await sitemapApi.GET(new Request('https://www.nutrexlab.it/sitemap.xml'))).text()
    assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/)
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1])
    const locs = urls.map((u) => /<loc>([^<]+)<\/loc>/.exec(u)[1])
    for (const path of ['/', '/integratori', '/chi-siamo', '/prodotto/magnesio']) {
      for (const l of ['it', 'en', 'fr', 'de', 'es']) assert.ok(locs.includes(`https://www.nutrexlab.it${withLang(path, l)}`), `${l} ${path}`)
    }
    assert.ok(locs.includes('https://www.nutrexlab.it/de') && locs.includes('https://www.nutrexlab.it/'))
    const de = urls.find((u) => u.includes('<loc>https://www.nutrexlab.it/de/integratori</loc>'))
    const links = Object.fromEntries([...de.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]))
    assert.deepEqual(links, {
      it: 'https://www.nutrexlab.it/integratori',
      en: 'https://www.nutrexlab.it/en/integratori',
      fr: 'https://www.nutrexlab.it/fr/integratori',
      de: 'https://www.nutrexlab.it/de/integratori',
      es: 'https://www.nutrexlab.it/es/integratori',
      'x-default': 'https://www.nutrexlab.it/en/integratori',
    })
    assert.equal(new Set(locs).size, locs.length, 'nessun indirizzo doppio')
  })
})
