/*
  Pezzi di HTML della SEO condivisi da build, server e browser (funzioni pure, niente DOM):
  breadcrumb visibile e domande frequenti. Gli stessi dati finiscono nei dati strutturati
  (src/seo/schema.js): quello che legge Google e' quello che vede il cliente.
*/

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'

/**
 * Breadcrumb visibile: trail = [[nome, percorso], ...], l'ultima voce e' la pagina aperta.
 * hex: con l'esagono del marchio davanti (testata delle pagine, al posto dell'etichetta).
 */
export function crumbsHtml(trail, { className = '', hex = false, attrs = '' } = {}) {
  const items = trail
    .map(([name, path], i) =>
      i === trail.length - 1
        ? `<li aria-current="page">${esc(name)}</li>`
        : `<li><a href="${esc(path)}">${esc(name)}</a></li>`,
    )
    .join('')
  const mark = hex ? `<svg viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}" /></svg>` : ''
  return `<nav class="crumbs ${className}" aria-label="Percorso"${attrs ? ` ${attrs}` : ''}>${mark}<ol>${items}</ol></nav>`
}

/**
 * Domande frequenti: <details> nativi (si aprono senza JavaScript, li leggono anche i motori di
 * ricerca). faq = [[domanda, risposta], ...]; le risposte sono testo semplice.
 */
export function faqHtml(faq, { id = 'domande', title = 'Domande frequenti', heading = 'h2', attrs = '' } = {}) {
  if (!faq?.length) return ''
  const items = faq
    .map(
      ([q, a]) =>
        `<details class="faq__item"><summary class="faq__q"><span>${esc(q)}</span><i class="faq__icon" aria-hidden="true"></i></summary><p class="faq__a">${esc(a)}</p></details>`,
    )
    .join('')
  return `<section class="faq" aria-labelledby="${id}"${attrs ? ` ${attrs}` : ''}><${heading} class="display faq__title" id="${id}">${esc(title)}</${heading}><div class="faq__list">${items}</div></section>`
}
