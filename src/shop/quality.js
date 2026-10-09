import { QUALITY, qualityFor, productBySlug } from '../seo/catalog.js'
import { esc } from './themes.js'

/*
  Sotto la tabella delle caratteristiche della pagina prodotto:
  - "Benefici": cosa apporta il prodotto, con un simbolo per ciascuno (testi in src/seo/catalog.js,
    solo indicazioni riportate in etichetta o autorizzate);
  - "Qualita' e garanzie": i sigilli della linea (Made in Italy, GMP, ISO 9001) e i simboli del
    prodotto (vegano, senza OGM, senza glutine, senza lattosio...), dalle etichette.
  Qui c'e' solo il disegno, nei colori del prodotto (--c-*).
*/

// sigilli: testo sul bordo (cerchio di raggio 43,5 che parte da sinistra, in senso orario) e centro
const RING = 'M16.5 60a43.5 43.5 0 1 1 87 0a43.5 43.5 0 1 1-87 0'
const SEAL = {
  italia: {
    ring: 'MADE IN ITALY • MADE IN ITALY •',
    core: `<clipPath id="q-flag"><circle cx="60" cy="60" r="36" /></clipPath>
      <g clip-path="url(#q-flag)"><rect x="24" y="24" width="24" height="72" fill="#1f8a4c" /><rect x="48" y="24" width="24" height="72" fill="#f4f1ea" /><rect x="72" y="24" width="24" height="72" fill="#cf2b37" /></g>
      <circle class="qseal__edge" cx="60" cy="60" r="36" />`,
  },
  gmp: {
    ring: 'GOOD MANUFACTURING PRACTICE •',
    core: '<circle class="qseal__core" cx="60" cy="60" r="36" /><circle class="qseal__dash" cx="60" cy="60" r="31.5" /><text class="qseal__mark" x="60" y="67.5">GMP</text>',
  },
  iso: {
    ring: 'QUALITY MANAGEMENT • CERTIFIED •',
    core: '<circle class="qseal__core" cx="60" cy="60" r="36" /><circle class="qseal__dash" cx="60" cy="60" r="31.5" /><text class="qseal__small" x="60" y="53">ISO</text><text class="qseal__mark qseal__mark--sm" x="60" y="72">9001</text>',
  },
}

// simboli 24 x 24 a tratto (come le icone della sezione "La qualita' in ogni barattolo");
// "senza": la barra diagonale con un margine del colore di fondo (.ko) per staccarla dal disegno
const NO = '<path class="ko" d="M4.6 4.6l14.8 14.8" /><path d="M4.6 4.6l14.8 14.8" />'
const ICON = {
  vegano: '<path d="M5.6 18.4C5 10.9 9.5 5.5 19 5c.4 9.5-5 14-12.6 13.5" /><path d="M5 19.6c2.6-4.6 5.8-7.6 9.6-9.6" />',
  ogm: `<path d="M8.5 3c0 4.5 7 4.5 7 9s-7 4.5-7 9" /><path d="M15.5 3c0 4.5-7 4.5-7 9s7 4.5 7 9" /><path d="M9.7 6h4.6M9.7 18h4.6" />${NO}`,
  glutine: `<path d="M12 21V6.6" /><path d="M12 6.6c-.9-.9-1.1-2.2-.1-3.6 1 1.4.9 2.7.1 3.6Z" /><path d="M12 10.6c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5Zm0 0c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5Z" /><path d="M12 14.6c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5Zm0 0c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5Z" /><path d="M12 18.6c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5Zm0 0c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5Z" />${NO}`,
  lattosio: `<path d="M9.5 2.8h5" /><path d="M10 2.8v3.1L8.2 8.6a4 4 0 0 0-.7 2.3v8.3c0 1 .8 1.8 1.8 1.8h5.4c1 0 1.8-.8 1.8-1.8v-8.3a4 4 0 0 0-.7-2.3L14 5.9V2.8" /><path d="M7.5 12.5h9" />${NO}`,
  gastro: '<path d="M12 3.2 19 6v5.4c0 4.3-2.9 7.9-7 9.4-4.1-1.5-7-5.1-7-9.4V6z" /><rect x="8.6" y="9.4" width="6.8" height="4.4" rx="2.2" /><path d="M12 9.4v4.4" />',
  capsule: '<path d="M5.6 18.4a3.6 3.6 0 0 1 0-5.1l7.7-7.7a3.6 3.6 0 0 1 5.1 5.1l-7.7 7.7a3.6 3.6 0 0 1-5.1 0Z" /><path d="m9.45 9.45 5.1 5.1" />',
  ksm66: '<path d="M4.5 15.5h15" /><path d="M12 15.5V9.8" /><path d="M12 11.6C12 8.4 9.9 6.3 6.7 6.3c0 3.2 2.1 5.3 5.3 5.3Z" /><path d="M12 9.8c0-3.1 2-5.1 5.1-5.1 0 3.1-2 5.1-5.1 5.1Z" /><path d="M12 15.5v5M12 18l-2.6 2.6M12 18l2.6 2.6" />',
  neutro: '<path d="M6.5 3.5h11l-1.6 15.6a1.6 1.6 0 0 1-1.6 1.4H9.7a1.6 1.6 0 0 1-1.6-1.4Z" /><path d="M7.3 10.4c1.6-.9 3.1-.9 4.7 0s3.1.9 4.7 0" />',
  probiotici: '<rect x="3.4" y="5" width="10.2" height="5.2" rx="2.6" transform="rotate(-20 8.5 7.6)" /><rect x="10.4" y="13.6" width="10.2" height="5.2" rx="2.6" transform="rotate(-20 15.5 16.2)" /><circle cx="6.4" cy="16.6" r="2" /><circle cx="17.6" cy="6.4" r="1.3" />',
}

