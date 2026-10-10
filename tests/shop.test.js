// Prove del codice del server del negozio, con un WooCommerce finto (tests/fake-woocommerce.js).
// npm test
import { test, describe, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { installFakeWoo, WOO_URL } from './fake-woocommerce.js'

process.env.WOOCOMMERCE_URL = WOO_URL
process.env.WOOCOMMERCE_CATEGORY = 'nutrex-lab'
process.env.SITE_URL = 'https://negozio.test'

const { decode, safeHtml, listProducts, listCategories, getProduct, relatedProducts, listReviews } = await import('../server/catalog.js')
const { cleanMessage } = await import('../server/contact.js')
const { cleanReview } = await import('../server/reviews.js')
const { cartAction, getCart } = await import('../server/cart.js')
const { checkoutUrl } = await import('../server/checkout.js')
const { publicError } = await import('../server/errors.js')
const { renderProductPage } = await import('../server/product-page.js')
const { sessionCookies, readSession } = await import('../server/session.js')
const productsApi = await import('../api/products.js')
const cartApi = await import('../api/cart.js')
const checkoutApi = await import('../api/checkout.js')
const accountApi = await import('../api/account.js')
const contactApi = await import('../api/contatto.js')
const reviewsApi = await import('../api/recensioni.js')
const sitemapApi = await import('../api/sitemap.js')
const { categoryFor, isSitePhoto, productTrail } = await import('../src/seo/catalog.js')

let woo
before(() => {
  woo = installFakeWoo()
  // gli errori previsti finiscono nei log delle funzioni: qui non servono
  mock.method(console, 'warn', () => {})
  mock.method(console, 'error', () => {})
})
after(() => woo.restore())

/** Esegue fn con alcune variabili d'ambiente cambiate. */
async function withEnv(vars, fn) {
  const old = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]))
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  try {
    return await fn()
  } finally {
    for (const [k, v] of Object.entries(old)) v === undefined ? delete process.env[k] : (process.env[k] = v)
  }
}

const rejectsWith = (promise, status, code) =>
  assert.rejects(promise, (err) => {
    const { status: s, body } = publicError(err)
    assert.equal(s, status)
    if (code) assert.equal(body.error.code, code)
    return true
  })

describe('testi da WooCommerce', () => {
  test('entita\' HTML decodificate', () => {
    assert.equal(decode('Collagene &amp; vitamina C &#8211; 500 g &euro;'), 'Collagene & vitamina C – 500 g €')
  })

  test('descrizioni: niente script, iframe, eventi o link javascript:', () => {
    const html = safeHtml('<p onclick="x()">Ciao <strong>tu</strong> <a href="javascript:alert(1)">a</a> <a href="https://ok.it">b</a></p><script>alert(1)</script><iframe src="x"></iframe><img src=x onerror=alert(1)>')
    assert.equal(html, '<p>Ciao <strong>tu</strong> <a>a</a> <a href="https://ok.it" rel="noopener">b</a></p>')
  })
})

