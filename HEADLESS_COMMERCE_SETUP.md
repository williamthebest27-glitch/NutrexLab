# Negozio Nutrex Lab collegato a WooCommerce

Il sito (Vercel) mostra prodotti, pagine prodotto e carrello; i dati arrivano dal WooCommerce di
thedoubletwenty, che resta l'unica fonte di prezzi, varianti, magazzino, ordini, clienti, coupon,
spedizioni e IVA. Il pagamento avviene nel checkout di WooCommerce, con i metodi gia' attivi li': l'ordine
e' un normale ordine WooCommerce, quindi email, magazzino e Amazon MCF funzionano come per gli altri ordini.

**Non serve nessuna chiave**: niente chiavi API WooCommerce, niente chiavi Stripe. Il sito legge la
Store API pubblica di WooCommerce (la stessa che usa il carrello di qualunque negozio WooCommerce).

```
sito Nutrex (Vercel)                        WooCommerce di thedoubletwenty
  /acquista, /prodotto/<slug>  --legge-->   Store API: prodotti, prezzi, varianti, disponibilita'
  /carrello, /pagamenti        --carrello-> Store API: carrello del cliente (sessione)
  "Procedi al pagamento"       --porta-->   /?nutrex-checkout=1&items=...  ->  checkout WooCommerce
  /ordine?numero=N             <--torna--   pagina "Ordine ricevuto" (plugin Nutrex Headless)
                                            ordine -> email, magazzino, Amazon MCF
```

## Collegamento (una volta sola)

### 1. Plugin su thedoubletwenty

1. File del plugin: `nutrex-headless.zip` (nella cartella `Website`, accanto a questa cartella del sito).
   Si rifa' comprimendo la cartella `wordpress/nutrex-headless` (lo ZIP deve contenere la cartella
   `nutrex-headless/`).
2. WordPress di thedoubletwenty: **Plugin > Aggiungi nuovo plugin > Carica plugin**, scegli lo ZIP,
   **Installa ora**, poi **Attiva**.

Serve WooCommerce attivo (WordPress 6.4+, PHP 7.4+). Il plugin riguarda solo i prodotti della categoria
Nutrex e gli ordini che li contengono: il resto di thedoubletwenty non cambia.

### 2. Categoria e prodotti in WooCommerce

1. **Prodotti > Categorie**: crea la categoria **Nutrex Lab** con slug `nutrex-lab`. Le sue
   sottocategorie (es. Polvere, Compresse, Capsule) diventano i filtri della pagina Acquista; compaiono
   solo quelle con almeno un prodotto.
2. Ogni prodotto Nutrex va in quella categoria (o in una sua sottocategoria), pubblicato.
3. **Slug del prodotto** = id del prodotto nel sito: cosi' prende i colori del sito e il link
   "Scopri il prodotto in 3D". Un prodotto con un altro slug funziona lo stesso, con i colori del marchio.

   | Prodotto | Slug |
   | --- | --- |
   | Collagene marino (polvere) | `collagene` |
   | Collagene marino compresse | `collagene-marino-compresse` |
   | Collagene bovino | `collagene-bovino` |
   | Bromelina | `bromelina` |
   | Ashwagandha | `ashwagandha` |
   | Coenzima Q10 | `coenzima-q10` |
   | D-Mannosio | `d-mannosio` |
   | Diosmina | `diosmina` |
   | Magnesio bisglicinato | `magnesio` |
   | Vitamina B12 | `vitamina-b12` |
   | Vitamina C | `vitamina-c` |
   | Vitamina D3 + K2 | `vitamina-d3-k2` |

