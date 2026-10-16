/*
  Homepage e pagina Benefici parlano di un prodotto alla volta (?prodotto=id nell'indirizzo): i link
  dall'una all'altra (navbar, menu mobile, logo, footer, briciole) portano lo stesso prodotto, cosi'
  passando da una pagina all'altra si resta sul prodotto scelto. Il primo della linea non ha parametro.
*/
const PATHS = new Set(['/', '/benefici'])

export function syncProductLinks(id, firstId) {
  for (const a of document.querySelectorAll('a[href]')) {
    if (a.closest('[data-pmenu]')) continue
    const href = a.getAttribute('href')
    if (!href || href.startsWith('#')) continue
    let url
    try {
      url = new URL(href, location.origin)
    } catch {
      continue
    }
    if (url.origin !== location.origin) continue
    const path = url.pathname.replace(/^\/(?:en|fr|de|es)(?=\/|$)/, '') || '/'
    if (!PATHS.has(path)) continue
    if (id === firstId) url.searchParams.delete('prodotto')
    else url.searchParams.set('prodotto', id)
    a.setAttribute('href', url.pathname + url.search + url.hash)
  }
}
