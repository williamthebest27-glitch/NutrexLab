import { onLang, htmlText } from '../i18n/index.js'

/**
 * Voci del menu principale: due strati di lettere sovrapposti.
 * Al passaggio del mouse le lettere attuali si rimpiccioliscono e svaniscono,
 * mentre quelle viola "atterrano" una alla volta da piu' grandi (effetto zoom).
 * L'animazione e' in CSS (base.css, .nav-link): qui si prepara solo il markup.
 * Il testo e' nella lingua del sito (data-i18n-text): cambiando lingua le lettere si rifanno.
 */
function build(a, text) {
  const chars = [...text]
    .map((ch, i) => `<span class="nav-link__c" style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`)
    .join('')
  a.setAttribute('aria-label', text)
  a.style.setProperty('--n', text.length)
  a.innerHTML =
    `<span class="nav-link__a" aria-hidden="true">${chars}</span>` +
    `<span class="nav-link__b" aria-hidden="true">${chars}</span>`
}

export function initNavLinks() {
  const links = [...document.querySelectorAll('[data-nav-link]')]
  for (const a of links) {
    a._it ??= a.textContent.trim()
    build(a, htmlText(a.dataset.i18nText, a._it))
  }
  onLang(() => links.forEach((a) => build(a, htmlText(a.dataset.i18nText, a._it))))
}