describe('catalogo: solo la categoria Nutrex', () => {
  test('elenco nell\'ordine del pannello, senza prodotti nascosti o di altri negozi', async () => {
    const list = await listProducts({ perPage: 48 })
    assert.deepEqual(list.products.map((p) => p.slug), ['collagene', 'magnesio'])
    const [coll, magn] = list.products
    assert.equal(coll.name, 'Collagene & vitamina C')
    assert.equal(coll.variationCount, 2)
    assert.equal(coll.description, undefined, 'nell\'elenco niente descrizione lunga')
    assert.deepEqual(magn.prices.price, 1690)
    assert.deepEqual(magn.prices.regular, 1990)
    assert.equal(magn.stock.low, 3)
    assert.equal(magn.stock.quantity, 3, 'pezzi in magazzino dal testo di WooCommerce')
    assert.equal(coll.stock.quantity, null, 'senza numero nel testo: null')
  })

  test('categorie per i filtri: le sottocategorie con prodotti (lette da piu\' pagine)', async () => {
    const cats = await listCategories()
    assert.deepEqual(cats.map((c) => c.slug), ['polvere', 'compresse'])
  })

  test('filtro per sottocategoria; una categoria di un altro negozio non mostra nulla', async () => {
    assert.deepEqual((await listProducts({ category: 'polvere' })).products.map((p) => p.slug), ['collagene'])
    assert.equal((await listProducts({ category: 'altro-negozio' })).products.length, 0)
  })

  test('prodotto variabile con le sue varianti (prezzo, SKU, disponibilita\')', async () => {
    const p = await getProduct('collagene')
    assert.equal(p.variations.length, 2)
    assert.deepEqual(p.variations.map((v) => [v.sku, v.attributes['Quantità'], v.prices.price, v.stock.inStock]), [
      ['COLL-1', '1 confezione', 4490, true],
      ['COLL-2', '2 confezioni', 8990, false],
    ])
    assert.doesNotMatch(p.description, /script|iframe|onclick|javascript:/)
  })

  test('un prodotto nascosto dal catalogo resta raggiungibile dal suo link', async () => {
    assert.equal((await getProduct('nascosto')).slug, 'nascosto')
  })

  test('prodotti di altri negozi e slug non validi: 404', async () => {
    await rejectsWith(getProduct('altro-prodotto'), 404, 'not_found')
    const before = woo.requests.length
    await rejectsWith(getProduct('../wp-admin'), 404, 'not_found')
    assert.equal(woo.requests.length, before, 'uno slug non valido non arriva a WooCommerce')
  })
})

describe('carrello e passaggio al checkout', () => {
  let token = null

  test('nuovo cliente: sessione WooCommerce, variante nel carrello', async () => {
    const res = await cartAction(null, 'add', { id: 101, quantity: 2 })
    token = res.token
    assert.ok(token)
    assert.equal(res.cart.count, 2)
    const [line] = res.cart.items
    assert.equal(line.slug, 'collagene')
    assert.equal(line.sku, 'COLL-1')
    assert.deepEqual(line.variation, [{ name: 'Quantità', value: '1 confezione' }])
    assert.equal(line.totals.total, 8980)
  })

  test('prodotti di un altro negozio non entrano nel carrello', async () => {
    await rejectsWith(cartAction(token, 'add', { id: 200, quantity: 1 }), 404, 'not_found')
    assert.equal((await getCart(token)).cart.count, 2)
  })

  test('quantita\' e azioni non valide', async () => {
    await rejectsWith(cartAction(token, 'add', { id: 110, quantity: 0 }), 400, 'invalid_item')
    await rejectsWith(cartAction(token, 'add', { id: 110, quantity: 100000 }), 400, 'invalid_item')
    await rejectsWith(cartAction(token, 'svuota-tutto', {}), 400, 'invalid_action')
  })

  test('esaurito: il messaggio di WooCommerce arriva al cliente', async () => {
    await assert.rejects(cartAction(token, 'add', { id: 102, quantity: 1 }), (err) => {
      const { status, body } = publicError(err)
      assert.equal(status, 400)
      assert.match(body.error.message, /esaurito/)
      assert.doesNotMatch(body.error.message, /&quot;/)
      return true
    })
  })

  test('coupon: valido applicato, sbagliato con il messaggio di WooCommerce', async () => {
    await cartAction(token, 'add', { id: 110, quantity: 1 })
    const { cart } = await cartAction(token, 'coupon', { code: 'PROVA10' })
    assert.deepEqual(cart.coupons.map((c) => c.code), ['prova10'])
    assert.equal(cart.totals.discount, Math.round((8980 + 1690) * 0.1))
    assert.equal(cart.totals.total, cart.totals.items - cart.totals.discount)
    await assert.rejects(cartAction(token, 'coupon', { code: 'SBAGLIATO' }), (err) => {
      const { status, body } = publicError(err)
      assert.equal(status, 400)
      assert.equal(body.error.message, 'Il codice promozionale "SBAGLIATO" non esiste!')
      return true
    })
  })

  test('indirizzo del checkout WooCommerce con gli stessi prodotti e coupon, senza prezzi', async () => {
    const { url } = await checkoutUrl(token)
    const u = new URL(url)
    assert.equal(u.origin, WOO_URL)
    assert.equal(u.searchParams.get('nutrex-checkout'), '1')
    assert.equal(u.searchParams.get('items'), '101:2,110:1')
    assert.equal(u.searchParams.get('coupons'), 'prova10')
    assert.equal(u.searchParams.get('nutrex_lang'), null)
    assert.doesNotMatch(url, /price|8980|1690/)
  })

  test('il checkout si apre nella lingua del sito (solo le lingue del sito)', async () => {
    const lang = async (l) => new URL((await checkoutUrl(token, { lang: l })).url).searchParams.get('nutrex_lang')
    assert.equal(await lang('de'), 'de')
    assert.equal(await lang('it'), 'it')
    assert.equal(await lang('xx'), null)
    assert.equal(await lang('<b>'), null)
  })

  test('quantita\' a zero toglie il prodotto; svuota', async () => {
    const { cart } = await cartAction(token, 'update', { key: 'k110', quantity: 0 })
    assert.deepEqual(cart.items.map((i) => i.id), [101])
    const cleared = await cartAction(token, 'clear')
    assert.equal(cleared.cart.count, 0)
    await rejectsWith(checkoutUrl(token), 409, 'empty_cart')
  })
})

