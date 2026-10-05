import { initPage, rise, esc } from './common.js'
import { api } from '../shop/api.js'
import { SHOP } from '../shop/config.js'
import { LOGO } from '../ui/logo-paths.js'

/*
  Contatti: recapiti da src/shop/config.js (quelli non ancora inseriti non compaiono; senza
  nessun recapito restano i tre principali con "Presto disponibile") e modulo che prepara
  l'email nel programma di posta di chi scrive, gia' compilata.
*/

const { ready } = initPage()
const C = SHOP.contacts

const ICONS = {
  email: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2.6"/><path d="m4.5 7.2 7.5 5.6 7.5-5.6"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M8.2 3.8 6 4.4c-1 .3-1.7 1.3-1.5 2.4.9 6.1 5.6 10.8 11.7 11.7 1.1.2 2.1-.5 2.4-1.5l.6-2.2-3.7-1.8-1.6 1.7a9.3 9.3 0 0 1-4.5-4.5L11 8.6 9.2 4.9z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24"><path d="M4.4 19.6 5.5 16A8 8 0 1 1 8.2 18.6z"/><path d="M9.3 9.1c.3 2.6 2.4 4.9 5.2 5.4l.9-1.3-1.7-.9-.8.8a4.5 4.5 0 0 1-2.2-2.2l.8-.8-.9-1.7z"/></svg>',
  address: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
  hours: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l2.9 1.9"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4.6"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.9" cy="7.1" r=".6"/></svg>',
  facebook: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4.6"/><path d="M13.4 20v-6.6h2.2l.3-2.5h-2.5V9.4c0-.7.2-1.2 1.2-1.2h1.4V6a17 17 0 0 0-2-.1c-2 0-3.3 1.2-3.3 3.4v1.6H8.5v2.5h2.2V20"/></svg>',
}

const handle = (url) => '@' + String(url).replace(/\/+$/, '').split('/').pop()
const intl = (n) => `+${String(n).slice(0, 2)} ${String(n).slice(2)}`

const all = [
  { key: 'email', label: 'Email', value: C.email, href: C.email && `mailto:${C.email}` },
  { key: 'phone', label: 'Telefono', value: C.phone, href: C.phone && `tel:${C.phone.replace(/[^\d+]/g, '')}` },
  { key: 'whatsapp', label: 'WhatsApp', value: C.whatsapp && intl(C.whatsapp), href: C.whatsapp && `https://wa.me/${C.whatsapp}` },
  {
    key: 'address',
    label: 'Sede',
    value: C.address,
    href: C.address && `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(C.address)}`,
  },
  { key: 'hours', label: 'Orari', value: C.hours },
  { key: 'instagram', label: 'Instagram', value: C.instagram && handle(C.instagram), href: C.instagram },
  { key: 'facebook', label: 'Facebook', value: C.facebook && handle(C.facebook), href: C.facebook },
]
const known = all.filter((c) => c.value)
const list = known.length ? known : all.filter((c) => ['email', 'phone', 'address'].includes(c.key))

document.querySelector('[data-channels]').innerHTML = list
  .map((c) => {
    const inner =
      `<span class="channel__icon" aria-hidden="true">${ICONS[c.key]}</span>` +
      `<span class="channel__text"><span class="mono channel__label">${c.label}</span>` +
      `<span class="channel__value">${c.value ? esc(c.value) : 'Presto disponibile'}</span></span>`
    if (!c.href) return `<div class="channel${c.value ? '' : ' is-soon'}">${inner}</div>`
    const ext = c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''
    return `<a class="channel" href="${esc(c.href)}"${ext}>${inner}<span class="channel__arrow" aria-hidden="true">&rarr;</span></a>`
  })
  .join('')

// ---------------------------------------------------------------------------
// Modulo
const form = document.querySelector('[data-cform]')
const status = form.querySelector('[data-status]')
const consentErr = form.querySelector('[data-consent-err]')
// prodotti del negozio (da WooCommerce) per la scelta nel modulo
api
  .products({ per_page: 48 })
  .then(({ products }) =>
    form.querySelector('[data-products]').insertAdjacentHTML('beforeend', products.map((p) => `<option>${esc(p.name)}</option>`).join('')),
  )
  .catch(() => {})

const RULES = {
  nome: (v) => v.trim().length > 1,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  messaggio: (v) => v.trim().length > 4,
}

function check(el) {
  const ok = RULES[el.name](el.value)
  el.closest('.field').classList.toggle('is-invalid', !ok)
  el.setAttribute('aria-invalid', String(!ok))
  return ok
}

form.addEventListener('focusout', (e) => e.target.name in RULES && e.target.value && check(e.target))
form.addEventListener('input', (e) => {
  if (e.target.closest('.field')?.classList.contains('is-invalid')) check(e.target)
  if (e.target.name === 'consenso') consentErr.style.display = 'none'
})

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const f = form.elements
  const bad = Object.keys(RULES).filter((name) => !check(f[name]))
  const consent = f.consenso.checked
  consentErr.style.display = consent ? 'none' : 'block'
  if (bad.length) return f[bad[0]].focus()
  if (!consent) return f.consenso.focus()
  if (!C.email) {
    status.textContent = 'Il modulo sarà attivo a breve: grazie per la pazienza.'
    return
  }
  const subject = `${f.tema.value}, ${f.nome.value.trim()}`
  const body = [f.messaggio.value.trim(), '', f.prodotto.value ? `Prodotto: ${f.prodotto.value}` : '', `${f.nome.value.trim()} <${f.email.value.trim()}>`]
    .filter((x, i) => x || i === 1)
    .join('\n')
  window.location.href = `mailto:${C.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  status.textContent = 'Si apre il tuo programma di posta con il messaggio pronto: premi Invia.'
})

// ---------------------------------------------------------------------------
// Sigillo: l'esagono del logo (con la N) al centro della scritta che ruota
const NS = 'http://www.w3.org/2000/svg'
const mark = document.createElementNS(NS, 'svg')
mark.setAttribute('class', 'seal__mark')
mark.setAttribute('viewBox', '0 0 258 315.8')
const hex = document.createElementNS(NS, 'path')
hex.setAttribute('d', LOGO.hex)
hex.setAttribute('fill-rule', 'evenodd')
mark.appendChild(hex)
document.querySelector('[data-seal]').appendChild(mark)

// ingresso: recapiti, modulo e sigillo nascosti da subito, salgono con i titoli
rise(document.querySelectorAll('.channel'), { y: 30, stagger: 0.07, after: ready })
rise(document.querySelectorAll('.contact__aside'), { y: 24, after: ready })
rise([form], { y: 50, after: ready })
rise([document.querySelector('[data-seal]')], { y: 0, after: ready })
