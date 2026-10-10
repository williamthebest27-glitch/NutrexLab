# Negozio Nutrex Lab collegato a WooCommerce

Il sito (Vercel) mostra prodotti, pagine prodotto e carrello; i dati arrivano dal WooCommerce di
thedoubletwenty, che resta l'unica fonte di prezzi, varianti, magazzino, ordini, clienti, coupon,
spedizioni e IVA. Il pagamento avviene su una pagina di pagamento solo per Nutrex Lab, creata dal plugin su
quel WooCommerce, con gli stessi metodi di pagamento, spedizioni e sconti: l'ordine e' un normale ordine
WooCommerce, quindi magazzino e Amazon MCF funzionano come per gli altri ordini. I due negozi restano
separati: pagine, carrelli, ordini ed email non si mescolano (vedi "Cosa vede il cliente").

**Non serve nessuna chiave**: niente chiavi API WooCommerce, niente chiavi Stripe. Il sito legge la
Store API pubblica di WooCommerce (la stessa che usa il carrello di qualunque negozio WooCommerce).

```
sito Nutrex (Vercel)                        WooCommerce di thedoubletwenty
  /integratori, /prodotto/<slug> -legge->    Store API: prodotti, prezzi, varianti, disponibilita'
  /carrello                    --carrello-> Store API: carrello del cliente (sessione)
  "Procedi al pagamento"       --porta-->   /?nutrex-checkout=1&items=...  ->  pagina di pagamento Nutrex
  /ordine?numero=N             <--torna--   pagina "Ordine ricevuto" (plugin Nutrex Headless)
  /contatti, recensioni        --invia-->   plugin: email a info@nutrexlab.it, recensioni WooCommerce
                                            ordine -> email, magazzino, Amazon MCF
```

## Collegamento (una volta sola)

### 1. Plugin su thedoubletwenty

1. File del plugin: `nutrex-headless.zip` (nella cartella `Website`, accanto a questa cartella del sito).
   Si rifa' comprimendo la cartella `wordpress/nutrex-headless` (lo ZIP deve contenere la cartella
   `nutrex-headless/`).
2. WordPress di thedoubletwenty: **Plugin > Aggiungi nuovo plugin > Carica plugin**, scegli lo ZIP,
   **Installa ora**, poi **Attiva**. Per aggiornarlo si carica allo stesso modo lo ZIP nuovo e si sceglie
   **Sostituisci la versione attuale con quella caricata** (le impostazioni restano).

Serve WooCommerce attivo (WordPress 6.4+, PHP 7.4+). Il plugin riguarda solo i prodotti della categoria
Nutrex e gli ordini che li contengono: il resto di thedoubletwenty non cambia.

### 2. Categoria e prodotti in WooCommerce

1. **Prodotti > Categorie**: crea la categoria **Nutrex Lab** con slug `nutrex-lab`. Le sue
   sottocategorie (es. Polvere, Compresse, Capsule) diventano i filtri della pagina Acquista; compaiono
   solo quelle con almeno un prodotto. Le sottocategorie con slug `collagene`, `vitamine-e-minerali` o
   `estratti-vegetali` portano i prodotti (anche quelli nuovi) nelle pagine categoria del sito
   (`/integratori/<slug>`).
2. **I 12 prodotti in un colpo solo**: **Prodotti > Importa**, scegli `nutrex-prodotti-woocommerce.csv`
   (nella cartella `Website`), **Continua**; nella pagina dopo la colonna "Slug" deve essere abbinata a
   "Slug" (lo fa il plugin, dalla versione 2.1), poi **Esegui l'importazione**. Le foto si scaricano
   durante l'importazione: ci vuole qualche minuto.
   - Il file ha nome, slug, categoria, descrizione breve e lunga (testi del sito e del negozio Amazon,
     valori per dose, ingredienti, avvertenze), caratteristiche, peso e misure, la foto del barattolo
     come immagine principale e le foto di Amazon nella galleria, l'ASIN (campo `amazon_asin`).
   - I prodotti arrivano **in bozza**, senza prezzo e senza SKU: aggiungi a ognuno il **prezzo** e lo
     **SKU di Seller Central** (serve ad Amazon MCF), controlla descrizione e avvertenze con
     l'etichetta, poi pubblicali (anche tutti insieme: seleziona, **Modifica**, Stato **Pubblicato**).
   - Il D-Mannosio non e' su Amazon: nel file ha solo la foto del barattolo e i testi del sito.
