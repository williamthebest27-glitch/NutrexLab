import { PRODUCTS, CATEGORIES, SHOP, productsIn, categoryPath } from './catalog.js'
import { graph, organization, website, webPage, breadcrumbs, itemList, faqPage, IDS } from './schema.js'

/*
  <head> delle pagine statiche: nel file HTML il segnaposto <!-- seo:chiave --> diventa titolo,
  descrizione, canonical, Open Graph, Twitter e dati strutturati (vite.config.js, plugin "seo").
  La pagina prodotto li riceve dal server (server/product-page.js).
*/

const HOME = {
  path: '/',
  title: 'Integratori Alimentari Made in Italy | Nutrex Lab',
  socialTitle: 'Nutrex Lab: integratori alimentari made in Italy',
  description:
    'Collagene marino, vitamine C, B12 e D3 + K2, magnesio bisglicinato, ashwagandha KSM-66 e altri integratori Nutrex Lab prodotti in Italia. Scopri la linea.',
}

const shopTrail = [['Home', '/'], [SHOP.name, SHOP.path]]

/** Pagina con una griglia di prodotti. trail solo se il breadcrumb e' visibile nella pagina (categorie). */
function catalogPage({ path, title, description, faq, products, trail, name }) {
  return {
    path,
    title,
    description,
    jsonld: graph(
      webPage({ path, name, description, type: 'CollectionPage', breadcrumb: !!trail }),
      trail ? breadcrumbs(trail, path) : null,
      itemList(products, path),
      faq?.length ? faqPage(faq, path) : null,
    ),
  }
}

function plainPage({ path, title, description, type = 'WebPage' }) {
  return { path, title, description, jsonld: graph(webPage({ path, name: title, description, type })) }
}

export const PAGES = {
  home: {
    ...HOME,
    jsonld: graph(
      organization(),
      website(),
      webPage({ path: '/', name: HOME.title, description: HOME.description, about: { '@id': IDS.org } }),
      itemList(PRODUCTS, '/'),
    ),
  },

  integratori: catalogPage({
    path: SHOP.path,
    name: 'Integratori alimentari Nutrex Lab',
    title: SHOP.title,
    description: SHOP.description,
    faq: SHOP.faq,
    products: PRODUCTS,
  }),

  ...Object.fromEntries(
    CATEGORIES.map((c) => [
      `categoria-${c.slug}`,
      catalogPage({
        path: categoryPath(c.slug),
        name: c.name,
        title: c.title,
        description: c.description,
        faq: c.faq,
        products: productsIn(c.slug),
        trail: [...shopTrail, [c.name, categoryPath(c.slug)]],
      }),
    ]),
  ),

  'chi-siamo': {
    path: '/chi-siamo',
    title: 'Chi Siamo: Integratori Prodotti in Italia | Nutrex Lab',
    description:
      'Nutrex Lab è un marchio italiano di integratori alimentari: 12 formule prodotte in Italia con standard GMP / ISO 9001 e dosi dichiarate in etichetta.',
    jsonld: graph(
      webPage({
        path: '/chi-siamo',
        name: 'Chi siamo',
        description: 'Chi c’è dietro Nutrex Lab, come nascono le formule e dove vengono prodotte.',
        type: 'AboutPage',
        breadcrumb: true,
        about: { '@id': IDS.org },
      }),
      breadcrumbs([['Home', '/'], ['Chi siamo', '/chi-siamo']], '/chi-siamo'),
    ),
  },

  contatti: {
    path: '/contatti',
    title: 'Contatti e Assistenza Clienti | Nutrex Lab',
    socialTitle: 'Contatti | Nutrex Lab',
    description:
      'Contatta Nutrex Lab per domande su prodotti, ordini e spedizioni: email info@nutrexlab.it, telefono e WhatsApp +39 333 719 2623 o il modulo online.',
    jsonld: graph(
      webPage({
        path: '/contatti',
        name: 'Contatti',
        description: 'Recapiti e modulo di contatto di Nutrex Lab.',
        type: 'ContactPage',
        about: { '@id': IDS.org },
      }),
    ),
  },

  'spedizioni-e-resi': plainPage({
    path: '/spedizioni-e-resi',
    title: 'Spedizioni e Resi: Consegna in 2-4 Giorni | Nutrex Lab',
    description:
      'Spedizioni e resi Nutrex Lab: ordini preparati entro 48 ore lavorative, consegna in 2-4 giorni in tutta Italia, isole comprese, e 14 giorni per il reso.',
  }),
  'termini-e-condizioni': plainPage({
    path: '/termini-e-condizioni',
    title: 'Termini e condizioni | Nutrex Lab',
    description: 'Termini e condizioni di vendita di Nutrex Lab: prezzi, pagamento, consegna, diritto di recesso e garanzia.',
  }),
  'note-legali': plainPage({
    path: '/note-legali',
    title: 'Note legali | Nutrex Lab',
    description: "Note legali di Nutrex Lab: titolare del sito, attivita', proprieta' intellettuale e legge applicabile.",
  }),
  'privacy-policy': plainPage({
    path: '/privacy-policy',
    title: 'Privacy Policy | Nutrex Lab',
    description: "Privacy Policy di Nutrex Lab: quali dati raccogliamo, perche', per quanto tempo e quali sono i tuoi diritti (GDPR).",
  }),
  'cookie-policy': plainPage({
    path: '/cookie-policy',
    title: 'Cookie Policy | Nutrex Lab',
    description: 'Cookie Policy di Nutrex Lab: usiamo solo cookie tecnici per il carrello e la navigazione, nessuna profilazione.',
  }),

  // pagina di errore (Vercel la serve con lo stato 404): mai nell'indice
  404: {
    path: '/404',
    title: 'Pagina non trovata | Nutrex Lab',
    description: 'La pagina che cerchi non esiste o ha cambiato indirizzo: scopri gli integratori Nutrex Lab.',
    robots: 'noindex',
  },
}