describe('funzioni Vercel', () => {
  test('/api/products: in cache sul CDN', async () => {
    const res = await productsApi.GET(new Request('https://negozio.test/api/products?per_page=12'))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('cache-control'), /s-maxage=10/)
    const body = await res.json()
    assert.equal(body.products.length, 2)
    assert.equal(body.categories.length, 2)
  })

  test('/api/cart: cookie della sessione httpOnly e Secure, mai in cache', async () => {
    const add = await cartApi.POST(
      new Request('https://negozio.test/api/cart', { method: 'POST', headers: { 'x-forwarded-proto': 'https' }, body: JSON.stringify({ action: 'add', id: 110, quantity: 3 }) }),
    )
    assert.equal(add.status, 200)
    assert.equal(add.headers.get('cache-control'), 'private, no-store')
    const cookies = add.headers.getSetCookie()
    const session = cookies.find((c) => c.startsWith('nx_cart='))
    const count = cookies.find((c) => c.startsWith('nx_count='))
    assert.match(session, /HttpOnly/)
    assert.match(session, /Secure/)
    assert.match(session, /SameSite=Lax/)
    assert.match(count, /^nx_count=3;/)
    assert.doesNotMatch(count, /HttpOnly/)

    // la richiesta dopo usa il cookie
    const cookie = session.split(';')[0]
    const res = await checkoutApi.POST(new Request('https://negozio.test/api/checkout', { method: 'POST', headers: { cookie } }))
    assert.equal(res.status, 200)
    assert.equal(new URL((await res.json()).url).searchParams.get('items'), '110:3')

    // con la lingua del sito
    const fr = await checkoutApi.POST(new Request('https://negozio.test/api/checkout', { method: 'POST', headers: { cookie }, body: JSON.stringify({ lang: 'fr' }) }))
    assert.equal(new URL((await fr.json()).url).searchParams.get('nutrex_lang'), 'fr')
  })

  test('/account: all\'area clienti Nutrex con invito, vista, ritorno e lingua; mai in cache', async () => {
    const res = await accountApi.GET(new Request('https://negozio.test/account?ref=NX-7K92X&vista=registrati&torna=carrello&lang=es&altro=1'))
    assert.equal(res.status, 302)
    assert.equal(res.headers.get('cache-control'), 'private, no-store')
    const to = new URL(res.headers.get('location'))
    assert.equal(to.origin + to.pathname, `${WOO_URL}/account-nutrex-lab/`)
    assert.deepEqual(Object.fromEntries(to.searchParams), { ref: 'NX-7K92X', vista: 'registrati', torna: 'carrello', nutrex_lang: 'es' })
    const bad = await accountApi.GET(new Request('https://negozio.test/account?lang=xx'))
    assert.equal(new URL(bad.headers.get('location')).searchParams.get('nutrex_lang'), null)
  })

  test('senza categoria (o con una sbagliata) il negozio resta chiuso', async () => {
    for (const category of [undefined, 'sbagliata']) {
      const res = await withEnv({ WOOCOMMERCE_CATEGORY: category }, () => productsApi.GET(new Request('https://negozio.test/api/products')))
      assert.equal(res.status, 503)
      assert.equal((await res.json()).error.code, 'not_configured')
    }
  })

  test('WooCommerce irraggiungibile: messaggio per il cliente, nessun dettaglio interno', async () => {
    woo.down = true
    try {
      const res = await cartApi.GET(new Request('https://negozio.test/api/cart', { headers: { cookie: 'nx_cart=token-1' } }))
      assert.equal(res.status, 503)
      const text = await res.text()
      assert.match(text, /non risponde/)
      assert.doesNotMatch(text, /woo\.test|token-1|fetch failed/)
    } finally {
      woo.down = false
    }
  })
})

