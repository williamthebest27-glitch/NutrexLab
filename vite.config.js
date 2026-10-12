import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig } from 'vite'
import { PAGES } from './src/seo/pages.js'
import { headTags } from './src/seo/head.js'
import { catalogMain, staticGrid, shopFaq, shopCategories, lineSection } from './src/seo/build.js'
import { translatePage, finishItalian } from './src/seo/translate.js'
import { PREFIXED, splitLang } from './src/i18n/langs.js'
import langMiddleware, { config as langMiddlewareConfig } from './middleware.js'

// versioni dei modelli 3D (scripts/sync-model.mjs) nello script di precaricamento di index.html
const modelVersions = {
  name: 'model-versions',
  transformIndexHtml: (html) =>
    html.replace('__MODEL_VERSIONS__', JSON.stringify(JSON.parse(readFileSync('src/model-versions.json', 'utf8')))),
}

/*
  Parti comuni a tutte le pagine (navbar, menu mobile, footer): un solo file in src/partials,
  inserito al posto di <!-- @nome --> in ogni pagina HTML (in sviluppo e nella build).
*/
const PARTIALS = resolve('src/partials')
const partials = {
  name: 'partials',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      html.replace(/<!--\s*@([a-z-]+)\s*-->/g, (_, name) => readFileSync(resolve(PARTIALS, `${name}.html`), 'utf8').trim()),
  },
  configureServer(server) {
    // modificando una parte comune le pagine aperte si ricaricano
    server.watcher.add(PARTIALS)
    server.watcher.on('change', (file) => {
      if (file.startsWith(PARTIALS + sep)) server.ws.send({ type: 'full-reload' })
    })
  },
}

/*
  SEO delle pagine statiche (dati in src/seo/): nel file HTML
  - <!-- seo:chiave -->      -> titolo, descrizione, canonical, hreflang, Open Graph, Twitter e dati strutturati
                                della pagina "chiave" di src/seo/pages.js (solo dentro <head>: nulla di visibile;
                                tra <!--nx:seo:chiave--> e <!--/nx:seo-->, per rifarlo nelle altre lingue)
  - <!-- seo:linea -->       -> sezione "La linea Nutrex Lab" della homepage (prima del footer)
  - <!-- griglia:tutti -->   -> le schede dei prodotti della pagina Integratori, gia' nell'HTML
  - <!-- faq:integratori --> -> domande frequenti della pagina Integratori
  - <!-- categorie:tutti --> -> link alle categorie nella pagina Integratori
  - <!-- catalogo:chiave --> -> contenuto delle pagine categoria (src/seo/build.js)
  Cambiando i dati in src/seo/ il server di sviluppo si riavvia da solo (sono dipendenze di questo file).
*/
const seo = {
  name: 'seo',
  transformIndexHtml: {
    order: 'pre',
    handler: (html, ctx) =>
      html
        .replace(/<!--\s*seo:linea\s*-->/g, () => lineSection())
        .replace(/<!--\s*faq:integratori\s*-->/g, () => shopFaq())
        .replace(/<!--\s*categorie:tutti\s*-->/g, () => shopCategories())
        .replace(/<!--\s*seo:([a-z0-9-]+)\s*-->/g, (_, key) => {
          if (!PAGES[key]) throw new Error(`SEO: nessuna pagina "${key}" in src/seo/pages.js (${ctx.filename})`)
          return `<!--nx:seo:${key}-->${headTags(PAGES[key])}<!--/nx:seo-->`
        })
        .replace(/<!--\s*griglia:([a-z0-9-]+)\s*-->/g, (_, key) => staticGrid(key))
        .replace(/<!--\s*catalogo:([a-z0-9-]+)\s*-->/g, (_, key) => catalogMain(key)),
  },
}

/*
  Pagine nelle altre lingue (src/i18n/langs.js): /de/integratori, /en/chi-siamo, /fr (homepage)...
  - build: dopo aver scritto le pagine italiane in dist/, ogni pagina si riscrive tradotta in dist/<lingua>/
    (la homepage in dist/<lingua>.html), con il <head> della sua lingua (src/seo/translate.js). La pagina
    d'errore resta una sola (Vercel la serve per ogni indirizzo: si traduce nel browser).
  - sviluppo: /de/... si prepara al volo dalla pagina italiana, nello stesso modo.
  Testi senza traduzione: avviso nel terminale (restano in italiano; npm test li segnala).
*/
const pageFile = (path) => {
  const clean = path.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1')
  return clean === '/' ? 'index.html' : `${clean.slice(1)}.html`
}