4. Cosa usa il sito di ogni prodotto:

   | In WooCommerce | Sul sito |
   | --- | --- |
   | Nome, prezzo, prezzo in offerta | scheda, pagina prodotto, carrello (con lo sconto in %) |
   | Gestione magazzino / stato | "Disponibile", "Solo N disponibili", "Esaurito", "Su ordinazione" |
   | Immagine prodotto e galleria | foto della scheda e della pagina prodotto |
   | Breve descrizione | testo della scheda e sotto il nome nella pagina prodotto |
   | Descrizione | sezione "Descrizione" della pagina prodotto |
   | Attributi visibili | sezione "Caratteristiche" |
   | Prodotto variabile (es. 1, 2, 3 confezioni) | pulsanti di scelta, con prezzo, SKU e foto di ogni variante |
   | SKU | pagina prodotto; nell'ordine lo usa Amazon MCF |
   | Ordinamento (Prodotti > Ordinamento) | ordine delle schede nella pagina Acquista |
   | Visibilita' catalogo: Nascosto | il prodotto non e' nell'elenco ne' nella sitemap, ma il suo link funziona |

   Le foto dei barattoli (sfondo trasparente) sono in `public/images/prodotti/<slug>.webp`, pronte da
   caricare.
5. I prezzi sul sito sono indicati "IVA inclusa": in **WooCommerce > Impostazioni > IVA**, "Visualizza
   prezzi nel negozio" deve essere "IVA inclusa" (come si fa in Italia per i privati).

### 3. Impostazioni del plugin

**WooCommerce > Impostazioni > Avanzate > Nutrex Lab** (anche dal link "Impostazioni" nell'elenco dei plugin):

| Campo | Valore |
| --- | --- |
| Indirizzo del negozio | l'indirizzo del sito, es. `https://nutrexlab.it` (uguale a `SITE_URL`) |
| Categoria dei prodotti Nutrex | `nutrex-lab` (uguale a `WOOCOMMERCE_CATEGORY`) |
| Mittente delle email degli ordini Nutrex | `Nutrex Lab` (facoltativo) |
| Indirizzo mittente delle email degli ordini Nutrex | lascialo vuoto, a meno che il server di posta del sito possa inviare da quell'indirizzo (altrimenti le email finiscono nello spam) |

### 4. Variabili su Vercel

Progetto `nutrex-collagene-marino` su Vercel > **Settings > Environment Variables** (ambiente Production;
anche Preview se si vogliono provare le anteprime):

| Nome | Valore |
| --- | --- |
| `WOOCOMMERCE_URL` | indirizzo del WordPress di thedoubletwenty, esattamente come in WordPress > Impostazioni > Generali > "Indirizzo sito (URL)", con `https://` e senza barra finale |
| `WOOCOMMERCE_CATEGORY` | `nutrex-lab` |
| `SITE_URL` | `https://nutrexlab.it` (finche' il dominio non e' collegato: `https://nutrex-collagene-marino.vercel.app`) |

Poi **Deployments > Redeploy** dell'ultima pubblicazione: le variabili valgono dalla pubblicazione
successiva. Non sono segrete, ma non vanno scritte nel codice.

Senza `WOOCOMMERCE_URL` o `WOOCOMMERCE_CATEGORY` (o con una categoria che non esiste) il negozio resta
chiuso con il messaggio "Il negozio non e' ancora attivo": il sito non mostra mai i prodotti di
thedoubletwenty.

### 5. Prova

1. `/acquista`: ci sono solo i prodotti Nutrex, con foto e disponibilita'.
2. Pagina di un prodotto: prezzo, varianti, "Aggiungi al carrello".
3. `/carrello`: quantita', coupon, totali.
4. "Procedi al pagamento": si apre il checkout di thedoubletwenty con gli stessi prodotti e lo stesso coupon.
5. Un ordine vero di piccolo importo (poi rimborsato da WooCommerce), con il metodo di pagamento che
   useranno i clienti.
6. Dopo il pagamento si torna su `/ordine` con il numero dell'ordine; il carrello del sito e' vuoto.
7. In WooCommerce: l'ordine con gli SKU giusti; Amazon MCF lo prende in carico come gli altri ordini.

## Cosa vede il cliente

- Acquista, pagine prodotto, carrello e "Grazie" sono sul sito Nutrex. Il checkout e' quello di
  thedoubletwenty, con il suo tema.
- Dopo il pagamento il cliente torna su `nutrexlab.it/ordine`. Con bonifico o assegno, o se il pagamento
  non e' ancora confermato, resta sulla pagina "Ordine ricevuto" di WooCommerce (li' ci sono le istruzioni
  per pagare) con il pulsante "Torna su Nutrex Lab".
