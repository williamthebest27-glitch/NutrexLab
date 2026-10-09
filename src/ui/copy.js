import gsap from 'gsap'
import { COPY } from '../content.js'
import { PRODUCTS } from '../products.js'
import { localize, formatNumber, t, setMeta } from '../i18n/index.js'

/*
  Mette nella pagina i testi del prodotto (src/content.js).
  Gli elementi restano gli stessi (le rivelazioni allo scroll sono gia' agganciate): cambia solo
  il contenuto. I testi divisi da SplitText vengono ripristinati, aggiornati e divisi di nuovo
  (onSplit in text.js riapplica lo stato visibile/nascosto).
*/

const $ = (s) => document.querySelector(s)
const $$ = (s) => [...document.querySelectorAll(s)]

/** Numeri nel formato della lingua del sito (10.000 in italiano, 10,000 in inglese...). */
const fmt = (value, decimals = 0) => formatNumber(value, { decimals })

/** Numero che sale fino al valore reale quando l'elemento compare (countUp in text.js). */
const num = (tag, value, decimals = 0) =>
  `<${tag} data-count="${value}"${decimals ? ` data-decimals="${decimals}"` : ''}>${fmt(value, decimals)}</${tag}>`

function setHTML(el, html) {
  if (!el) return
  const split = el._split
  if (split) {
    split.revert()
    el.innerHTML = html
    split.split()
  } else {
    el.innerHTML = html
  }
}

const pad = (n) => String(n).padStart(2, '0')

function ingredientItem(item, index) {
  const nrv =
    item.nrv != null
      ? `<span class="ing__nrv mono">${num('b', item.nrv)}${t('% VNR')}</span>`
      : item.note
        ? `<span class="ing__nrv mono">${item.note}</span>`
        : ''
  return (
    `<span class="ing__num mono">${pad(index + 2)}</span><span class="ing__name">${item.name}</span>` +
    `<span class="ing__val">${num('span', item.value, item.decimals)}<small>${item.unit}</small></span>${nrv}`
  )
}

function ingredients(ing) {
  setHTML($('.ing__intro'), ing.intro)
  const h = ing.hero
  setHTML(
    $('.ing__hero'),
    `<span class="ing__num mono">01</span><span class="ing__name">${h.name}</span>` +
      `<span class="ing__sub mono">${h.sub}</span>` +
      `<span class="ing__big">${num('b', h.value, h.decimals)}<small>${h.unit}</small></span>`,
  )
  const list = $('.ing__list')
  const slots = $$('.ing__list .ing')
  slots.forEach((li, k) => {
    const item = ing.items[k]
    li.hidden = !item
    li.innerHTML = item ? ingredientItem(item, k) : ''
  })
  list.classList.toggle('is-long', ing.items.length > 7)
  list.setAttribute('aria-label', t('Ingredienti: {lista}', { lista: [h.name, ...ing.items.map((i) => i.name)].join(', ') }))
  setHTML($('.ing__note'), ing.note)
  fitIngredients()
}

/**
 * Colonna degli ingredienti piu' alta dello spazio sullo schermo (desktop, schermi bassi o liste
 * lunghe), un passo alla volta: spaziature piu' strette, poi senza la frase introduttiva, infine
 * le note (VNR, titolo...) sulla stessa riga del nome. Su mobile la colonna cresce dal basso.
 */
const FIT_STEPS = ['is-tight', 'is-short', 'is-tighter']
export function fitIngredients() {
  const col = $('.ing__col')
  if (!col) return
  col.classList.remove(...FIT_STEPS)
  for (const step of FIT_STEPS) {
    if (col.scrollHeight <= col.clientHeight + 1) return
    col.classList.add(step)
  }
}

/**
 * Titolo della sezione Scienza (una riga per parte): se una parola e' piu' larga dello schermo (lingue con
 * parole lunghe, es. il tedesco sul telefono) quella parte si rimpicciolisce quanto basta; altrimenti resta
 * della sua misura (--fs-sci).
 */
function fitTitleWidth(el) {
  if (!el?.offsetParent) return
  el.style.removeProperty('font-size')
  const cs = getComputedStyle(el)
  const margin = parseFloat(el.classList.contains('sci__b') ? cs.right : cs.left) || 0
  const room = el.offsetParent.clientWidth - 2 * margin
  const width = el.scrollWidth
  if (width > room) el.style.fontSize = `calc(var(--fs-sci) * ${(room / width).toFixed(3)})`
}

/**
 * Sezione Scienza su mobile: ELICA. resta sopra ai testi del prodotto, che hanno lunghezze diverse
 * (altezza del blocco in --sci-text-h). Da chiamare quando cambiano i testi o lo schermo.
 */
export function fitScience() {
  fitTitleWidth($('.sci__a'))
  fitTitleWidth($('.sci__b'))
  const text = $('.sci__text')
  if (text) text.closest('.science')?.style.setProperty('--sci-text-h', `${Math.ceil(text.offsetHeight)}px`)
}

