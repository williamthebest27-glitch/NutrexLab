# ProductExperience

Sezione 3D pinnata, guidata dallo scroll, per i prodotti NutrexLab: un bicchiere d'acqua in uno
studio fotografico scuro e il prodotto (polvere, capsula o compressa). Three.js + GSAP
ScrollTrigger, nessun'altra dipendenza. Nel sito e' il capitolo "Preparazione", tra Scienza e
Ogni giorno (`#rituale` in `index.html`).

Nel sito lo studio e' quello del render di Blender (`themeFromSite(theme, { studio: 'scuro' })`):
fondo nero, piano illuminato attorno al bicchiere, e il bicchiere e' il render stesso.
Vetro, acqua, bollicine e logo inciso non si calcolano nel browser: sono le immagini del bicchiere
(`/models/nutrexlab/vetro/scuro/vetro_eNN.webp`, una ogni 3 gradi di inclinazione della camera, dai
3 ai 33), e per ogni pixel lo shader (`shaders/impostor.js`) prende quella con la stessa
inclinazione del raggio. Il bicchiere e' tondo: girandogli attorno resta identico al render. Sopra
le immagini solo cio' che entra nel bicchiere (la polvere, l'acqua che si intorbida). Senza
`studio` (o finche' le immagini non arrivano) il vetro e' calcolato come prima, nello studio nero.

Il fondo e' nero per tutti i prodotti: nella passata finale (e sul bicchiere renderizzato, allo
stesso modo) i toni fino al punto del nero (`blackPoint` del tema, `GRADE` in `shaders/chunks.js`)
diventano nero pieno: la parete grigia del render e quello che se ne vede attraverso il vetro e
l'acqua. Dai toni medi in su (capsule, compresse, misurino, luce sul piano, luci e logo del vetro)
l'immagine resta quella del render.

Il tipo sceglie l'animazione:

- **powder** (polvere): il misurino pieno a raso si avvicina, ruota e si inclina, la polvere cade
  in un filo sottile, entra nell'acqua, galleggia un istante e scende in una nuvola che si scioglie.