3. Ogni prodotto Nutrex va in quella categoria (o in una sua sottocategoria), pubblicato.
4. **Slug del prodotto** = id del prodotto nel sito: cosi' prende i colori del sito e il link
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

5. Cosa usa il sito di ogni prodotto:

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

   Le foto dei barattoli (sfondo trasparente) sono in `public/images/prodotti/<slug>.webp` (online su
   `/images/prodotti/<slug>.webp`).
6. I prezzi sul sito sono indicati "IVA inclusa": in **WooCommerce > Impostazioni > IVA**, "Visualizza
   prezzi nel negozio" deve essere "IVA inclusa" (come si fa in Italia per i privati). L'aliquota degli
   integratori puo' essere diversa da quella dei cuscini: si imposta con la "Classe di imposta" del prodotto.

### 3. Impostazioni del plugin

**WooCommerce > Impostazioni > Avanzate > Nutrex Lab** (anche dal link "Impostazioni" nell'elenco dei plugin):

| Campo | Valore |
| --- | --- |
| Indirizzo del negozio | `https://www.nutrexlab.it` (solo il dominio; uguale a `SITE_URL`) |
| Categoria dei prodotti Nutrex | `nutrex-lab` (uguale a `WOOCOMMERCE_CATEGORY`) |
| Pagina di pagamento Nutrex | la crea il plugin (`/pagamento-nutrex-lab/`): e' il checkout dei clienti Nutrex, non va modificata ne' cancellata (se manca, il plugin la ricrea) |
| Area clienti Nutrex | la crea il plugin (`/account-nutrex-lab/`, su nutrexlab.it e' `/account`): accesso, registrazione, ordini Nutrex, indirizzi, sconto primo ordine, invita un amico. Non va modificata ne' cancellata |

Sezione **Email di Nutrex Lab** (stessa pagina): le email degli ordini Nutrex e i messaggi del modulo
contatti partono dalla casella `info@nutrexlab.it` attraverso il suo server di posta, firmate dal dominio
nutrexlab.it (niente spam).

| Campo | Valore |
| --- | --- |
| Casella email | `info@nutrexlab.it` |
| Password della casella | la password di info@nutrexlab.it (salvata cifrata; campo vuoto = non cambia) |
| Server di posta (SMTP), Sicurezza e porta | `mailserver5.vhosting-it.com`, STARTTLS porta 587 (gia' impostati) |
| Messaggi del modulo contatti a | dove arrivano i messaggi di `/contatti` (vuoto = la casella) |
| Notifiche degli ordini Nutrex a | dove arrivano "Nuovo ordine", ordini annullati o non riusciti e avvisi di magazzino dei prodotti Nutrex (vuoto = la casella dei messaggi) |
| Nome del mittente, Indirizzo mittente diverso | di solito vuoti ("Nutrex Lab", la casella) |
| Stato | dopo aver salvato: "Invia un'email di prova", deve arrivare a info@nutrexlab.it. Senza password le email Nutrex partono con il mittente normale di thedoubletwenty (rischio spam) e qui compare l'ultimo errore |

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

1. `/integratori` (prima `/acquista`, che ci porta): ci sono solo i prodotti Nutrex, con foto e disponibilita'.
2. Pagina di un prodotto: prezzo, varianti, "Aggiungi al carrello".
3. `/carrello`: quantita', coupon, totali.
4. "Procedi al pagamento": si apre la pagina di pagamento Nutrex (`thedoubletwenty.it/pagamento-nutrex-lab/`)
   con gli stessi prodotti e lo stesso coupon, senza menu, pie' di pagina e passaggi di thedoubletwenty.
5. Un ordine vero di piccolo importo (poi rimborsato da WooCommerce), con il metodo di pagamento che
   useranno i clienti.
6. Dopo il pagamento si torna su `/ordine` con il numero dell'ordine; il carrello del sito e' vuoto.
7. In WooCommerce: l'ordine con gli SKU giusti; Amazon MCF lo prende in carico come gli altri ordini.
8. Carrello e checkout di thedoubletwenty sono quelli di sempre, anche nello stesso browser dopo la prova.

## Cosa vede il cliente

- Acquista, pagine prodotto, carrello e "Grazie" sono sul sito Nutrex. Il pagamento e' su una pagina
  dedicata del WooCommerce di thedoubletwenty (`/pagamento-nutrex-lab/`, creata dal plugin), con logo,
  colori e caratteri di Nutrex Lab e titolo "Pagamento sicuro | Nutrex Lab", senza menu, pie' di pagina,
  passaggi e stili di thedoubletwenty; i link a carrello, negozio, termini e privacy portano alle pagine
  di nutrexlab.it. Resta l'indirizzo thedoubletwenty.it nella barra del browser.
- Pagine, carrello e checkout di thedoubletwenty non cambiano: i prodotti Nutrex non ci compaiono e non si
  possono comprare da li' (le loro pagine e categorie portano a nutrexlab.it), e un carrello non contiene
  mai prodotti dei due negozi insieme. Se un visitatore di thedoubletwenty passa al pagamento Nutrex, il suo
  carrello di thedoubletwenty viene messo da parte e torna com'era alla prima pagina di thedoubletwenty.
- Dopo il pagamento il cliente torna su `nutrexlab.it/ordine`. Con bonifico o assegno, o se il pagamento
  non e' ancora confermato, resta sulla pagina "Ordine ricevuto" (anche questa con l'aspetto Nutrex), con
  le istruzioni per pagare e il pulsante "Torna su Nutrex Lab".
- Le email degli ordini Nutrex partono da "Nutrex Lab" <info@nutrexlab.it> con il design di Nutrex Lab
  (logo, riepilogo con le foto dei prodotti, indirizzi, riquadro di aiuto, dati dell'azienda); le notifiche
  di ordini e magazzino Nutrex arrivano a info@nutrexlab.it. Senza la password della casella nelle
  impostazioni partono con il mittente di thedoubletwenty.
- Chi apre su thedoubletwenty il link di un prodotto Nutrex arriva alla sua pagina sul sito Nutrex (gli
  amministratori vedono ancora la pagina WooCommerce). Dal plugin 2.3.2 il passaggio e' permanente (301):
  per Google la pagina del prodotto e' quella di nutrexlab.it. Le categorie Nutrex portano a `/integratori`.
- Sull'estratto conto, e nelle finestre di Apple Pay e Google Pay, il cliente vede il nome impostato nel
  metodo di pagamento (Stripe, PayPal...): e' lo stesso conto di thedoubletwenty (stesso titolare).
- Chi ha un account lo usa dall'area clienti Nutrex (`/account` su nutrexlab.it); al pagamento chi non ha fatto
  l'accesso vede il promemoria "Registrati e risparmi un ulteriore 5% sul primo ordine" e il link "Accedi",
  che riportano al pagamento.
- Pagamento, "Ordine ricevuto" e area clienti sono nella lingua scelta sul sito (italiano, inglese, francese,
  tedesco, spagnolo); in alto c'e' la stessa scelta della lingua del sito (bandiera e tendina). Vedi "Lingue".

## Da sapere

- **Lingue** (plugin 2.4): "Procedi al pagamento" e i link del sito a `/account` portano la lingua del sito
  (`nutrex_lang=de` nell'indirizzo di thedoubletwenty); da li' resta nel cookie `nutrex_lang` di thedoubletwenty
  e in alto nella pagina si cambia con la bandiera. Solo le pagine Nutrex (pagamento, "Ordine ricevuto", "Paga
  l'ordine", area clienti) e le richieste che fanno cambiano lingua: il resto di thedoubletwenty e la bacheca
  restano in italiano. I link verso nutrexlab.it (carrello, "Torna su Nutrex Lab", termini, privacy, `/ordine`
  dopo il pagamento) portano `?lang=`, cosi' il sito resta nella stessa lingua.
  - Testi di WooCommerce, dei metodi di pagamento e di WordPress (campi, spedizione, "Effettua ordine",
    ordini, indirizzi...): arrivano dai loro **pacchetti di lingua**, che devono essere installati su
    thedoubletwenty per inglese (en_GB; senza, l'inglese di base), francese (fr_FR), tedesco (de_DE) e spagnolo
    (es_ES): Impostazioni > Generali > Lingua del sito, scegli la lingua e salva (il pacchetto si scarica), poi
    rimetti Italiano e salva; infine Bacheca > Aggiornamenti > "Aggiorna le traduzioni" scarica quelli di
    WooCommerce e dei plugin. Senza pacchetto quei testi si vedono in inglese.
  - Testi del plugin (titoli, promemoria del 5%, registrazione, area "invita un amico", errori):
    `wordpress/nutrex-headless/lang/<lingua>.json`, la chiave e' il testo italiano (`npm test` controlla che
    ogni testo abbia la traduzione in tutte le lingue, con gli stessi segnaposto).
  - Restano come scritti nel pannello di WooCommerce (quindi in italiano) i nomi dati a mano a metodi di
    pagamento e spedizioni (es. "Bonifico bancario", "Spedizione gratuita").
  - Le **email** restano in italiano come prima (anche quelle partite durante un pagamento in un'altra lingua):
    i testi delle email Nutrex sono in italiano e un'email non mescola mai due lingue.
- **Coupon**: si creano in WooCommerce > Marketing > Coupon. Un coupon senza limiti vale su entrambi i
  negozi; per limitarlo a Nutrex: Restrizioni di utilizzo > Categorie prodotto = Nutrex Lab.
- **Offerte quantita'** (2 pezzi -5%, 4 pezzi -10%, 10 pezzi -15%): le applica WooCommerce nel carrello
  contando il totale dei pezzi, anche di prodotti diversi, come su thedoubletwenty. Il sito le mostra nella
  pagina prodotto da `src/shop/config.js` (`quantityOffers`): se cambiano su WooCommerce vanno cambiate
  anche li'. Stessa cosa per i metodi di pagamento mostrati (`payments`).
- **Recensioni**: la pagina prodotto mostra quelle approvate in WooCommerce e permette di scriverne (plugin,
  `nutrex/v1/recensione`) con le stesse regole di WooCommerce (voto obbligatorio, solo chi ha acquistato,
  moderazione): si approvano in WordPress > Commenti come le altre.
- **Modulo contatti**: i messaggi di `/contatti` arrivano a info@nutrexlab.it (plugin, `nutrex/v1/contatto`)
  con "Rispondi a" = chi ha scritto; al massimo 5 messaggi l'ora per indirizzo IP, 60 l'ora in tutto.
- **Area clienti** (`/account-nutrex-lab/`, da nutrexlab.it `/account`): le stesse funzioni dell'area clienti
  di thedoubletwenty ma separate. Registrazione con nome, cognome, email, password e conferma, codice amico,
  privacy; **5% sul primo ordine Nutrex** di chi si registra (codice virtuale `membri-nutrex`, entra da solo al
  pagamento di chi ha fatto l'accesso, vale finche' non c'e' un ordine Nutrex pagato, in attesa di bonifico,
  completato o rimborsato fatto dopo la registrazione); **invita un amico**: codice `NX-XXXXX` e link personale
  `nutrexlab.it/account?ref=NX-XXXXX`; per ogni amico che si registra chi l'ha invitato riceve subito un bonus del
  5%, un codice monouso `nutrex-bonus-...` valido solo sui prodotti Nutrex, uno per ordine (gli altri restano).
  Non vale se l'amico ha l'email di chi invita (anche con +etichetta o i punti di Gmail) o era gia' cliente
  Nutrex. L'account (email e password) e' uno solo per i due negozi: e' lo stesso WordPress. Ma l'area Nutrex
  mostra solo gli ordini Nutrex e quella di thedoubletwenty non mostra gli ordini Nutrex; lo sconto membri e i
  bonus di thedoubletwenty non valgono sui carrelli Nutrex e viceversa. Le email di account (benvenuto, nuova
  password) dei clienti registrati da Nutrex Lab hanno il design Nutrex e portano all'area Nutrex. In bacheca:
  WooCommerce > Nutrex Lab: inviti.
- **Prezzi e disponibilita'**: il sito li mostra dopo pochi secondi (al massimo un minuto); carrello e
  checkout usano sempre i dati attuali di WooCommerce. La pagina prodotto mostra i pezzi in magazzino se in
  WooCommerce > Impostazioni > Prodotti > Magazzino il formato di visualizzazione delle scorte e' "Mostra sempre".
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
| "Procedi al pagamento" riporta al carrello di nutrexlab.it | plugin non attivo o categoria non impostata, oppure una cache delle pagine o un firewall che toglie i parametri `?nutrex-checkout=...` |
| Dopo il pagamento il cliente resta su WooCommerce | "Indirizzo del negozio" vuoto nel plugin, oppure pagamento con bonifico/assegno o non ancora confermato (voluto: c'e' il pulsante "Torna su Nutrex Lab") |
| La pagina di pagamento Nutrex mostra menu, pie' di pagina o passaggi di thedoubletwenty | plugin precedente alla 2.2.1, oppure cache delle pagine di thedoubletwenty da svuotare |
| Le pagine di thedoubletwenty mostrano qualcosa di Nutrex (carrello, pagamento) | plugin precedente alla 2.2: aggiornalo e svuota la cache |
| Le email Nutrex finiscono nello spam o partono da thedoubletwenty | manca la password di info@nutrexlab.it nelle impostazioni, o il server di posta l'ha rifiutata (vedi "Stato") |
| Il modulo contatti dice "Invio non riuscito" | plugin non aggiornato, oppure la posta non parte (vedi "Stato" nelle impostazioni) |
| Nell'importazione la colonna "Slug" non e' abbinata | plugin precedente alla 2.1: aggiornalo e ripeti l'importazione (senza, lo slug viene dal nome e il prodotto perde colori e link 3D del sito) |
| Un prezzo cambiato non si vede subito | cache di qualche secondo (al massimo un minuto): nel carrello e nel checkout e' gia' quello nuovo |
| Pagamento o area clienti in un'altra lingua con alcuni testi in inglese | manca il pacchetto di lingua di WordPress o WooCommerce per quella lingua (vedi "Lingue" in "Da sapere") |
| Pagamento o area clienti sempre in italiano | plugin precedente alla 2.4, oppure la pagina e' rimasta nella cache di thedoubletwenty o di Cloudflare (deve essere esclusa: la pagina e' diversa per ogni cliente) |
| Su Google compaiono pagine di thedoubletwenty per i prodotti o le categorie Nutrex | plugin precedente alla 2.3.2 (passaggio temporaneo 302): aggiornalo; Google sposta le pagine su nutrexlab.it in qualche settimana |

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

Il WooCommerce di prova (http://127.0.0.1:9400) si chiama "Cuscini Prova": fa la parte dell'altro
negozio, che il checkout Nutrex non deve mai mostrare. Ha italiano, euro, kg e cm, IVA 22%, spedizione
in Italia, la categoria Nutrex Lab con Polvere/Compresse/Capsule, i 12 prodotti (uno variabile, uno
esaurito, uno con pochi pezzi, due in offerta), un prodotto dell'altro negozio, il coupon `PROVA10`,
pagamento alla consegna e bonifico di prova. Le credenziali di prova finiscono in
`wordpress/sviluppo/out` (esclusa da git), le email (che non partono) in `wordpress/sviluppo/out/mail`.
`wordpress/sviluppo/mu-plugins` serve solo in locale (database SQLite e http, email, importazione di
prova di un CSV con `POST /wp-json/nutrex-dev/v1/import`): mai in produzione.

Poi il sito, in un altro terminale (le variabili si passano dal terminale: il sito non legge file `.env`):

```powershell
$env:WOOCOMMERCE_URL='http://127.0.0.1:9400'; $env:WOOCOMMERCE_CATEGORY='nutrex-lab'; $env:SITE_URL='http://127.0.0.1:5173'; npm run dev
```

http://127.0.0.1:5173/integratori. Nel WooCommerce di prova l'indirizzo del negozio e' gia'
`http://127.0.0.1:5173`, quindi dopo il pagamento si torna qui. `npm run build` e `npm run preview`
(porta 4173) provano la build di produzione con le stesse funzioni. `npm test` esegue le prove
automatiche del codice del server (senza WooCommerce).

## Come e' fatto

| Parte | File |
| --- | --- |
| Funzioni Vercel | `api/products.js` (elenco e singolo prodotto con i correlati), `api/cart.js` (carrello), `api/checkout.js` (indirizzo del checkout), `api/product-page.js` (pagina prodotto con titolo, descrizione e dati strutturati per Google), `api/recensioni.js` (recensioni: lettura e invio), `api/contatto.js` (modulo contatti), `api/account.js` (porta all'area clienti Nutrex), `api/google-verify.js` (verifica di Google Search Console), `api/sitemap.js` |
| Codice del server | `server/`: `woo.js` (Store API), `catalog.js` (prodotti e categoria del negozio, correlati, recensioni), `cart.js`, `checkout.js`, `product-page.js`, `plugin.js` (chiamate al plugin), `contact.js`, `reviews.js`, `session.js` (cookie del carrello), `http.js`, `errors.js` (messaggi per il cliente), `env.js` (variabili) |
| Indirizzi | `vercel.json`: `/prodotto/<slug>` -> `api/product-page`, `/sitemap.xml` -> `api/sitemap`; in locale lo stesso lo fa `vite.config.js` |
| Browser | `src/shop/` (`api.js`, `cart.js` carrello condiviso tra le schede, `card.js` scheda prodotto, `config.js` recapiti, offerte quantita' e metodi di pagamento, `money.js`, `themes.js` colori per slug), `src/pages/` (script delle pagine) |
| Plugin WordPress | `wordpress/nutrex-headless/`: `includes/separation.php` (negozi separati), `checkout-page.php` (pagina di pagamento Nutrex), `checkout-look.php` (cornice Nutrex, senza menu e stili del sito ospite), `checkout-handoff.php` (dal carrello del sito), `frontend-links.php`, `emails.php` + `email-look.php` + `templates/emails/` (email Nutrex), `mail.php` (invio da info@nutrexlab.it), `contact.php`, `reviews.php`, `account.php` (area clienti: sconto primo ordine, invita un amico), `i18n.php` (lingue di pagamento e area clienti, scelta della lingua; traduzioni in `lang/`), `settings.php`, `import.php`; `templates/emails/nutrex-account.php` (email di account) |
| WooCommerce di prova | `wordpress/sviluppo/` |
| Prove automatiche | `tests/` (`npm test`) |

Carrello: la sessione della Store API (Cart-Token) sta nel cookie `nx_cart` (httpOnly, 48 ore); il cookie
`nx_count` serve solo al numero sul pulsante del carrello. Cache: prodotti 10 s sul CDN (poi aggiornati in
background) e 10 s in memoria nella funzione, pagina prodotto 120 s (prezzi e scorte poi riletti dal browser),
sitemap 1 ora, carrello mai. La cache di SiteGround su thedoubletwenty teneva le letture dei prodotti per ore:
le richieste del negozio hanno un parametro `_nx` sempre diverso che la salta (`server/woo.js`).

Il passaggio al pagamento porta a `WOOCOMMERCE_URL/?nutrex-checkout=1&items=<id>:<quantita>,...&coupons=...&nutrex_lang=<lingua>`:
il plugin mette da parte l'eventuale carrello di thedoubletwenty del visitatore (torna com'era alla sua
prima pagina di thedoubletwenty), mette nel carrello gli stessi prodotti (solo della categoria Nutrex) e
coupon e apre la pagina di pagamento Nutrex. I prezzi non passano dall'indirizzo: li calcola WooCommerce.