function reportMissing(lang, file, missing) {
  if (!missing.length) return
  const list = missing.slice(0, 5).map((s) => `"${s.replace(/\s+/g, ' ').slice(0, 70)}"`).join(', ')
  console.warn(`[i18n] ${lang}: ${missing.length} testi senza traduzione in ${file} (restano in italiano): ${list}${missing.length > 5 ? '...' : ''}`)
}

/*
  Il middleware della lingua (middleware.js: ?lang= dei link e lingua scelta nel cookie; il paese in locale
  non c'e') anche con npm run dev e npm run preview, sugli stessi indirizzi che usa Vercel.
*/
const matchers = langMiddlewareConfig.matcher.map((m) => new RegExp(`^${m.replace(/\/:path\*$/, '(?:/.*)?')}$`))
const langRedirects = async (req, res, next) => {
  const path = (req.url ?? '/').split('?')[0]
  if (!matchers.some((re) => re.test(path))) return next()
  try {
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
    const out = await langMiddleware(new Request(`http://${req.headers.host ?? '127.0.0.1'}${req.url}`, { method: req.method, headers }))
    const location = out?.headers.get('location')
    if (!location) return next()
    const target = new URL(location)
    res.statusCode = out.status
    res.setHeader('Location', target.pathname + target.search)
    const cookie = out.headers.get('set-cookie')
    if (cookie) res.setHeader('Set-Cookie', cookie)
    res.end()
  } catch (err) {
    next(err)
  }
}

const i18nPages = {
  name: 'i18n-pages',
  configurePreviewServer(server) {
    server.middlewares.use(langRedirects)
  },
  configureServer(server) {
    server.middlewares.use(langRedirects)
    server.middlewares.use(async (req, res, next) => {
      const [pathname, search = ''] = (req.url ?? '/').split('?')
      const { lang, path } = splitLang(pathname)
      if (!lang || path.startsWith('/prodotto/') || !/text\/html|\*\/\*/.test(req.headers.accept ?? '*/*')) return next()
      const file = pageFile(path)
      if (file === '404.html' || !existsSync(resolve(file))) return next()
      try {
        const italian = await server.transformIndexHtml(`/${file}${search ? `?${search}` : ''}`, readFileSync(resolve(file), 'utf8'))
        const { html, missing } = await translatePage(italian, lang)
        reportMissing(lang, file, missing)
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      } catch (err) {
        next(err)
      }
    })
  },
  async writeBundle(options, bundle) {
    const dir = options.dir ?? resolve('dist')
    const pages = Object.keys(bundle).filter((f) => f.endsWith('.html'))
    for (const file of pages) {
      const italian = readFileSync(resolve(dir, file), 'utf8')
      writeFileSync(resolve(dir, file), finishItalian(italian))
      if (file === '404.html') continue
      for (const lang of PREFIXED) {
        const { html, missing } = await translatePage(italian, lang)
        reportMissing(lang, file, missing)
        const out = resolve(dir, file === 'index.html' ? `${lang}.html` : `${lang}/${file}`)
        mkdirSync(dirname(out), { recursive: true })
        writeFileSync(out, html)
      }
    }
  },
}

