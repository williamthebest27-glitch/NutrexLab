/**
 * Voci del menu principale: due strati di lettere sovrapposti.
 * Al passaggio del mouse le lettere attuali si rimpiccioliscono e svaniscono,
 * mentre quelle viola "atterrano" una alla volta da piu' grandi (effetto zoom).
 * L'animazione e' in CSS (base.css, .nav-link): qui si prepara solo il markup.
 */
export function initNavLinks() {
  document.querySelectorAll('[data-nav-link]').forEach((a) => {
    const text = a.textContent.trim()
    const chars = [...text]
      .map((ch, i) => `<span class="nav-link__c" style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`)
      .join('')
    a.setAttribute('aria-label', text)
    a.style.setProperty('--n', text.length)
    a.innerHTML =
      `<span class="nav-link__a" aria-hidden="true">${chars}</span>` +
      `<span class="nav-link__b" aria-hidden="true">${chars}</span>`
  })
}
