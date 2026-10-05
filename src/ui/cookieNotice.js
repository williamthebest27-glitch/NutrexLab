/*
  Avviso sui cookie (tutte le pagine): il sito usa solo cookie tecnici, quindi non c'e' un consenso da
  chiedere, solo un'informativa breve con il link alla Cookie Policy. Chiuso con "Ho capito" non
  ricompare (memoria del browser: nx_cookie_notice). Se un giorno si aggiungono statistiche o
  marketing, qui servira' un vero consenso (Accetta / Rifiuta) prima di caricarli.
*/

const KEY = 'nx_cookie_notice'

function seen() {
  try {
    return !!localStorage.getItem(KEY)
  } catch {
    return false // memoria non disponibile: l'avviso si vede a ogni visita
  }
}

export function initCookieNotice() {
  if (seen() || document.querySelector('.cookie')) return
  const box = document.createElement('div')
  box.className = 'cookie'
  box.setAttribute('role', 'region')
  box.setAttribute('aria-label', 'Informativa sui cookie')
  box.innerHTML =
    '<p class="cookie__text"><strong>Cookie.</strong> Usiamo solo cookie tecnici, necessari per il carrello e per il ' +
    'funzionamento del sito: nessuna profilazione, nessuna pubblicit&agrave;. <a href="/cookie-policy">Cookie Policy</a></p>' +
    '<button class="btn btn--sm cookie__ok" type="button"><span class="btn__label">Ho capito</span></button>'
  document.body.appendChild(box)
  requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-in')))

  box.querySelector('.cookie__ok').addEventListener('click', () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // niente memoria: si chiude solo per questa pagina
    }
    box.classList.remove('is-in')
    setTimeout(() => box.remove(), 700)
  })
}
