# Nutrex Lab | Collagene Marino (sito)

Landing page con storytelling guidato dallo scroll attorno al barattolo 3D, con il menu dei
prodotti nella hero (cambia barattolo, colori e testi di tutto il sito), piu' il negozio: Acquista,
pagina di ogni prodotto, Carrello, Grazie e Contatti.
Three.js + GSAP/ScrollTrigger/SplitText + Lenis, costruita con Vite.

Il negozio e' collegato al WooCommerce di thedoubletwenty: prodotti, prezzi, varianti, magazzino,
carrello e ordini arrivano da li' e si paga nel checkout di WooCommerce (Amazon MCF compreso).
Collegamento, variabili e plugin: [HEADLESS_COMMERCE_SETUP.md](HEADLESS_COMMERCE_SETUP.md).

Ogni prodotto ha anche un suo link: `?prodotto=<id>` (es. `/?prodotto=vitamina-c`) apre il sito
direttamente su quel prodotto; scegliendo un prodotto dal menu l'indirizzo si aggiorna.

## Avvio in locale

```bash
npm install
npm run dev
```

Apri http://127.0.0.1:5173

Le pagine del negozio mostrano i prodotti solo con l'indirizzo di un WooCommerce nelle variabili
`WOOCOMMERCE_URL` e `WOOCOMMERCE_CATEGORY` (senza: "Il negozio non e' ancora attivo"). Per provarle
in locale c'e' un WooCommerce di prova: vedi "Sviluppo in locale" in
[HEADLESS_COMMERCE_SETUP.md](HEADLESS_COMMERCE_SETUP.md). `npm test` esegue le prove del codice del
server del negozio.

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

Il negozio usa le funzioni di Vercel (`api/`) con le variabili `WOOCOMMERCE_URL`,
`WOOCOMMERCE_CATEGORY` e `SITE_URL` (Settings > Environment Variables del progetto). `npm run build`
produce in `dist/` le pagine; su un hosting solo statico il sito si vede ma il negozio no.
`npm run preview` mostra la build in locale, con le stesse funzioni.

## Dove modificare

| Cosa | File |
| --- | --- |
| Testi di ogni prodotto (hero, sipario, ingredienti, scienza, uso, shop, titolo della pagina) | `src/content.js` |
| SEO: titoli e descrizioni per Google, categorie, domande frequenti, sezione "La linea" della homepage, dati dell'azienda | `src/seo/catalog.js` (dati) + `src/seo/pages.js` (pagine); vedi "SEO" qui sotto |
| Struttura delle sezioni della homepage | `index.html` |
| Navbar, menu mobile, piè di pagina (uguali in tutte le pagine) | `src/partials/` (`nav.html`, `mnav.html`, `footer.html`, `head.html`) |
| Prodotti, prezzi, offerte, varianti, magazzino, foto, descrizioni, coupon, spedizioni, IVA | nel pannello di WooCommerce (vedi [HEADLESS_COMMERCE_SETUP.md](HEADLESS_COMMERCE_SETUP.md)) |
| Recapiti della pagina Contatti | `src/shop/config.js` (`null` = non mostrato) |
| Foto dei barattoli da caricare in WooCommerce | `public/images/prodotti/<id>.webp`: si rifanno da `/tools/foto-prodotti.html` (con `npm run dev`) |
| Pagine del negozio | `integratori.html` (+ categorie in `integratori/`), `prodotto.html`, `carrello.html`, `ordine.html`, `contatti.html` + `src/pages/` + `src/styles/pages.css` |
| Collegamento a WooCommerce (catalogo, carrello, checkout, pagina prodotto per Google) | `api/` + `server/` |
| Plugin da installare su WooCommerce | `wordpress/nutrex-headless/` |
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
- `src/ui/mobileMenu.js` mobile: menu hamburger accanto ad "Acquista ora" (pannello a tutto schermo
  con le pagine e il logo, apertura e chiusura animate)
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
- `src/ui/navMenu.js` pagina corrente nel menu e sottomenu di Acquista (Negozio, Carrello)
- `src/shop/` negozio nel browser: `api.js` (chiamate alle funzioni del negozio), `cart.js` (carrello
  di WooCommerce, uguale in tutte le pagine e le schede), `money.js` (prezzi), `themes.js` (colori del
  sito per ogni prodotto, dallo slug), `config.js` (recapiti)
