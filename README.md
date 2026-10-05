# Nutrex Lab | Collagene Marino (sito)

Landing page con storytelling guidato dallo scroll attorno al barattolo 3D, con il menu dei
prodotti nella hero (cambia barattolo, colori e testi di tutto il sito).
Three.js + GSAP/ScrollTrigger/SplitText + Lenis, costruita con Vite.

Ogni prodotto ha anche un suo link: `?prodotto=<id>` (es. `/?prodotto=vitamina-c`) apre il sito
direttamente su quel prodotto; scegliendo un prodotto dal menu l'indirizzo si aggiorna.

## Avvio in locale

```bash
npm install
npm run dev
```

Apri http://127.0.0.1:5173

## Pubblicazione

Online su Vercel: https://nutrex-collagene-marino.vercel.app (progetto `nutrex-collagene-marino`).
Codice su GitHub: https://github.com/williamthebest27-glitch/NutrexLab (questa cartella e' la radice
del repository). Vercel e' collegato al repository: ogni push sul ramo `main` pubblica da solo il
sito in produzione, gli altri rami creano un'anteprima.

```bash
git add -A
git commit -m "Descrizione della modifica"
git push
```

Per pubblicare senza passare da GitHub resta `vercel deploy --prod`.

Vercel esegue da solo `npm run build` (impostazioni in `vercel.json`); i modelli 3D sono gia' in
`public/models`, quindi sul server non servono le cartelle di Blender (dopo averli rigenerati,
`npm run dev` o `npm run build` in locale li copia in `public/models`: vanno poi committati).

In alternativa `npm run build` produce in `dist/` un sito statico adatto a qualsiasi hosting.
`npm run preview` mostra la build in locale.

## Dove modificare

