/*
  Traduzioni: tedesco. Un file per parte del sito (la chiave e' sempre il testo italiano):
  html        testi dell'HTML (chiavi data-i18n delle pagine, delle parti comuni e del catalogo)
  ui          testi scritti dal JavaScript (pulsanti, messaggi, errori del negozio)
  meta        titoli e descrizioni delle pagine
  products    menu prodotti della homepage (src/products.js)
  copy        testi della homepage per ogni prodotto (src/content.js)
  experience  testi della sezione del bicchiere (src/components/ProductExperience/copy.js)
  catalog     catalogo: nomi, benefici, domande frequenti, categorie (src/seo/catalog.js)
  woo         nomi e descrizioni dei prodotti di WooCommerce
  legal       pagine legali e Chi siamo
  extra       titoli su due righe, etichette del JavaScript, numeri con unita'
*/
import html from './de/html.js'
import ui from './de/ui.js'
import meta from './de/meta.js'
import products from './de/products.js'
import copy from './de/copy.js'
import experience from './de/experience.js'
import catalog from './de/catalog.js'
import woo from './de/woo.js'
import legal from './de/legal.js'
import extra from './de/extra.js'

export default { html, ui, meta, products, copy, experience, catalog, woo, legal, extra }
