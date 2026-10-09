/*
  Traduzioni: tedesco. Un file per parte del sito, con gli stessi campi della lingua italiana:
  html        testi dell'HTML (chiavi data-i18n delle pagine e delle parti comuni)
  ui          testi scritti dal JavaScript (la chiave e' il testo italiano)
  meta        titoli e descrizioni delle pagine (la chiave e' il testo italiano)
  products    nomi del menu prodotti della homepage (src/products.js)
  copy        testi della homepage per ogni prodotto (src/content.js)
  experience  testi della sezione del bicchiere (src/components/ProductExperience/copy.js)
  catalog     catalogo: nomi, benefici, domande frequenti, categorie (src/seo/catalog.js)
  woo         nomi e descrizioni dei prodotti di WooCommerce
*/
import html from './de/html.js'
import ui from './de/ui.js'
import meta from './de/meta.js'
import products from './de/products.js'
import copy from './de/copy.js'
import experience from './de/experience.js'
import catalog from './de/catalog.js'
import woo from './de/woo.js'

export default { html, ui, meta, products, copy, experience, catalog, woo }