- Le email sono quelle di WooCommerce; per gli ordini Nutrex il plugin cambia il mittente e il nome del
  sito nell'oggetto e nel titolo. Logo, colori e pie' di pagina sono quelli impostati in WooCommerce > Impostazioni > Email.
- Chi apre su thedoubletwenty il link di un prodotto Nutrex arriva alla sua pagina sul sito Nutrex (gli
  amministratori vedono ancora la pagina WooCommerce).
- Il checkout mostra condizioni di vendita e privacy di thedoubletwenty (stesso titolare di Nutrex Lab):
  devono valere anche per gli integratori. Sull'estratto conto il cliente vede il nome impostato nel
  metodo di pagamento (Stripe, PayPal...).

## Da sapere

- **Coupon**: si creano in WooCommerce > Marketing > Coupon. Un coupon senza limiti vale su entrambi i
  negozi; per limitarlo a Nutrex: Restrizioni di utilizzo > Categorie prodotto = Nutrex Lab.
- **Prezzi e disponibilita'**: il sito li mostra con al massimo un paio di minuti di ritardo (cache); carrello e
  checkout usano sempre i dati attuali di WooCommerce.
- **Spedizione e IVA**: le calcola WooCommerce nel checkout (zone di spedizione e aliquote come oggi).
- **Amazon MCF**: nessuna modifica. Gli SKU dei prodotti Nutrex devono corrispondere a quelli
  dell'inventario Amazon e i prodotti devono essere abilitati nelle impostazioni del plugin MCF.
- **Store API raggiungibile**: `WOOCOMMERCE_URL/wp-json/wc/store/v1/products?per_page=1` deve rispondere
  con i dati di un prodotto. Plugin di sicurezza o firewall (Wordfence, "Disable REST API", regole
  Cloudflare) non devono bloccare `/wp-json/wc/store/`: le richieste arrivano dai server di Vercel.
- **Cache delle pagine su thedoubletwenty**: il plugin esclude dalla cache il passaggio al checkout. Con
  Cloudflare "Cache Everything" aggiungi una regola di bypass per gli indirizzi con `nutrex-checkout`.
- **Limiti del passaggio al checkout**: fino a 50 righe, 999 pezzi per riga, 5 coupon.

## Problemi comuni