describe('pagina prodotto per Google e social', () => {
  const template = '<html><head><title>Prodotto | Nutrex Lab</title></head><body><!-- ssr:prodotto --></body></html>'
  const graphOf = (html) => JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)[1])['@graph']
  const node = (graph, type) => graph.find((n) => n['@type'] === type)

  test('titolo e descrizione curati, canonical sul dominio principale, dati strutturati con le varianti', async () => {
    const product = await getProduct('collagene')
    const html = renderProductPage(template, { product, slug: 'collagene' })
    assert.match(html, /<title>Collagene Marino in Polvere 10\.000 mg \| Nutrex Lab<\/title>/)
    assert.equal(html.match(/<title>/g).length, 1, 'un solo titolo')
    assert.match(html, /<link rel="canonical" href="https:\/\/www\.nutrexlab\.it\/prodotto\/collagene" \/>/)
    assert.match(html, /<meta property="og:url" content="https:\/\/www\.nutrexlab\.it\/prodotto\/collagene" \/>/)
    const graph = graphOf(html)
    const ld = node(graph, 'Product')
    assert.equal(ld.brand.name, 'Nutrex Lab')
    assert.equal(ld.offers['@type'], 'AggregateOffer')
    assert.equal(ld.offers.lowPrice, '44.90')
    assert.equal(ld.offers.highPrice, '89.90')
    assert.equal(ld.offers.availability, 'https://schema.org/InStock')
    assert.equal(ld.offers.offers[0].hasMerchantReturnPolicy.merchantReturnDays, 14)
    assert.equal(ld.offers.offers[0].seller.name, 'Nutrex Lab')
    assert.equal(ld.aggregateRating, undefined, 'nessun voto senza recensioni')
    // breadcrumb: Home / Integratori / Collagene / prodotto, lo stesso della barra visibile
    const crumbs = node(graph, 'BreadcrumbList').itemListElement.map((i) => i.name)
    assert.deepEqual(crumbs, ['Home', 'Integratori', 'Collagene', 'Collagene & vitamina C'])
    assert.match(html, /<nav class="crumbs[^"]*" aria-label="Percorso"[^>]*>/)
    // domande frequenti: le stesse nella pagina e nei dati strutturati
    const faq = node(graph, 'FAQPage').mainEntity
    assert.ok(faq.length >= 3)
    // (data-i18n: nelle altre lingue la pagina traduce questi testi nel browser)
    for (const q of faq) assert.ok(html.includes(`<span data-i18n>${q.name.replace(/'/g, '&#39;')}</span>`), q.name)
    // prodotti della stessa categoria e categoria, linkati anche senza JavaScript
    assert.match(html, /href="\/prodotto\/collagene-marino-compresse"/)
    assert.match(html, /href="\/integratori\/collagene"/)
  })

  test('voto medio solo con recensioni vere', async () => {
    const product = await getProduct('magnesio')
    const ld = node(graphOf(renderProductPage(template, { product, slug: 'magnesio' })), 'Product')
    assert.deepEqual(ld.aggregateRating, { '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: 2, bestRating: 5, worstRating: 1 })
  })

  test('prodotto senza dati SEO: titolo dal nome, descrizione dalla breve descrizione tagliata', async () => {
    const product = await getProduct('magnesio')
    const other = { ...product, slug: 'nuovo', summary: 'Parola '.repeat(60).trim() }
    const html = renderProductPage(template, { product: other, slug: 'nuovo' })
    assert.match(html, /<title>Magnesio \| Nutrex Lab<\/title>/)
    const description = /<meta name="description" content="([^"]*)"/.exec(html)[1]
    assert.ok(description.length <= 160 && description.endsWith('…'))
    assert.deepEqual(node(graphOf(html), 'BreadcrumbList').itemListElement.map((i) => i.name), ['Home', 'Integratori', 'Magnesio'])
    assert.equal(node(graphOf(html), 'FAQPage'), undefined)
  })

  test('testi con "</script>" o "$&" non rompono la pagina', async () => {
    const product = await getProduct('magnesio')
    const tricky = { ...product, slug: 'nuovo', name: 'Magnesio $& $\' </script><script>alert(1)</script>', summary: 'Prezzo $` speciale' }
    const html = renderProductPage(template, { product: tricky, slug: 'nuovo' })
    assert.equal(html.match(/<\/script>/g).length, 2, 'solo le chiusure dei due script del server')
    assert.equal(html.split('<html>').length, 2, 'il modello non viene duplicato')
    assert.match(html, /<title>Magnesio \$&amp; \$&#39; &lt;\/script&gt;/)
    const data = JSON.parse(/<script id="product-data" type="application\/json">(.*?)<\/script>/.exec(html)[1])
    assert.equal(data.product.name, tricky.name)
  })

  test('prodotto ancora senza prezzo: "Prezzo in arrivo", nessuna offerta per Google', async () => {
    const product = await getProduct('magnesio')
    const unpriced = { ...product, prices: { ...product.prices, price: 0, regular: 0, sale: 0 }, stock: { ...product.stock, purchasable: false } }
    const html = renderProductPage(template, { product: unpriced, slug: 'magnesio' })
    assert.equal(node(graphOf(html), 'Product').offers, undefined)
    assert.doesNotMatch(html, /product:price:amount|0,00/)
    assert.match(html, /<p>Prezzo in arrivo<\/p>/)
  })

  test('prodotto non trovato: noindex, nessun canonical', () => {
    const html = renderProductPage(template, { product: null, slug: 'niente', status: 404 })
    assert.match(html, /<meta name="robots" content="noindex" \/>/)
    assert.match(html, /<title>Prodotto non trovato \| Nutrex Lab<\/title>/)
    assert.doesNotMatch(html, /rel="canonical"/)
  })

  test('foto senza testo alternativo: descrizione dal nome del prodotto, mai il nome del file', async () => {
    const product = await getProduct('magnesio')
    assert.equal(product.images[0].alt, 'Magnesio Nutrex Lab, flacone da 180 compresse')
    const collagene = await getProduct('collagene')
    assert.equal(collagene.variations[0].images[0].alt, 'Collagene - 1 confezione Nutrex Lab')
  })
})