function science(sci) {
  $('.sci__title')?.setAttribute('aria-label', `${sci.a} ${sci.b}`)
  setHTML($('.sci__a'), sci.a)
  setHTML($('.sci__b'), sci.b)
  setHTML($('.sci__text .body-copy'), sci.copy)
  setHTML($('.sci__claim'), sci.claim)
  setHTML(
    $('.sci__data'),
    sci.data
      .map(
        (d) =>
          `<div><dt class="mono">${d.label}</dt><dd>${d.value != null ? num('span', d.value, d.decimals) : d.text}` +
          `${d.unit ? `<small>${d.unit}</small>` : ''}</dd></div>`,
      )
      .join(''),
  )
  fitScience()
}

/** La durata: quanto dura davvero una confezione del prodotto (giorni, settimane o mesi). */
function daily(dl) {
  const f = dl.duration
  setHTML(
    $('.daily__facts'),
    `<li><span class="daily__k">${t('Un barattolo per:')}</span><span class="daily__v">${num('b', f.value, f.decimals)}<span class="daily__u">${f.unit}</span></span><em>${f.text}</em></li>`,
  )
}

/** Riga e pulsante della hero: con animate le righe escono verso l'alto e le nuove salgono. */
function hero(h, animate) {
  const sub = $('.hero-lead__sub')
  const label = $('.hero-lead__cta .btn__label')
  const html = `<strong>${h.name}</strong>${h.line}`
  $('.hero-down')?.setAttribute('aria-label', h.down)
  if (!animate || !sub?._split) {
    setHTML(sub, html)
    if (label) label.textContent = h.cta
    return
  }
  gsap
    .timeline()
    .to(sub._split.lines, { yPercent: -112, duration: 0.45, ease: 'power3.in', stagger: 0.04 }, 0)
    .to(label, { autoAlpha: 0, x: -12, duration: 0.3, ease: 'power2.in' }, 0)
    .add(() => {
      setHTML(sub, html)
      gsap.fromTo(sub._split.lines, { yPercent: 112 }, { yPercent: 0, duration: 1.0, ease: 'expo.out', stagger: 0.08 })
      label.textContent = h.cta
      gsap.fromTo(label, { autoAlpha: 0, x: 14 }, { autoAlpha: 1, x: 0, duration: 0.8, ease: 'expo.out', clearProps: 'transform' })
    })
}

/**
 * Testi della pagina per il prodotto `id`. parts: 'all', 'top' (hero, sipario, scene 3-5: quello che
 * si vede scorrendo dalla hero) o 'rest' (ingredienti, scienza, la durata, shop). Al cambio
 * prodotto dalla hero la parte lontana si aggiorna subito dopo l'animazione, non nello stesso
 * fotogramma del nuovo barattolo (sul telefono era il fotogramma piu' lungo del cambio).
 */
export function applyCopy(id, { animate = false, parts = 'all' } = {}) {
  if (!COPY[id]) return
  const c = localize(COPY[id]) // testi nella lingua del sito (src/i18n)
  if (parts !== 'rest') applyTop(c, animate, id)
  if (parts !== 'top') applyRest(c, id)
}

/*
  Titolo e descrizione della homepage (src/seo/pages.js, gli stessi che legge Google): restano con il
  primo prodotto della linea; scegliendone un altro dal menu (o aprendo /?prodotto=...) la scheda del
  browser mostra il suo nome. Il canonical resta la homepage.
*/
const HOME_META = { title: document.title, description: $('meta[name="description"]')?.getAttribute('content') }

function applyTop(c, animate, id) {
  const home = id === PRODUCTS[0].id
  const it = COPY[id].meta // titolo e descrizione italiani: setMeta li traduce
  setMeta(home ? HOME_META : { title: it.title, description: it.description })

  hero(c.hero, animate)

  // sipario: ingrediente principale
  const title = $('.curtain__title')
  if (title) title.innerHTML = c.about.title
  setHTML($('.curtain__copy'), c.about.copy)

  // scena 3 e scena scura
  const tags = $('.s3__tags')
  if (tags) tags.innerHTML = c.tags.map((t) => `<span>${t}</span>`).join('')
  setHTML($('.s4__title'), c.inside.title)
  setHTML($('.s4__claim'), c.inside.claim)

  // dettagli agganciati al barattolo
  for (const [key, [b, text]] of Object.entries(c.pins)) {
    const el = $(`[data-pin="${key}"] .pin__text`)
    if (el) el.innerHTML = `<b>${b}</b><span>${text}</span>`
  }
}

function applyRest(c, id) {
  ingredients(c.ing)
  science(c.sci)
  daily(c.daily)

  const shopLabel = $('.shop__cta .btn__label')
  if (shopLabel) shopLabel.textContent = c.shop.cta
  // il pulsante finale porta alla pagina del prodotto mostrato (anche aperto in una nuova scheda)
  $('.shop__cta [data-buy]')?.setAttribute('href', `/prodotto/${encodeURIComponent(id)}`)
  const shopMeta = $('.shop__cta p')
  if (shopMeta) shopMeta.textContent = c.shop.meta
}