| Cosa succede | Causa probabile |
| --- | --- |
| "Il negozio non e' ancora attivo" | mancano `WOOCOMMERCE_URL` o `WOOCOMMERCE_CATEGORY` su Vercel (o non e' stato fatto il Redeploy), oppure lo slug della categoria non esiste |
| "Il negozio non risponde in questo momento" | la Store API non risponde: indirizzo sbagliato, sito lento o bloccato da un firewall |
| Acquista vuota | prodotti non pubblicati, non nella categoria o nascosti dal catalogo |
| Pagina prodotto "non trovata" | lo slug non esiste o il prodotto non e' nella categoria Nutrex |
| Il checkout di WooCommerce si apre con il carrello vuoto | plugin non attivo, oppure una cache delle pagine o un firewall che toglie i parametri `?nutrex-checkout=...` |
| Dopo il pagamento il cliente resta su WooCommerce | "Indirizzo del negozio" vuoto nel plugin, oppure pagamento con bonifico/assegno o non ancora confermato (voluto: c'e' il pulsante "Torna su Nutrex Lab") |
| Un prezzo cambiato non si vede subito | cache di un paio di minuti: nel carrello e nel checkout e' gia' quello nuovo |

## Sviluppo in locale

Serve un WooCommerce di prova: WordPress Playground lo crea in locale con lo stesso plugin e prodotti
finti (prezzi, magazzino e codici sono inventati). Serve Node 24 (con Node 26 Playground per ora non parte).

Da questa cartella, in PowerShell:

```powershell
mkdir wordpress\sviluppo\out
npx @wp-playground/cli@latest server --port=9400 --php=8.3 --login `
  --blueprint=wordpress/sviluppo/blueprint.json `
  --mount-dir wordpress/nutrex-headless /wordpress/wp-content/plugins/nutrex-headless `
  --mount-dir wordpress/sviluppo/mu-plugins /wordpress/wp-content/mu-plugins `
  --mount-dir wordpress/sviluppo /sviluppo `
  --mount-dir public/images/prodotti /import/prodotti `
  --mount-dir wordpress/sviluppo/out /wp-out
```

(Da Git Bash: stesso comando su una riga, preceduto da `MSYS_NO_PATHCONV=1`.)

Il WooCommerce di prova (http://127.0.0.1:9400, accesso automatico come amministratore) ha: italiano,
euro, IVA 22%, spedizione in Italia, la categoria Nutrex Lab con Polvere/Compresse/Capsule, i 12
prodotti (uno variabile, uno esaurito, uno con pochi pezzi, due in offerta), un prodotto di "un altro
negozio" che il sito non deve mai mostrare, il coupon `PROVA10`, pagamento alla consegna e bonifico di
prova. Le credenziali di prova finiscono in `wordpress/sviluppo/out` (esclusa da git).
`wordpress/sviluppo/mu-plugins` serve solo in locale (database SQLite e http): mai in produzione.

Poi il sito, in un altro terminale (le variabili si passano dal terminale: il sito non legge file `.env`):

```powershell
$env:WOOCOMMERCE_URL='http://127.0.0.1:9400'; $env:WOOCOMMERCE_CATEGORY='nutrex-lab'; $env:SITE_URL='http://127.0.0.1:5173'; npm run dev
```

http://127.0.0.1:5173/acquista. Nel WooCommerce di prova l'indirizzo del negozio e' gia'
`http://127.0.0.1:5173`, quindi dopo il pagamento si torna qui. `npm run build` e `npm run preview`
(porta 4173) provano la build di produzione con le stesse funzioni. `npm test` esegue le prove
automatiche del codice del server (senza WooCommerce).

## Come e' fatto

| Parte | File |
| --- | --- |
| Funzioni Vercel | `api/products.js` (elenco e singolo prodotto), `api/cart.js` (carrello), `api/checkout.js` (indirizzo del checkout), `api/product-page.js` (pagina prodotto con titolo, descrizione e dati strutturati per Google), `api/sitemap.js` |
| Codice del server | `server/`: `woo.js` (Store API), `catalog.js` (prodotti e categoria del negozio), `cart.js`, `checkout.js`, `product-page.js`, `session.js` (cookie del carrello), `http.js`, `errors.js` (messaggi per il cliente), `env.js` (variabili) |
| Indirizzi | `vercel.json`: `/prodotto/<slug>` -> `api/product-page`, `/sitemap.xml` -> `api/sitemap`; in locale lo stesso lo fa `vite.config.js` |
| Browser | `src/shop/` (`api.js`, `cart.js` carrello condiviso tra le schede, `money.js`, `themes.js` colori per slug), `src/pages/` (script delle pagine) |
| Plugin WordPress | `wordpress/nutrex-headless/` |
| WooCommerce di prova | `wordpress/sviluppo/` |
| Prove automatiche | `tests/` (`npm test`) |

Carrello: la sessione della Store API (Cart-Token) sta nel cookie `nx_cart` (httpOnly, 48 ore); il cookie
`nx_count` serve solo al numero sul pulsante del carrello. Cache: prodotti 60 s sul CDN (poi aggiornati in
background), pagina prodotto 120 s, sitemap 1 ora, carrello mai.

Il passaggio al checkout porta a `WOOCOMMERCE_URL/?nutrex-checkout=1&items=<id>:<quantita>,...&coupons=...`:
il plugin svuota il carrello WooCommerce del visitatore, ci mette gli stessi prodotti (solo della
categoria Nutrex) e coupon e apre il checkout. I prezzi non passano dall'indirizzo: li calcola WooCommerce.