/*
  Funzioni del negozio (/api, su Vercel sono Vercel Functions) anche con `npm run dev` e
  `npm run preview`, con le stesse riscritture di vercel.json (/prodotto/<slug>, /sitemap.xml).
  Le funzioni leggono la configurazione solo dalle variabili d'ambiente del processo (su Vercel le
  imposta Vercel; in locale vanno passate al comando, vedi HEADLESS_COMMERCE_SETUP.md): nessun file
  di segreti viene letto da qui.
*/
function shopFunctions() {
  async function toRequest(req) {
    const url = `http://${req.headers.host ?? '127.0.0.1'}${req.url}`
    const headers = new Headers()
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
    let body
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = []
      for await (const c of req) chunks.push(c)
      body = Buffer.concat(chunks)
    }
    return new Request(url, { method: req.method, headers, body })
  }

  async function send(res, response) {
    res.statusCode = response.status
    response.headers.forEach((v, k) => {
      if (k !== 'set-cookie') res.setHeader(k, v)
    })
    const cookies = response.headers.getSetCookie?.() ?? []
    if (cookies.length) res.setHeader('Set-Cookie', cookies)
    res.end(Buffer.from(await response.arrayBuffer()))
  }

  // /prodotto/<slug> (anche /de/prodotto/<slug>) -> pagina prodotto, /sitemap.xml -> api/sitemap,
  // /feed/google.xml -> api/merchant-feed,
  // /api/<nome> -> api/<nome>.js
  const route = (url) => {
    const { lang, path } = splitLang(url.split('?')[0])
    const product = /^\/prodotto\/([^/]+)\/?$/.exec(path)
    if (product) return { name: 'product-page', slug: product[1], lang: lang ?? 'it' }
    if (lang) return null
    if (path === '/sitemap.xml') return { name: 'sitemap', query: '' }
    if (path === '/feed/google.xml') return { name: 'merchant-feed', query: '' }
    const api = /^\/api\/([a-z0-9-]+)\/?$/.exec(path)
    if (api) return { name: api[1], query: url.split('?')[1] ?? '' }
    return null
  }

  const middleware = (load, productTemplate) => async (req, res, next) => {
    const r = route(req.url ?? '')
    if (!r) return next()
    try {
      const request = await toRequest(req)
      if (r.name === 'product-page') {
        // il modello della pagina e' prodotto.html (in sviluppo trasformato da Vite)
        const [{ getProduct }, { renderProductPage }] = await Promise.all([load('/server/catalog.js'), load('/server/product-page.js')])
        const slug = decodeURIComponent(r.slug)
        let product = null
        let status = 200
        try {
          product = await getProduct(slug)
        } catch (err) {
          status = err?.status === 404 ? 404 : 503
          if (status === 503) console.error('[negozio:product-page]', err?.message)
        }
        // slug di WooCommerce diverso da quello del sito: come api/product-page.js, 301 all'indirizzo del sito
        if (product && product.slug !== slug) {
          res.statusCode = 301
          res.setHeader('Location', r.lang === 'it' ? `/prodotto/${product.slug}` : `/${r.lang}/prodotto/${product.slug}`)
          return res.end()
        }
        const html = await renderProductPage(await productTemplate(r.lang), { product, slug, status, lang: r.lang })
        res.statusCode = status
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.end(html)
      }
      const mod = await load(`/api/${r.name}.js`)
      const handler = mod[req.method]
      if (typeof handler !== 'function') {
        res.statusCode = 405
        return res.end()
      }
      const target = new Request(new URL(`/api/${r.name}?${r.query}`, request.url), request)
      return send(res, await handler(target))
    } catch (err) {
      console.error('[negozio:sviluppo]', err)
      res.statusCode = 500
      res.end('errore')
    }
  }

  return {
    name: 'shop-functions',
    configureServer(server) {
      const load = (file) => server.ssrLoadModule(file)
      // modello della pagina prodotto: prodotto.html trasformato da Vite (e tradotto nelle altre lingue)
      const template = async (lang) => {
        const html = await server.transformIndexHtml('/prodotto.html', readFileSync('prodotto.html', 'utf8'))
        return (await translatePage(html, lang)).html
      }
      server.middlewares.use(middleware(load, template))
    },
    configurePreviewServer(server) {
      const load = (file) => import(pathToFileURL(resolve(`.${file}`)).href)
      const template = async (lang) => readFileSync(lang === 'it' ? 'dist/prodotto.html' : `dist/${lang}/prodotto.html`, 'utf8')
      server.middlewares.use(middleware(load, template))
    },
  }
}

export default defineConfig({
  plugins: [partials, seo, modelVersions, i18nPages, shopFunctions()],
  // piu' pagine: /integratori apre integratori.html, /integratori/collagene integratori/collagene.html
  // (anche con vite preview); un indirizzo sconosciuto da' 404
  appType: 'mpa',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200, // three.js e' grande per natura: serve gia' nella hero
    rolldownOptions: {
      input: {
        main: resolve('index.html'),
        // negozio: tutti i prodotti e le categorie (/acquista porta qui, vercel.json)
        integratori: resolve('integratori.html'),
        'integratori/collagene': resolve('integratori/collagene.html'),
        'integratori/vitamine-e-minerali': resolve('integratori/vitamine-e-minerali.html'),
        'integratori/estratti-vegetali': resolve('integratori/estratti-vegetali.html'),
        prodotto: resolve('prodotto.html'),
        carrello: resolve('carrello.html'),
        ordine: resolve('ordine.html'),
        contatti: resolve('contatti.html'),
        'chi-siamo': resolve('chi-siamo.html'),
        // pagina d'errore (Vercel la serve con lo stato 404)
        404: resolve('404.html'),
        // pagine legali (link nel footer)
        'note-legali': resolve('note-legali.html'),
        'privacy-policy': resolve('privacy-policy.html'),
        'cookie-policy': resolve('cookie-policy.html'),
        'termini-e-condizioni': resolve('termini-e-condizioni.html'),
        'spedizioni-e-resi': resolve('spedizioni-e-resi.html'),
      },
    },
  },
})