// simboli dei benefici (stesso tratto)
const BENEFIT = {
  collagene: '<path d="M3 8c3 0 3-3 6-3s3 3 6 3 3-3 6-3" /><path d="M3 13c3 0 3-3 6-3s3 3 6 3 3-3 6-3" /><path d="M3 18c3 0 3-3 6-3s3 3 6 3 3-3 6-3" />',
  pelle: '<path d="M11 3.5l1.9 5.1L18 10.5l-5.1 1.9L11 17.5l-1.9-5.1L4 10.5l5.1-1.9Z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8Z" />',
  capelli: '<path d="M7 3c-2.2 4 2 7 0 11s-.8 5.5 1 7" /><path d="M12 3c-2.2 4 2 7 0 11s-.8 5.5 1 7" /><path d="M17 3c-2.2 4 2 7 0 11s-.8 5.5 1 7" />',
  cellule: '<circle cx="12" cy="12" r="5.2" /><circle cx="12" cy="12" r="1.7" /><path d="M3.8 9.6a8.6 8.6 0 0 1 5.8-5.8M20.2 14.4a8.6 8.6 0 0 1-5.8 5.8" />',
  tessuti: '<path d="M10 14l4-4" /><path d="M8.6 11.4l-2.2 2.2a3.5 3.5 0 0 0 5 5l2.2-2.2" /><path d="M15.4 12.6l2.2-2.2a3.5 3.5 0 0 0-5-5l-2.2 2.2" />',
  enzimi: '<circle cx="6" cy="7" r="2.4" /><circle cx="18" cy="9" r="2.4" /><circle cx="10" cy="18" r="2.4" /><path d="M8.4 7.4l7.2 1.2M16.4 10.9l-4.8 5.3M6.8 9.3l2.2 6.4" />',
  molecola: '<circle cx="6" cy="7" r="2.4" /><circle cx="18" cy="9" r="2.4" /><circle cx="10" cy="18" r="2.4" /><path d="M8.4 7.4l7.2 1.2M16.4 10.9l-4.8 5.3M6.8 9.3l2.2 6.4" />',
  ananas: '<ellipse cx="12" cy="15.2" rx="5" ry="5.8" /><path d="M12 9.4V6.2M12 6.2 9.6 3.2M12 6.2l2.4-3M12 6.2c-1.6-.6-3.1-.4-4.6.6M12 6.2c1.6-.6 3.1-.4 4.6.6" /><path d="M9 12.2l6 6M15 12.2l-6 6" />',
  gastro: ICON.gastro,
  equilibrio: '<path d="M12 4v16M8.5 20h7M5 7h14" /><path d="M5 7l-2.6 6h5.2Z" /><path d="M19 7l-2.6 6h5.2Z" />',
  relax: '<path d="M19 14.6A7.6 7.6 0 0 1 9.4 5a7.6 7.6 0 1 0 9.6 9.6Z" /><path d="M17 3.5v3M15.5 5h3" />',
  mente: '<circle cx="12" cy="12" r="8.6" /><path d="M8.4 14c1.9 2.1 5.3 2.1 7.2 0" /><path d="M9 9.6h.01M15 9.6h.01" />',
  cuore: '<path d="M12 20s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.5C19.6 15.4 12 20 12 20Z" />',
  battito: '<path d="M12 20s-7.6-4.6-7.6-10.1A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.6 2.5C19.6 15.4 12 20 12 20Z" /><path d="M6.5 12.5h3l1.4-2.6 2 4.6 1.4-2h3.2" />',
  circolo: '<path d="M12 21v-7M12 14 7 9M12 14l5-5M7 9V4M7 9 3.5 6.6M17 9V4M17 9l3.5-2.4" />',
  energia: '<path d="M13 2.6 5 13.4h6l-1 8 8-10.8h-6Z" />',
  goccia: '<path d="M12 3.4s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11Z" />',
  onde: '<path d="M12 3s-3 3.4-3 5.6a3 3 0 0 0 6 0C15 6.4 12 3 12 3Z" /><path d="M3 15c2.2 0 2.2-1.5 4.5-1.5S9.8 15 12 15s2.2-1.5 4.5-1.5S18.8 15 21 15" /><path d="M3 19.5c2.2 0 2.2-1.5 4.5-1.5s2.3 1.5 4.5 1.5 2.2-1.5 4.5-1.5 2.3 1.5 4.5 1.5" />',
  difese: '<path d="M12 3.2 19 6v5.4c0 4.3-2.9 7.9-7 9.4-4.1-1.5-7-5.1-7-9.4V6z" /><path d="M12 8.6v6M9 11.6h6" />',
  piuma: '<path d="M20 4c-8 0-13 5-13 12v4" /><path d="M20 4c0 8-5 12-13 12" /><path d="M11.5 12.5h3.5M9.5 15.5h3.5" />',
  vasi: '<path d="M3 9.5c3.5-3 7.5 2.5 11 0 2.4-1.7 4.6-1.6 7-.6" /><path d="M3 15c3.5-3 7.5 2.5 11 0 2.4-1.7 4.6-1.6 7-.6" /><path d="M7 11.6h.01M12 12.8h.01M17 11h.01" />',
  muscoli: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />',
  nervi: '<circle cx="12" cy="12" r="3" /><path d="M12 9V4M9.4 13.5 5 16M14.6 13.5 19 16M12 4 10 2.5M12 4l2-1.5M5 16l-.5 2.6M5 16l-2.4-.8M19 16l.5 2.6M19 16l2.4-.8" />',
  batteria: '<rect x="3" y="7.5" width="16" height="9" rx="2" /><path d="M21 10.5v3M6.5 10.5v3M9.5 10.5v3M12.5 10.5v3M15.5 10.5v3" />',
  sangue: '<circle cx="9" cy="10" r="5.4" /><circle cx="9" cy="10" r="1.9" /><circle cx="16.5" cy="16" r="4.4" /><circle cx="16.5" cy="16" r="1.5" />',
  ossa: '<path d="M9.2 14.8l5.6-5.6" /><circle cx="6.6" cy="15.4" r="2" /><circle cx="8.6" cy="17.4" r="2" /><circle cx="15.4" cy="6.6" r="2" /><circle cx="17.4" cy="8.6" r="2" />',
}

