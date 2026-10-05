import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { defineConfig } from 'vite'

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

export default defineConfig({
  plugins: [partials, modelVersions],
  // piu' pagine: /acquista apre acquista.html (anche con vite preview); un indirizzo sconosciuto da' 404
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
        acquista: resolve('acquista.html'),
        carrello: resolve('carrello.html'),
        pagamenti: resolve('pagamenti.html'),
        contatti: resolve('contatti.html'),
      },
    },
  },
})