describe('sincronizzazione con WooCommerce', () => {
  test('prodotto nuovo: categoria del sito dalla sottocategoria di WooCommerce con lo stesso slug', () => {
    assert.equal(categoryFor('collagene')?.slug, 'collagene', 'i prodotti della linea hanno la loro categoria')
    assert.equal(categoryFor('collagene-nuovo', [{ id: 9, slug: 'nutrex-lab' }])?.slug, undefined)
    assert.equal(categoryFor('collagene-nuovo', [{ id: 9, slug: 'nutrex-lab' }, { id: 30, slug: 'collagene' }])?.slug, 'collagene')
    const trail = productTrail('omega-3', 'Omega 3', [{ id: 31, slug: 'estratti-vegetali' }]).map(([name]) => name)
    assert.deepEqual(trail, ['Home', 'Integratori', 'Estratti vegetali', 'Omega 3'])
  })

  test('foto delle schede: quella del sito finche\' WooCommerce ha la stessa, altrimenti quella nuova', () => {
    assert.ok(isSitePhoto('https://thedoubletwenty.it/wp-content/uploads/2026/10/collagene.webp', 'collagene'))
    assert.ok(isSitePhoto('https://thedoubletwenty.it/wp-content/uploads/2026/10/collagene-300x375.webp', 'collagene'))
    assert.ok(!isSitePhoto('https://thedoubletwenty.it/wp-content/uploads/2026/11/collagene-1.webp', 'collagene'), 'foto ricaricata')
    assert.ok(!isSitePhoto('https://thedoubletwenty.it/wp-content/uploads/2026/11/nuova-foto.jpg', 'collagene'))
    assert.ok(!isSitePhoto('https://thedoubletwenty.it/wp-content/uploads/2026/10/omega-3.webp', 'omega-3'), 'prodotto nuovo: sempre WooCommerce')
  })

  test('pagina di un prodotto nuovo in una sottocategoria del sito: breadcrumb con la categoria', async () => {
    const product = await getProduct('magnesio')
    const fresh = { ...product, slug: 'omega-3', name: 'Omega 3', categories: [{ id: 30, name: 'Estratti vegetali', slug: 'estratti-vegetali' }] }
    const html = renderProductPage('<html><head><title>x</title></head><body><!-- ssr:prodotto --></body></html>', { product: fresh, slug: 'omega-3' })
    const graph = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)[1])['@graph']
    const crumbs = graph.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.name)
    assert.deepEqual(crumbs, ['Home', 'Integratori', 'Estratti vegetali', 'Omega 3'])
    assert.equal(graph.find((n) => n['@type'] === 'Product').category, 'Integratori alimentari > Estratti vegetali')
  })
})

