// Copia i modelli esportati da Blender dentro public/models,
// cosi' il sito usa sempre l'ultima versione di ogni barattolo.
// (sul server di Vercel le cartelle sorgente non ci sono: restano le copie in public/models)
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// [file esportato da Blender (rispetto a questa cartella), nome in public/models = id del prodotto]
const files = [
  ['../web/barattolo.glb', 'collagene.glb'], // collagene marino in polvere
  ['../../prodotti/Bromelina/web/barattolo.glb', 'bromelina.glb'],
  ['../../prodotti/Ashwaganda/web/barattolo.glb', 'ashwagandha.glb'],
  ['../../prodotti/Coenzima Q10/web/barattolo.glb', 'coenzima-q10.glb'],
  ['../../prodotti/Collagene Bovino Compresse/web/barattolo.glb', 'collagene-bovino.glb'],
  ['../../prodotti/Collagene Marino Compresse/web/barattolo.glb', 'collagene-marino-compresse.glb'],
  ['../../prodotti/D-Mannosio/web/barattolo.glb', 'd-mannosio.glb'],
  ['../../prodotti/Diosmina/web/barattolo.glb', 'diosmina.glb'],
  ['../../prodotti/Magnesio Bisglicinato/web/barattolo.glb', 'magnesio.glb'],
  ['../../prodotti/Vitamina B12/web/barattolo.glb', 'vitamina-b12.glb'],
  ['../../prodotti/Vitamina C/web/barattolo.glb', 'vitamina-c.glb'],
  ['../../prodotti/Vitamina D3-K2/web/barattolo.glb', 'vitamina-d3-k2.glb'],
  // sezione del bicchiere (Website/sezione bicchiere/blender/esperienza_3d.py, compressi Draco)
  ['../sezione bicchiere/web/glass.glb', 'nutrexlab/glass.glb'],
  ['../sezione bicchiere/web/scoop.glb', 'nutrexlab/scoop.glb'],
  ['../sezione bicchiere/web/capsule.glb', 'nutrexlab/capsule.glb'],
  ['../sezione bicchiere/web/tablet.glb', 'nutrexlab/tablet.glb'],
]

mkdirSync(resolve(root, 'public/models'), { recursive: true })
for (const [from, name] of files) {
  const src = resolve(root, from)
  const dst = resolve(root, 'public/models', name)
  if (!existsSync(src)) continue
  if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) continue
  mkdirSync(dirname(dst), { recursive: true })
  copyFileSync(src, dst)
  console.log(`[sync-model] ${name} aggiornato`)
}

// versione di ogni modello (hash del contenuto) per src/products.js e il precaricamento in index.html:
// l'indirizzo del file cambia solo quando cambia il barattolo, cosi' il browser non mostra mai
// un modello vecchio rimasto in cache (e quelli invariati restano in cache).
// I modelli della sezione del bicchiere hanno la chiave con la cartella (es. "nutrexlab/glass").
const versions = {}
for (const dir of ['', 'nutrexlab/']) {
  const abs = resolve(root, 'public/models', dir)
  if (!existsSync(abs)) continue
  for (const f of readdirSync(abs).filter((f) => f.endsWith('.glb')).sort()) {
    versions[dir + f.slice(0, -4)] = createHash('sha1').update(readFileSync(resolve(abs, f))).digest('hex').slice(0, 10)
  }
}
const versionsFile = resolve(root, 'src/model-versions.json')
const json = `${JSON.stringify(versions, null, 2)}\n`
if (!existsSync(versionsFile) || readFileSync(versionsFile, 'utf8') !== json) {
  writeFileSync(versionsFile, json)
  console.log('[sync-model] versioni dei modelli aggiornate')
}

// decoder Draco (per i modelli della sezione del bicchiere e i prodotti con un modello *_draco.glb)
const dracoSrc = resolve(root, 'node_modules/three/examples/jsm/libs/draco/gltf')
const dracoDst = resolve(root, 'public/draco')
if (existsSync(dracoSrc)) {
  mkdirSync(dracoDst, { recursive: true })
  for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
    if (!existsSync(resolve(dracoDst, f))) copyFileSync(resolve(dracoSrc, f), resolve(dracoDst, f))
  }
}
