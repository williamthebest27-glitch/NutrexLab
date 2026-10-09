/*
  Traduzioni: inglese. Un file per parte del sito (la chiave e' sempre il testo italiano):
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
import html from './en/html.js'
import ui from './en/ui.js'
import meta from './en/meta.js'
import products from './en/products.js'
import copy from './en/copy.js'
import experience from './en/experience.js'
import catalog from './en/catalog.js'
import woo from './en/woo.js'
import legal from './en/legal.js'
import extra from './en/extra.js'

export default { html, ui, meta, products, copy, experience, catalog, woo, legal, extra }
