import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// versioni dei modelli 3D (scripts/sync-model.mjs) nello script di precaricamento di index.html
const modelVersions = {
  name: 'model-versions',
  transformIndexHtml: (html) =>
    html.replace('__MODEL_VERSIONS__', JSON.stringify(JSON.parse(readFileSync('src/model-versions.json', 'utf8')))),
}

export default defineConfig({
  plugins: [modelVersions],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200, // three.js e' grande per natura: serve gia' nella hero
  },
})
