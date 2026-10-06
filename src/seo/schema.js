import { ORIGIN, BRAND, COMPANY, RETURNS, absolute, productPath } from './catalog.js'

/*
  Dati strutturati (JSON-LD, schema.org) di Nutrex Lab. Solo dati veri e visibili nella pagina:
  niente prezzi, recensioni o voti inventati (quelli del prodotto arrivano da WooCommerce).
  Ogni pagina ha un @graph: le entita' si richiamano con @id (organizzazione, sito, pagina, breadcrumb).
*/

export const IDS = {
  org: `${ORIGIN}/#organizzazione`,
  site: `${ORIGIN}/#sito`,
  returns: `${ORIGIN}/#politica-resi`,
}

/** Politica di reso della pagina Spedizioni e resi (14 giorni, per posta, spese di reso al cliente). */
export function returnPolicy() {
  return {
    '@type': 'MerchantReturnPolicy',
    '@id': IDS.returns,
    applicableCountry: RETURNS.country,
    returnPolicyCountry: RETURNS.country,
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: RETURNS.days,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    merchantReturnLink: `${ORIGIN}/spedizioni-e-resi`,
  }
}

/** Il marchio come negozio online: nome, logo, recapiti, sede, partita IVA, politica di reso. */
export function organization() {
  const a = COMPANY.address
  return {
    '@type': 'OnlineStore',
    '@id': IDS.org,
    name: BRAND,
    legalName: COMPANY.legalName,
    url: `${ORIGIN}/`,
    logo: { '@type': 'ImageObject', url: absolute(COMPANY.logo.src), width: COMPANY.logo.width, height: COMPANY.logo.height },
    image: absolute(COMPANY.logo.src),
    description: 'Integratori alimentari prodotti in Italia: collagene, vitamine e minerali, estratti vegetali titolati.',
    email: COMPANY.email,
    telephone: COMPANY.telephone,
    vatID: COMPANY.vatID,
    address: {
      '@type': 'PostalAddress',
      streetAddress: a.street,
      postalCode: a.postalCode,
      addressLocality: a.locality,
      addressRegion: a.region,
      addressCountry: a.country,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: COMPANY.email,
      telephone: COMPANY.telephone,
      availableLanguage: 'it',
      areaServed: 'IT',
    },
    sameAs: COMPANY.sameAs,
    hasMerchantReturnPolicy: returnPolicy(),
  }
}

/** Il sito (nome del sito nei risultati di Google). */
export function website() {
  return {
    '@type': 'WebSite',
    '@id': IDS.site,
    url: `${ORIGIN}/`,
    name: BRAND,
    alternateName: ['NutrexLab', 'nutrexlab.it'],
    inLanguage: 'it-IT',
    publisher: { '@id': IDS.org },
  }
}

/** La pagina: tipo (WebPage, CollectionPage, ContactPage, AboutPage...), titolo, descrizione, breadcrumb. */
export function webPage({ path, name, description, type = 'WebPage', breadcrumb = false, image, about }) {
  const url = absolute(path)
  return {
    '@type': type,
    '@id': `${url}#pagina`,
    url,
    name,
    description,
    inLanguage: 'it-IT',
    isPartOf: { '@id': IDS.site },
    ...(about ? { about } : {}),
    ...(breadcrumb ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
    ...(image ? { primaryImageOfPage: { '@type': 'ImageObject', url: absolute(image) } } : {}),
  }
}

/** Breadcrumb (lo stesso della barra visibile): trail = [[nome, percorso], ...]. */
export function breadcrumbs(trail, path) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${absolute(path)}#breadcrumb`,
    itemListElement: trail.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: absolute(p) })),
  }
}

/** Elenco dei prodotti di una pagina categoria (nell'ordine della griglia). */
export function itemList(products, path) {
  return {
    '@type': 'ItemList',
    '@id': `${absolute(path)}#prodotti`,
    numberOfItems: products.length,
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absolute(productPath(p.slug)), name: p.name })),
  }
}

/** Domande frequenti visibili nella pagina (stesso testo). */
export function faqPage(faq, path) {
  return {
    '@type': 'FAQPage',
    '@id': `${absolute(path)}#domande`,
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
}

export const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': nodes.flat().filter(Boolean) })

/** JSON dentro <script>: niente chiusure di tag ne' caratteri che rompono l'HTML. */
export const safeJson = (data) =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
