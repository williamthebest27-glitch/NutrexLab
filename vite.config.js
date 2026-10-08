import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig } from 'vite'
import { PAGES } from './src/seo/pages.js'
import { headTags } from './src/seo/head.js'
import { catalogMain, staticGrid, shopFaq, shopCategories, lineSection } from './src/seo/build.js'

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
  - <!-- seo:chiave -->      -> titolo, descrizione, canonical, Open Graph, Twitter e dati strutturati
                                della pagina "chiave" di src/seo/pages.js (solo dentro <head>: nulla di visibile)
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
          return headTags(PAGES[key])
        })
        .replace(/<!--\s*griglia:([a-z0-9-]+)\s*-->/g, (_, key) => staticGrid(key))
        .replace(/<!--\s*catalogo:([a-z0-9-]+)\s*-->/g, (_, key) => catalogMain(key)),
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

  // /prodotto/<slug> -> pagina prodotto, /sitemap.xml -> api/sitemap, /api/<nome> -> api/<nome>.js
  const route = (url) => {
    const path = url.split('?')[0]
    const product = /^\/prodotto\/([^/]+)\/?$/.exec(path)
    if (product) return { name: 'product-page', query: `slug=${product[1]}` }
    if (path === '/sitemap.xml') return { name: 'sitemap', query: '' }
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
        const slug = decodeURIComponent(r.query.replace(/^slug=/, ''))
        let product = null
        let status = 200
        try {
          product = await getProduct(slug)
        } catch (err) {
          status = err?.status === 404 ? 404 : 503
          if (status === 503) console.error('[negozio:product-page]', err?.message)
        }
        const html = renderProductPage(await productTemplate(req.url), { product, slug, status })
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
      const template = (url) => server.transformIndexHtml(url, readFileSync('prodotto.html', 'utf8'))
      server.middlewares.use(middleware(load, template))
    },
    configurePreviewServer(server) {
      const load = (file) => import(pathToFileURL(resolve(`.${file}`)).href)
      const template = async () => readFileSync('dist/prodotto.html', 'utf8')
      server.middlewares.use(middleware(load, template))
    },
  }
}

export default defineConfig({
  plugins: [partials, seo, modelVersions, shopFunctions()],
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