- `api/` + `server/` funzioni Vercel del negozio: catalogo, carrello e passaggio al checkout con la
  Store API di WooCommerce, pagina prodotto preparata per Google, sitemap
- `wordpress/` plugin Nutrex Headless (va installato su WooCommerce) e WooCommerce di prova per lo sviluppo
- `tests/` prove del codice del server con un WooCommerce finto (`npm test`)
- `src/pages/` script delle pagine del negozio; `common.js` e' la struttura comune (navbar, menu
  mobile, footer, scroll morbido, testi che salgono come nella homepage)
- `src/partials/` parti HTML comuni, inserite da `vite.config.js` al posto di `<!-- @nome -->`
- `tools/foto-prodotti.html` strumento di sviluppo (non pubblicato) per rifare le foto dei barattoli

Rispetta `prefers-reduced-motion`: niente smooth scroll e animazioni ridotte (il cambio prodotto
diventa una dissolvenza).

## Menu e pagine

Navbar e piè di pagina sono gli stessi in tutte le pagine (`src/partials/`): Homepage, Acquista
(con il sottomenu Negozio / Carrello e il numero dei prodotti nel carrello), Contatti; "Acquista
ora" porta al negozio e il pulsante rotondo accanto (desktop) all'area clienti. Su mobile il menu
hamburger ha le cinque pagine (Homepage, Acquista, Carrello, Contatti, Account) con il numero dei
prodotti accanto a Carrello.