describe('sitemap', () => {
  test('indirizzi canonici: pagine, categorie e prodotti pubblicati con le foto', async () => {
    const res = await sitemapApi.GET(new Request('https://anteprima.vercel.app/sitemap.xml'))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /application\/xml/)
    const xml = await res.text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    assert.ok(locs.every((u) => u.startsWith('https://www.nutrexlab.it/')), 'sempre sul dominio principale')
    const paths = ['/', '/integratori', '/integratori/collagene', '/integratori/vitamine-e-minerali', '/integratori/estratti-vegetali', '/chi-siamo', '/prodotto/collagene', '/prodotto/magnesio']
    for (const path of paths) assert.ok(locs.includes(`https://www.nutrexlab.it${path}`), path)
    for (const path of ['/carrello', '/ordine', '/account', '/prodotto/nascosto', '/prodotto/altro-prodotto']) {
      assert.ok(!locs.includes(`https://www.nutrexlab.it${path}`), path)
    }
    assert.match(xml, /<image:loc>https:\/\/woo\.test\/img\/magnesio\.webp<\/image:loc>/)
    const head = await sitemapApi.HEAD(new Request('https://www.nutrexlab.it/sitemap.xml', { method: 'HEAD' }))
    assert.equal(head.status, 200)
    assert.equal(await head.text(), '')
  })

  test('WooCommerce non disponibile: i prodotti della linea, in cache per poco', async () => {
    const res = await withEnv({ WOOCOMMERCE_CATEGORY: undefined }, () => sitemapApi.GET(new Request('https://www.nutrexlab.it/sitemap.xml')))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('cache-control'), /s-maxage=300/)
    const xml = await res.text()
    assert.equal((xml.match(/\/prodotto\//g) ?? []).length, 12)
    assert.match(xml, /<image:loc>https:\/\/www\.nutrexlab\.it\/images\/prodotti\/vitamina-c\.webp<\/image:loc>/)
  })
})

describe('sessione', () => {
  test('cookie: Secure solo su https, cancellazione con Max-Age=0', () => {
    const http = new Request('http://127.0.0.1:5173/api/cart')
    const [c] = sessionCookies(http, { token: 'abc' })
    assert.doesNotMatch(c, /Secure/)
    const [gone, zero] = sessionCookies(http, { token: '', count: 0 })
    assert.match(gone, /^nx_cart=; .*Max-Age=0/)
    assert.match(zero, /^nx_count=; .*Max-Age=0/)
    assert.deepEqual(readSession(new Request('http://x/', { headers: { cookie: 'a=1; nx_cart=tok%20en' } })), { token: 'tok en' })
  })
})

describe('recensioni e prodotti correlati', () => {
  test('voto medio di WooCommerce e recensioni approvate (testo ripulito, nomi decodificati)', async () => {
    const p = await getProduct('magnesio')
    assert.deepEqual(p.rating, { average: 4.5, count: 2 })
    assert.equal(p.reviewsAllowed, true)
    const reviews = await listReviews(110)
    assert.equal(reviews.length, 2)
    assert.equal(reviews[0].reviewer, 'Giulia')
    assert.equal(reviews[0].verified, true)
    assert.equal(reviews[0].date, '2026-09-20T08:00:00Z')
    assert.doesNotMatch(reviews[0].review, /<script/)
    assert.equal(reviews[1].reviewer, 'Marco & Co')
  })

  test('recensioni di un prodotto di un altro negozio o non valido: 404 / 400', async () => {
    await rejectsWith(listReviews(200), 404, 'not_found')
    await rejectsWith(listReviews('x'), 400, 'invalid_product')
  })

  test('correlati: prima la stessa sottocategoria, poi il negozio; mai il prodotto stesso o quelli nascosti', async () => {
    const related = await relatedProducts(await getProduct('magnesio'))
    assert.deepEqual(
      related.map((p) => p.slug),
      ['collagene'],
    )
    assert.equal(related[0].description, undefined)
  })

  test('/api/products?slug=: prodotto e correlati; /api/recensioni in cache sul CDN', async () => {
    const res = await productsApi.GET(new Request('https://negozio.test/api/products?slug=magnesio'))
    const body = await res.json()
    assert.equal(body.product.slug, 'magnesio')
    assert.deepEqual(
      body.related.map((p) => p.slug),
      ['collagene'],
    )
    const rev = await reviewsApi.GET(new Request('https://negozio.test/api/recensioni?product=110'))
    assert.equal(rev.status, 200)
    assert.match(rev.headers.get('cache-control'), /s-maxage=60/)
    assert.equal((await rev.json()).reviews.length, 2)
  })
})

describe('moduli verso il plugin: contatti e recensioni', () => {
  const message = { nome: 'Anna Verdi', email: 'anna@example.com', tema: 'Ordini e spedizioni', prodotto: '', messaggio: 'Buongiorno, una domanda sulla spedizione.' }
  const post = (api, url, body, headers = {}) => api.POST(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }))

  test('campi controllati prima di chiamare il plugin', () => {
    assert.throws(() => cleanMessage({ ...message, nome: 'A' }), /nome/)
    assert.throws(() => cleanMessage({ ...message, email: 'anna' }), /email/)
    assert.throws(() => cleanMessage({ ...message, messaggio: 'Ok' }), /messaggio/)
    assert.equal(cleanMessage({ ...message, sito: 'http://spam.example' }), null)
    assert.throws(() => cleanReview({ product: 110, nome: 'Anna', email: 'anna@example.com', voto: 6, testo: 'Ottimo davvero.' }), /stelle/)
    assert.throws(() => cleanReview({ product: 'x', nome: 'Anna', email: 'anna@example.com', voto: 5, testo: 'Ottimo davvero.' }), /Prodotto/)
  })

  test('/api/contatto: inoltro al plugin con l\'indirizzo IP del visitatore, risposta mai in cache', async () => {
    const before = woo.plugin.length
    const res = await post(contactApi, 'https://negozio.test/api/contatto', message, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('cache-control'), 'private, no-store')
    assert.deepEqual(await res.json(), { ok: true })
    const call = woo.plugin.at(-1)
    assert.equal(woo.plugin.length, before + 1)
    assert.equal(call.path, '/wp-json/nutrex/v1/contatto')
    assert.equal(call.headers['X-Nutrex-Client'], '203.0.113.9')
    assert.equal(JSON.parse(call.body).nome, 'Anna Verdi')
    assert.equal(JSON.parse(call.body).sito, undefined)
  })

  test('robot (campo trappola compilato): ok senza chiamare il plugin', async () => {
    const before = woo.plugin.length
    const res = await post(contactApi, 'https://negozio.test/api/contatto', { ...message, sito: 'http://spam.example' })
    assert.equal(res.status, 200)
    assert.equal(woo.plugin.length, before)
  })

  test('errori del plugin: il suo messaggio al cliente (429), messaggio generico senza dettagli se il plugin manca', async () => {
    try {
      woo.pluginReply = { status: 429, data: { code: 'nutrex_contact_limit', message: "Hai inviato molti messaggi in poco tempo: riprova tra un po'." } }
      let res = await post(contactApi, 'https://negozio.test/api/contatto', message)
      assert.equal(res.status, 429)
      assert.match((await res.json()).error.message, /molti messaggi/)
      woo.pluginReply = { status: 404, data: { code: 'rest_no_route', message: 'Nessun percorso corrisponde.' } }
      res = await post(contactApi, 'https://negozio.test/api/contatto', message)
      assert.equal(res.status, 502)
      const text = await res.text()
      assert.match(text, /non riuscito/)
      assert.doesNotMatch(text, /rest_no_route|percorso/)
    } finally {
      woo.pluginReply = null
    }
  })

  test('/api/recensioni POST: la recensione arriva al plugin, che dice se e\' gia\' pubblicata', async () => {
    try {
      woo.pluginReply = { status: 200, data: { ok: true, approved: true } }
      const res = await post(reviewsApi, 'https://negozio.test/api/recensioni', { product: 110, nome: 'Anna', email: 'anna@example.com', voto: 5, testo: 'Ottimo prodotto.' })
      assert.equal(res.status, 200)
      assert.deepEqual(await res.json(), { ok: true, approved: true })
      const sent = JSON.parse(woo.plugin.at(-1).body)
      assert.equal(woo.plugin.at(-1).path, '/wp-json/nutrex/v1/recensione')
      assert.equal(sent.product_id, 110)
      assert.equal(sent.voto, 5)
      woo.pluginReply = { status: 403, data: { code: 'nutrex_review_verified', message: 'Possono scrivere una recensione solo i clienti che hanno acquistato questo prodotto.' } }
      const no = await post(reviewsApi, 'https://negozio.test/api/recensioni', { product: 110, nome: 'Anna', email: 'anna@example.com', voto: 5, testo: 'Ottimo prodotto.' })
      assert.equal(no.status, 403)
      assert.match((await no.json()).error.message, /hanno acquistato/)
    } finally {
      woo.pluginReply = null
    }
  })
})