- **capsule** e **tablet** (capsula, compressa): il prodotto non entra mai nel bicchiere e non gli
  passa ne' davanti ne' dietro (sembrerebbe dentro all'acqua). Resta sospeso alla sua destra e ruota
  su se stesso, il bicchiere gira sul piatto, la camera gli gira intorno; poi la macro sui
  dettagli (incisione, grana, giunzione della capsula) e il prodotto si posa accanto al bicchiere.
  Con `count` (la dose del giorno: 2 capsule, 3 compresse...) gli altri pezzi arrivano dopo la
  macro, scendono dall'alto e si posano accanto al primo: nella macro se ne vede sempre uno.
  La capsula e' tutta bianca (polvere bianca dentro); la compressa e' rotonda con l'esagono
  inciso o, con `shape: 'oval'`, ovale con la linea di frattura.

Tutto e' funzione della posizione di scroll: tornando indietro l'animazione torna indietro.

## Uso

JavaScript (come nel sito, `src/main.js`):

```js
import { createProductExperience, themeFromSite } from './components/ProductExperience/index.js'

const exp = createProductExperience(document.querySelector('#rituale'), {
  type: 'capsule',
  productName: 'Coenzima Q10',
  theme: themeFromSite(product.theme),
  copy: { pins: { dose: ['Cardio Premium', 'Con acetil L-carnitina'] } },
})
exp.setProduct({ type: 'tablet', shape: 'oval', count: 2, theme, copy })  // cambio prodotto: stessa scena
exp.destroy()
```

HTML dichiarativo:

```html
<section data-product-experience data-type="tablet" data-product-name="Vitamina C"></section>
<script type="module">
  import { mountProductExperiences } from './components/ProductExperience/index.js'
  mountProductExperiences()
</script>
```

React (Next.js, Vite + React): `ProductExperience.tsx`, tipi in `index.d.ts`.

```tsx
import { ProductExperience } from './components/ProductExperience/ProductExperience'

<ProductExperience type="capsule" productName="Coenzima Q10" theme={{ accent: '#e0a33a' }} />
```

Servono `three` e `gsap`, e in `public/` le cartelle `models/nutrexlab`, `images/nutrexlab` e
`draco` del sito (oppure `modelsPath`, `postersPath`, `dracoPath`).

## Opzioni

| Opzione | Default | |
| --- | --- | --- |
| `type` | `'powder'` | `powder`, `capsule` o `tablet`: sceglie l'animazione |
| `steps` | `4` | durata del pin in schermate di scroll (la sezione e' alta `steps + 1` schermate) |
| `productName`, `productNote` | | nome in basso a destra (desktop) |
| `chapter` | | numero davanti al sopratitolo (es. `'05'`) |
| `theme` | tema di base | colori di studio e prodotto (`themeFromSite()` li ricava da un prodotto del sito; con `{ studio: 'scuro' }` lo studio e il bicchiere del render) |
| `copy` | testi del tipo (`copy.js`) | `eyebrow`, `titleA`, `titleB` (una voce per riga), `pins.dose`, `pins.water`, `pins.aside` (`[titolo, testo]`), `benefits` (fino a tre `[titolo, testo]`) |
| `poster` | immagine del tipo | immagine statica del prodotto: URL o `(layout) => URL` |
| `model` | modello del tipo | URL del modello del prodotto (misurino, capsula o compressa) |
| `shape` | | forma per i tipi che ne hanno piu' d'una: `'oval'` = compressa ovale (`tablet-oblong.glb`) |
| `count` | `1` | capsule o compresse della dose del giorno: alla fine si posano tutte accanto al bicchiere |
| `aside` | `0` | pezzi a parte (es. il mantenimento): si posano a sinistra del bicchiere con la loro etichetta (`copy.pins.aside`); l'etichetta della dose passa sopra i suoi pezzi |
| `resolveModel` | | `(file) => URL` per ogni modello, per esempio con la versione nell'indirizzo |
| `modelsPath`, `postersPath`, `dracoPath` | `/models/nutrexlab/`, `/images/nutrexlab/`, `/draco/` | cartelle |
| `etch`, `etchOptions` | | logo vettoriale inciso sul vetro (formato di `src/ui/logo-paths.js`) |
| `getVh` | `window.innerHeight` | altezza dello schermo per lo scroll (nel sito quella stabile di `main.js`) |
| `scrub` | `true` | scrub di ScrollTrigger |
| `lazyMargin` | `'150%'` | quanto prima dello schermo si carica la parte 3D |
| `calm` | browser inattivo | `() => Promise`: momento tranquillo per la preparazione anticipata (nel sito: nessuno scroll da 0.4 s) |
| `quality` | automatica | `{ tier, dpr, msaa, particles, dispersion, ... }` per forzare la qualita' |

## Testi ed etichette

- Titoli: il titolo d'apertura entra prima del pin ed esce all'inizio; quello finale entra alla
  fine. L'ultima riga e' nel colore d'accento. Se una parola e' troppo lunga per il suo spazio
  (es. SEMPLIFICATA.) il titolo si riduce quanto basta: non invade la scena, non tocca la sequenza
  a destra e su mobile non esce dallo schermo.
- Benefici (capsule e compresse, `copy.benefits`): nella macro tre etichette attorno al prodotto
  al posto di `pins.dose`, una dopo l'altra (a sinistra, a destra, sotto), linea nel colore
  d'accento, titolo e frase grandi. Il testo resta fermo per tutta la macro, fuori da dove arriva
  il prodotto girando e dal bicchiere che rientra alla fine; il pallino (piu' grande) scorre sul
  bordo del prodotto e la linea lo segue. Sul telefono una riga sola sotto il prodotto con i tre
  titoli insieme. Nel sito sono i primi tre benefici della pagina prodotto (`src/seo/catalog.js`).
- Un'etichetta puo' essere evidenziata (terzo elemento `true` di `[titolo, testo, true]`): titolo
  nel colore d'accento, su due righe se serve.
- Etichette agganciate al 3D (`pins.dose` sul prodotto, `pins.water` sul bicchiere, `pins.aside`
  sui pezzi a parte), come quelle del sito: la linea esce sempre dalla sagoma dell'oggetto e il
  testo non copre mai prodotto, bicchiere, titoli o un'altra etichetta e resta nello schermo. Ogni
  etichetta prova, in ordine: il suo lato su una riga o su piu' righe, l'altro lato, sotto
  l'oggetto, sopra (sopra e sotto, se tocca qualcosa di fianco, si sposta prima di lato). Se non
  c'e' posto non compare.

## Prestazioni e robustezza

- La parte 3D si carica quando la sezione si avvicina (IntersectionObserver) oppure prima, con
  `exp.preload()`: in anticipo lavora a piccoli passi solo nei momenti tranquilli (`calm`) e, se la
  sezione intanto si avvicina, completa un passo per fotogramma. Scarica soltanto il codice e il
  modello del tipo attuale (bicchiere + misurino, capsula o compressa; GLB compressi Draco, 30-65 KB
  l'uno), in parallelo alla preparazione del renderer. Disegna solo mentre la sezione e' sullo schermo.
- Passi brevi (pochi ms su un computer): contesto WebGL e ambiente dello studio separati
  (`new ProductScene()`, poi `scene.init()`), granelli della polvere calcolati in un worker
  (`powderPour.js`: stesso risultato di prima, deterministico), ScrollTrigger creati una volta sola
  (`rebuild()` rifa' solo le timeline), shader preparati una passata per fotogramma, primo uso
  della GPU uno strato per fotogramma (`primeSteps()`) prima di mostrare il canvas.
- Gli shader si compilano in parallelo (KHR_parallel_shader_compile) con il render target in cui
  ogni scena viene davvero disegnata: nessuna compilazione sincrona al primo fotogramma.
- Cambio prodotto con un tipo diverso mentre la sezione e' lontana: la nuova esperienza si prepara
  al primo momento tranquillo, non durante l'animazione del cambio.
- Qualita' per dispositivo (`quality.js`): desktop completo; tablet senza MSAA e con meno
  particelle; mobile a risoluzione ridotta e senza dispersione cromatica. La risoluzione scende
  da sola se i 60 fps non tengono.
- Senza WebGL (o se il contesto si perde) resta l'immagine statica con gli stessi testi animati.
- `prefers-reduced-motion`: niente movimenti automatici della camera.
- `destroy()` libera tutto (ScrollTrigger, scena, contesto WebGL), anche se arriva mentre la
  scena si sta ancora caricando: sicuro con React StrictMode e con i cambi di pagina.

## File

| File | |
| --- | --- |
| `index.js` | API pubblica: `createProductExperience`, `mountProductExperiences`, `themeFromSite` |
| `ProductExperienceCore.js` | orchestratore: DOM, testi, timeline, scroll, caricamento, etichette |
| `ProductExperience.tsx`, `index.d.ts` | involucro React e tipi TypeScript |
| `ProductScene.js` | renderer e passate (strato posteriore, contenuto dell'acqua, vetro come lente o bicchiere renderizzato) |
| `ProductCamera.js`, `ProductLighting.js` | camera cinematografica, luci e ambiente dello studio |
| `ScrollAnimation.js` | chiavi -> tween GSAP, righe mascherate, ScrollTrigger della sezione |
| `PowderExperience.js` | misurino, polvere, acqua che si intorbida |
| `powderPour.js`, `powderPour.worker.js` | calcolo della versata (granelli, nuvola, increspature) in un worker |
| `ShowcaseExperience.js`, `CapsuleExperience.js`, `TabletExperience.js` | capsula e compressa |
| `kit.js`, `assets.js`, `etching.js`, `quality.js`, `copy.js` | particelle, caricamento modelli, logo inciso, qualita', testi di default |
| `shaders/` | vetro, acqua, fondale, particelle, composizione finale, bicchiere renderizzato (`impostor.js`) |

## Modelli e immagini statiche

- Modelli: `Website/sezione bicchiere/blender/bicchiere_3d.py` (Blender 5.1, procedurale, misure
  reali in mm) esporta `web/glass.glb`: tumbler a tronco di cono, fondo pesante, acqua a 80 mm;
  negli extras le misure (`r_top`, `r_bot`, `wall`, fondo a coppa, incavo, bollicine) e il campo
  delle immagini del bicchiere (`imp_*`). Con `npm run bicchiere-web-scuro` le immagini
  (`web/vetro/scuro/`). `blender/esperienza_3d.py` esporta `scoop.glb`, `capsule.glb`, `tablet.glb`;
  la compressa ovale (`web/tablet-oblong.glb`) viene da `blender/compressa_ovale_3d.py`.
  `scripts/sync-model.mjs` copia tutto in `public/models/nutrexlab/` con la versione nell'indirizzo.
  Da `Website/sezione bicchiere`: `npm run bicchiere`, `npm run modelli` (solo export),
  `npm run render` (anche render e `.blend`).
- Immagini statiche (`public/images/nutrexlab/`): fotogrammi della scena WebGL, una per prodotto
  (`esperienza-<id>.webp` e `-mobile.webp`) e una per tipo. Si rigenerano dal banco di prova con
  `await __postersAll()` nella console (solo alcune: `__postersAll(['vitamina-c', 'capsule'])`).
  Nel sito hanno la versione nell'indirizzo (`scripts/sync-model.mjs`, una per tutte le immagini).

## Banco di prova

`Website/sezione bicchiere`: `npm run sandbox` -> http://127.0.0.1:5180 (`?prodotto=<id>`,
`?type=powder|capsule|tablet`, `?shape=oval`, `?count=3`, `?p=0.6` per saltare a un punto; forma e
dose di base sono quelle del prodotto in `src/products.js`). Nella console:

- `await __qa()` / `await __qa({ long: true })`: controlli automatici su tutto lo scroll (prodotto
  e pezzi della dose mai sul bicchiere e, posati, dentro lo schermo; etichette nello schermo e
  lontane da prodotto, bicchiere e testi). Uno per pagina caricata: un secondo `__qa` di seguito
  parte con le etichette rimaste accese dal primo;
- `await __sheetUi('foglio.jpg', [0.1, 0.5, 0.9])`: fotogrammi con i testi HTML disegnati sopra;
- `await __shot('nome.jpg', 0.5, { w: 1440, h: 900, layout: 'desktop' })`: un fotogramma.

I file finiscono in `Website/sezione bicchiere/render/shots`.