| Cosa | File |
| --- | --- |
| Testi di ogni prodotto (hero, sipario, ingredienti, scienza, uso, shop, titolo della pagina) | `src/content.js` |
| Link (es. il vero URL dello shop al posto di `#shop`) e struttura delle sezioni | `index.html` |
| Movimenti del barattolo, camera e luci per ogni scena | `src/choreography.js` (keyframe per desktop e mobile) |
| Prodotti del menu (nome, modello 3D, colori, misura nella hero, punti dell'etichetta) | `src/products.js` |
| Impaginazione della hero e delle scene | `src/styles/sections.css` |
| Modelli 3D | rigenera con il `barattolo_3d.py` di ogni prodotto; `scripts/sync-model.mjs` li copia in `public/models` da `npm run dev`/`build` e scrive in `src/model-versions.json` la versione di ogni file (l'indirizzo `/models/<id>.glb?v=...` cambia solo quando cambia il barattolo, cosi' nessun browser mostra un modello vecchio rimasto in cache) |
| Versione compressa di un modello | nel prodotto in `src/products.js` usa il file `*_draco.glb` |
| Sezione del bicchiere ("Preparazione", tra Scienza e Ogni giorno): animazione di ogni prodotto | `form` nel prodotto in `src/products.js`: `powder` (misurino e polvere nell'acqua), `capsule` o `tablet` (il prodotto ruota accanto al bicchiere, non ci entra mai) |
| Testi della sezione del bicchiere | dosi ed etichette arrivano da `src/content.js` (`daily.facts`, `pins`); testi propri del prodotto in `experience` (`titleA`, `titleB`, `eyebrow`, `pins`), altrimenti quelli di `src/components/ProductExperience/copy.js` |
| Modelli, immagini statiche e banco di prova della sezione del bicchiere | `src/components/ProductExperience/README.md` |

## Aggiungere un prodotto al menu

1. Esporta il barattolo da Blender con il suo `barattolo_3d.py` (cartella `prodotti/<nome>/web`).
2. Aggiungi la riga del file in `scripts/sync-model.mjs` (es. `['../../prodotti/Nome/web/barattolo.glb', 'nome.glb']`).
3. Aggiungi la voce in `src/products.js`: nome, modello e tema colori ricavato dall'etichetta
   (si puo' partire copiando il tema della Bromelina). `heroScale` ingrandisce nella hero un barattolo
   piu' piccolo degli altri. In `geo` vanno le misure del flacone e i punti della grafica
   dell'etichetta (coordinate 0..1 sull'`etichetta_hd.png`): `dose` e `gmp` per i due dettagli della
   scena 5b, `table` per la tabella nutrizionale.
4. Aggiungi i testi in `src/content.js` con la stessa chiave (`id`) del prodotto. Le indicazioni sulla
   salute vanno prese dall'etichetta o dal Reg. UE 432/2012 (nutrienti almeno al 15% del VNR).
5. Sezione del bicchiere: scegli `form` nel prodotto e rigenera le immagini statiche con i suoi
   colori (`npm run sandbox` in `Website/sezione bicchiere`, poi `await __postersAll()` nella console).

Al click sul menu il barattolo attuale accelera ruotando, al massimo della velocita' viene sostituito
e il nuovo rallenta fino a fermarsi di fronte; intanto tutti i colori del sito (raso, nastro, gocce,
polvere, particelle, fondi delle scene, testi) sfumano verso il tema del nuovo prodotto.
Anche i testi cambiano (le righe della hero escono e rientrano) e le scene con i dettagli
agganciati al barattolo (tappo, etichetta, tabella nutrizionale) si orientano sulla grafica del
nuovo prodotto. Le linee dalla lista degli ingredienti alla tabella restano solo sul collagene,
su cui sono tarate.

Il menu prodotti resta sempre a portata di mano:
- desktop: nella hero e' la scheda a destra; appena si scorre si chiude nel pulsante PRODOTTI in alto
  a destra (accanto ad "Acquista ora"), che apre la stessa lista come tendina;
- mobile: il pulsante PRODOTTI sta sotto "Acquista ora" nella hero e, scorrendo, scende in basso a
  destra (la tendina si apre verso l'alto). Sempre su mobile gli ingredienti stanno in una scheda
  chiara, ben leggibile.

Sotto PURO. SEMPLICE. EFFICACE. c'e' la certificazione Made in Italy con la bandiera (`index.html`,
uguale per tutti i prodotti).

## Struttura

- `src/main.js` avvio: caricamento, intro, smooth scroll, navigazione, cambio prodotto
- `src/products.js` + `src/theme.js` linea prodotti e temi colore (custom properties che sfumano)
- `src/content.js` + `src/ui/copy.js` testi di ogni prodotto e loro inserimento nella pagina
- `src/ui/productMenu.js` menu prodotti della hero (pannello su desktop, tendina su mobile)
- `src/ui/menuMorph.js` desktop: la scheda dei prodotti si richiude nel pulsante PRODOTTI scorrendo
  (esagoni che volano nel pulsante, pannello che diventa pillola) e si riapre tornando in cima
- `src/webgl/SwitchBurst.js` esplosione di particelle colorate attorno al nuovo barattolo quando si
  cambia prodotto nella hero (desktop e mobile; sul mobile con meno particelle)
- `src/webgl/Stage.js` scena 3D, un barattolo per prodotto, luci da studio, ombra, dissolvenza
- `src/webgl/Particles.js` particelle campionate dal barattolo che formano la tripla elica
- `src/webgl/HeroFX.js` + `Silk.js` nastro, gocce, polvere e raso della hero (colori dal tema)
- `src/webgl/Track.js` interpolazione continua tra le pose dello scroll
- `src/ui/*` testi (SplitText), bottoni magnetici, elementi agganciati al 3D
- `src/ui/logo.js` + `logo-paths.js` logo vettoriale (estratto dal PDF) e la sua animazione di composizione
- `src/components/ProductExperience/` sezione 3D del bicchiere: componente riutilizzabile (anche
  in React), con il suo README

Rispetta `prefers-reduced-motion`: niente smooth scroll e animazioni ridotte (il cambio prodotto
diventa una dissolvenza).

## Menu e pagine

Menu in alto e piè di pagina: Homepage (in questa pagina riporta alla hero), Acquista, Contatti.
Contatti punta a `/contatti`: la pagina va ancora creata. Con Vite ogni pagina in piu' e' un file
HTML (es. `contatti.html` accanto a `index.html`) da aggiungere in `vite.config.js`
(`build.rollupOptions.input`), altrimenti `npm run build` la ignora.

## Fluidita' (cose da sapere prima di modificare)

- Sezione del bicchiere: si prepara in anticipo dopo l'intro (`ritual.preload()` in `main.js`),
  a piccoli passi e solo quando nessuno sta scorrendo (`calmMoment`). Gli shader si compilano in
  parallelo con il render target giusto (`ProductScene.warmup`): compilarli "per lo schermo"
  faceva ricompilare tutto al primo fotogramma e fermava la pagina per 2-4 secondi.
- Shader del vetro (`shaders/glass.js`): i rami seguono solo la geometria del raggio, sfondo e
  ambiente si leggono una volta alla fine. Su Windows il compilatore DirectX espande ogni chiamata:
  non rimettere `pe_env` / `pe_seen` dentro i rami, e dentro i rami usare `textureLod`.
- Timeline guidata dallo scroll (`rebuildMaster`): va ricostruita con `revert()`, non `kill()`,
  altrimenti dopo un cambio prodotto o un resize a pagina scesa i titoli della hero non tornano.