| Pagina | Indirizzo | Cosa fa |
| --- | --- | --- |
| Homepage | `/` | il racconto 3D; il pulsante finale ("Acquista il collagene") apre la pagina del prodotto mostrato |
| Acquista | `/integratori` (`/acquista` ci porta) | i prodotti Nutrex di WooCommerce (nell'ordinamento del pannello), 4 per riga su desktop, senza prezzo; filtri dalle sottocategorie; "Scopri" apre la pagina del prodotto; domande frequenti |
| Categorie | `/integratori/collagene`, `/integratori/vitamine-e-minerali`, `/integratori/estratti-vegetali` | i prodotti della categoria, testi e domande frequenti (`src/seo/catalog.js`) |
| Chi siamo | `/chi-siamo` | il marchio, la linea, l'azienda (solo dati veri) |
| Prodotto | `/prodotto/<slug>` | foto, prezzo (offerta barrata), disponibilita', varianti, quantita', "Aggiungi al carrello", offerte quantita' (le stesse di WooCommerce), metodi di pagamento, descrizione e caratteristiche, recensioni (lettura e invio) e prodotti correlati; titolo e dati strutturati per Google preparati sul server |
| Carrello | `/carrello` | quantita', rimozione, coupon, totali calcolati da WooCommerce, "Procedi al pagamento" (porta dritto al pagamento sicuro di WooCommerce); vuoto: invito al negozio. `/pagamenti` (la vecchia pagina di riepilogo, tolta) porta qui |
| Grazie | `/ordine?numero=N` | dopo il pagamento: numero dell'ordine WooCommerce; svuota il carrello del sito |
| Contatti | `/contatti` | recapiti e modulo che invia il messaggio a info@nutrexlab.it (`/api/contatto` -> plugin su WooCommerce) |
| Account | `/account` | porta all'area clienti Nutrex sul WooCommerce (`/account-nutrex-lab/`, cornice Nutrex): accesso, registrazione, ordini Nutrex, indirizzi, sconto del 5% sul primo ordine, invita un amico; `?ref=` porta con se' l'invito, `?torna=carrello` riporta al carrello |

Gli indirizzi sono senza `.html` (`cleanUrls` in `vercel.json`; in locale li gestisce Vite).
Il carrello e' quello di WooCommerce (sessione nel cookie `nx_cart`): lo stesso in tutte le pagine e
le schede aperte, con prezzi e disponibilita' sempre aggiornati.

I recapiti della pagina Contatti stanno in `src/shop/config.js` (email, telefono, WhatsApp, sede,
orari, social; quelli `null` non compaiono). Li' stanno anche le offerte quantita' mostrate nella pagina
prodotto (`quantityOffers`: le stesse impostate su WooCommerce, che le applica nel carrello) e i metodi di
pagamento mostrati (`payments`). Tutto il resto del negozio si gestisce in WooCommerce.

Pagina nuova: un file HTML accanto a `index.html` con `<!-- @head -->`, `<!-- @nav -->`,
`<!-- @mnav -->` e `<!-- @footer -->`, uno script in `src/pages/` che chiama `initPage()` e la voce
in `vite.config.js` (`build.rolldownOptions.input`), altrimenti `npm run build` la ignora.

## SEO

Tutto in `src/seo/` (una sola fonte per build, server e browser): `catalog.js` (dominio, azienda,
prodotti con titolo/descrizione/FAQ, categorie), `pages.js` (`<head>` di ogni pagina statica: nel file HTML
`<!-- seo:chiave -->`), `schema.js` (dati strutturati), `build.js` (griglie gia' pronte, categorie, sezione
"La linea" della homepage). La pagina prodotto la prepara il server (`server/product-page.js`), la sitemap
`api/sitemap.js`, `public/robots.txt`. Canonical e indirizzi sempre su `https://www.nutrexlab.it`.

Sincronizzazione con WooCommerce: prezzi, offerte, disponibilita', varianti, SKU, foto, nomi e descrizioni
arrivano da WooCommerce e si aggiornano da soli (un paio di minuti di cache; carrello e pagamento sempre
esatti). Un prodotto nuovo pubblicato nella categoria Nutrex Lab ha subito la sua pagina, e' nella pagina
Integratori, nella sitemap e nei dati per Google; per farlo entrare in una categoria del sito mettilo in
WooCommerce in una sottocategoria di Nutrex Lab con slug `collagene`, `vitamine-e-minerali` o
`estratti-vegetali`. Solo titolo per Google, FAQ e la riga nella sezione "La linea" della homepage si
aggiungono a mano in `src/seo/catalog.js` (e il barattolo 3D come in "Aggiungere un prodotto al menu").

Mai usare le classi `line` e `char` in CSS: sono le righe e le lettere create da SplitText per le
animazioni dei titoli (`src/ui/text.js`).

## Fluidita' (cose da sapere prima di modificare)

- Sezione del bicchiere: dura 2.4 schermate di scroll (`data-steps` in `index.html`; prima 4).
  Si prepara in anticipo dopo l'intro (`ritual.preload()` in `main.js`),
  a piccoli passi e solo quando nessuno sta scorrendo (`calmMoment`). Gli shader si compilano in
  parallelo con il render target giusto (`ProductScene.warmup`): compilarli "per lo schermo"
  faceva ricompilare tutto al primo fotogramma e fermava la pagina per 2-4 secondi.
  Nessun passo deve superare qualche ms: i ~30.000 granelli della polvere si calcolano in un worker
  (`powderPour.js`), i ScrollTrigger della sezione si creano una volta sola (ricostruire le timeline
  non li tocca: ricrearli rimetteva il pin e rimisurava la pagina), gli shader si preparano una
  passata per fotogramma e la GPU si "scalda" uno strato per fotogramma (`ProductScene.primeSteps`).
- Colori della pagina durante lo scroll (`buildMaster` in `choreography.js`): il fondo sfuma sul
  body e sul velo della navbar (`.nav__bg`), le variabili della radice (`--bg`, `--fg`, `--accent`)
  cambiano solo quando cambia il colore dei testi (2 volte), a meta' passaggio. Ogni modifica di
  una variabile sulla radice fa ricalcolare lo stile di tutta la pagina (~10 ms su un computer,
  60-100 ms su un telefono): mai a ogni fotogramma. Navbar e menu prodotti leggono il fondo del
  momento da `--page-bg`. In home `--bg` sulla radice non e' il fondo che si vede: per il colore
  attuale leggere `getComputedStyle(document.body).backgroundColor`.
- Niente animazioni continue sul thread della pagina: la scritta del sigillo Made in Italy gira come
  livello a parte (trasformazione CSS, la fa la scheda grafica) e solo quando il sigillo e' sullo
  schermo. Ruotare un gruppo dentro un SVG ridisegnava il sigillo a ogni fotogramma, anche fuori
  schermo: ~4 ms a fotogramma su un telefono, in tutta la pagina.
- Shader del vetro (`shaders/glass.js`): i rami seguono solo la geometria del raggio, sfondo e
  ambiente si leggono una volta alla fine. Su Windows il compilatore DirectX espande ogni chiamata:
  non rimettere `pe_env` / `pe_seen` dentro i rami, e dentro i rami usare `textureLod`.
- Timeline guidata dallo scroll (`rebuildMaster`): va ricostruita con `revert()`, non `kill()`,
  altrimenti dopo un cambio prodotto o un resize a pagina scesa i titoli della hero non tornano.
