/**
 * Navbar (tutte le pagine):
 * - la voce della pagina aperta e' segnata (aria-current; Acquista anche in categorie, prodotti e carrello)
 * - sottomenu di "Acquista" sul desktop: si apre passando con il mouse, con il fuoco da tastiera
 *   o toccando la freccia; si chiude uscendo (con un attimo di tolleranza), con Esc o toccando fuori.
 * L'animazione e' in CSS (base.css, .nav-sub): qui si gestisce solo lo stato .is-open.
 */
export function initNavMenu() {
  markCurrent()
  document.querySelectorAll('[data-nav-sub]').forEach(setupSub)
}

/** '/integratori.html' e '/integratori/' diventano '/integratori' */
function cleanPath(p) {
  p = p.replace(/\/index\.html$/, '/').replace(/\.html$/, '')
  return p.length > 1 ? p.replace(/\/$/, '') : '/'
}

function markCurrent() {
  const here = cleanPath(location.pathname)
  document.querySelectorAll('.nav a[href^="/"], .mnav a[href^="/"], .footer a[href^="/"]').forEach((a) => {
    if (a.classList.contains('nav__logo') || a.classList.contains('nav__cta')) return
    if (cleanPath(a.getAttribute('href')) === here) a.setAttribute('aria-current', 'page')
  })
  // Acquista resta segnata in tutto il negozio: categorie, prodotti e carrello
  if (here === '/carrello' || here.startsWith('/integratori/') || here.startsWith('/prodotto/')) {
    document.querySelector('[data-nav-sub] > .nav-link')?.classList.add('is-section')
  }
}

function setupSub(item) {
  const button = item.querySelector('.nav-item__more')
  const link = item.querySelector('.nav-link')
  let open = false
  let timer = 0

  const set = (value) => {
    clearTimeout(timer)
    if (value === open) return
    open = value
    item.classList.toggle('is-open', open)
    button?.setAttribute('aria-expanded', String(open))
  }
  const closeSoon = () => {
    clearTimeout(timer)
    timer = setTimeout(() => set(false), 220)
  }

  item.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && set(true))
  item.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && closeSoon())
  item.addEventListener('focusin', () => set(true))
  item.addEventListener('focusout', (e) => !item.contains(e.relatedTarget) && set(false))
  button?.addEventListener('click', () => set(!open))
  document.addEventListener('pointerdown', (e) => open && !item.contains(e.target) && set(false))
  document.addEventListener('keydown', (e) => {
    if (!open || e.key !== 'Escape') return
    set(false)
    link?.focus()
  })
}