function sealHtml(key) {
  const q = QUALITY[key]
  const s = SEAL[key]
  return `<li class="qseal" role="img" aria-label="${esc(`${q.name}: ${q.note}`)}">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle class="qseal__rim" cx="60" cy="60" r="58" />
      <g class="qseal__ring"><path id="q-ring-${key}" d="${RING}" fill="none" /><text><textPath href="#q-ring-${key}" textLength="268" lengthAdjust="spacing">${esc(s.ring)}</textPath></text></g>
      ${s.core}
    </svg>
    <span class="qseal__k" aria-hidden="true">${esc(q.note)}</span>
  </li>`
}

const claimHtml = (key) =>
  `<li class="qclaim"><span class="qclaim__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[key] ?? ''}</svg></span><span><b>${esc(QUALITY[key].name)}</b><small>${esc(QUALITY[key].note)}</small></span></li>`

/** Il riquadro "Benefici" di un prodotto (stringa vuota per i prodotti senza testi in catalog.js). */
export function benefitsHtml(slug) {
  const list = productBySlug(slug)?.benefits ?? []
  if (!list.length) return ''
  const items = list
    .map(
      ([icon, name, text]) =>
        `<li class="qben"><span class="qben__icon" aria-hidden="true"><svg viewBox="0 0 24 24">${BENEFIT[icon] ?? ''}</svg></span><span><b>${esc(name)}</b><small>${esc(text)}</small></span></li>`,
    )
    .join('')
  return `<section class="pp__quality pp__benefits" aria-labelledby="benefici-prodotto">
    <h3 class="mono pp__quality-k" id="benefici-prodotto">Benefici</h3>
    <ul class="pp__bens" role="list">${items}</ul>
  </section>`
}

/** Il riquadro "Qualita' e garanzie" di un prodotto (stringa vuota se non ha simboli). */
export function qualityHtml(slug) {
  const keys = qualityFor(slug)
  if (!keys.length) return ''
  const seals = keys.filter((k) => SEAL[k])
  const claims = keys.filter((k) => !SEAL[k])
  return `<section class="pp__quality pp__guarantees" aria-labelledby="qualita-prodotto">
    <h3 class="mono pp__quality-k" id="qualita-prodotto">Qualit&agrave; e garanzie</h3>
    ${seals.length ? `<ul class="pp__seals" role="list">${seals.map(sealHtml).join('')}</ul>` : ''}
    ${claims.length ? `<ul class="pp__claims" role="list">${claims.map(claimHtml).join('')}</ul>` : ''}
  </section>`
}
