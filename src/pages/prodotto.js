import gsap from 'gsap'
import { initPage, rise, reduced } from './common.js'
import { initDock } from './dock.js'
import { api } from '../shop/api.js'
import { cart } from '../shop/cart.js'
import { priceHtml, discountPercent } from '../shop/money.js'
import { colorVars, storyUrl, esc, availability } from '../shop/themes.js'

/*
  Pagina prodotto (/prodotto/<slug>): tutto da WooCommerce (nome, descrizioni, prezzo e offerta,
  immagini, SKU, categorie, attributi, variazioni, stock). Il server la prepara gia' con i dati
  (motori di ricerca e anteprime social); qui diventa interattiva e si aggiorna con prezzi e stock
  freschi. Scegliendo una variante cambiano prezzo, SKU, disponibilita' e immagine.
*/

const { ready } = initPage()
const dock = initDock()
const root = document.querySelector('[data-pp]')
const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'
const ICON = {
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12h11"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v11M6.5 12h11"/></svg>',
}

let product = null
let selected = {}
let qty = 1

const initial = (() => {
  try {
    return JSON.parse(document.getElementById('product-data')?.textContent || 'null')
  } catch {
    return null
  }
})()
const slug = initial?.slug ?? decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] ?? '')

// ---------------------------------------------------------------------------
// variazioni
const variantAttrs = () => (product?.attributes ?? []).filter((a) => a.variation && a.values.length)

function findVariation(sel = selected) {
  const attrs = variantAttrs()
  if (!product?.variations?.length || attrs.some((a) => !sel[a.name])) return null
  return product.variations.find((v) => attrs.every((a) => !v.attributes[a.name] || v.attributes[a.name] === sel[a.name])) ?? null
}

/** Cio' che si sta per comprare: la variante scelta o il prodotto semplice. */
const current = () => findVariation() ?? product

function preselect() {
  const attrs = variantAttrs()
  if (!attrs.length || !product.variations?.length) return
  const first = product.variations.find((v) => v.stock.inStock) ?? product.variations[0]
  selected = Object.fromEntries(attrs.map((a) => [a.name, first.attributes[a.name] ?? a.values[0]]))
}

// ---------------------------------------------------------------------------
// disegno
function image(img, extra = '') {
  if (!img) return `<svg class="pcard__noimg" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>`
  return `<img class="pcard__img" data-img src="${esc(img.src)}"${img.srcset ? ` srcset="${esc(img.srcset)}" sizes="(max-width: 1080px) 92vw, 46vw"` : ''} alt="${esc(img.alt || product.name)}" width="800" height="1000" decoding="async" ${extra} />`
}

function variantsHtml() {
  return variantAttrs()
    .map((a) => {
      const options = a.values
        .map((value) => {
          const v = findVariation({ ...selected, [a.name]: value })
          const out = v ? !v.stock.inStock : false
          return `<button type="button" class="opt${out ? ' is-unavailable' : ''}" data-attr="${esc(a.name)}" data-value="${esc(value)}" aria-pressed="${selected[a.name] === value}">${esc(value)}${out ? ' <small>esaurito</small>' : ''}</button>`
        })
        .join('')
      return `<fieldset class="pp__attr"><legend class="mono">${esc(a.name)}<b data-attr-value="${esc(a.name)}">${esc(selected[a.name] ?? '')}</b></legend><div class="pp__opts">${options}</div></fieldset>`
    })
    .join('')
}

function specsHtml() {
  const rows = product.attributes.filter((a) => !a.variation).map((a) => [a.name, a.values.join(', ')])
  if (product.weight) rows.push(['Peso', `${product.weight} kg`])
  if (!rows.length) return ''
  return `<table class="pp__specs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
}

function render() {
  const story = storyUrl(product.slug)
  const cat = product.categories.find((c) => !/nutrex/i.test(c.slug)) ?? product.categories[0]
  root.setAttribute('style', colorVars(product.slug))
  root.innerHTML = `
    <div class="pp__grid">
      <div class="pp__gallery" data-anim>
        <div class="pcard__media pp__media" data-media>
          <svg class="pcard__hex" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
          <svg class="pcard__hex pcard__hex--in" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
          <span class="pcard__floor" aria-hidden="true"></span>
          ${image(product.images[0], 'fetchpriority="high"')}
          <span class="badges" data-badges></span>
        </div>
        ${
          product.images.length > 1
            ? `<div class="pp__thumbs">${product.images
                .map((img, i) => `<button type="button" class="pp__thumb" data-thumb="${i}" aria-pressed="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(img.thumbnail || img.src)}" alt="" loading="lazy" /></button>`)
                .join('')}</div>`
            : ''
        }
      </div>
      <div class="pp__info">
        <nav class="mono pp__crumbs" aria-label="Percorso" data-anim><a href="/acquista">Acquista</a><span aria-hidden="true">/</span><span>${esc(cat?.name ?? 'Prodotto')}</span></nav>
        <h1 class="display pp__name" data-anim>${esc(product.name)}</h1>
        ${product.shortDescription ? `<div class="pp__summary" data-anim>${product.shortDescription}</div>` : ''}
        <div data-anim>
          <p class="pp__price" data-price></p>
          <p class="mono pp__vat">IVA inclusa &middot; spedizione calcolata al pagamento</p>
        </div>
        <p class="mono stock" data-stock data-anim></p>
        <div class="pp__variants" data-variants data-anim>${variantsHtml()}</div>
        <div class="pp__buy" data-anim>
          <div class="qty" role="group" aria-label="Quantit&agrave;">
            <button class="icon-btn" type="button" data-step="-1" aria-label="Una confezione in meno">${ICON.minus}</button>
            <span class="qty__n" aria-live="polite"><span data-qty>1</span></span>
            <button class="icon-btn" type="button" data-step="1" aria-label="Una confezione in piu'">${ICON.plus}</button>
          </div>
          <button class="btn btn--xl pp__add" type="button" data-add>
            <span class="btn__label">Aggiungi al carrello</span><span class="btn__icon" aria-hidden="true">+</span>
          </button>
        </div>
        <p class="pp__msg" role="status" data-msg></p>
        ${story ? `<a class="link mono pp__story" href="${story}" data-anim>Scopri il prodotto in 3D &rarr;</a>` : ''}
        <dl class="pp__meta mono" data-meta data-anim></dl>
      </div>
    </div>
    ${
      product.description || specsHtml()
        ? `<section class="pp__details" data-anim>
            ${product.description ? `<div><h2 class="display pp__h">Descrizione</h2><div class="pp__desc">${product.description}</div></div>` : '<div></div>'}
            ${specsHtml() ? `<div><h2 class="display pp__h">Caratteristiche</h2>${specsHtml()}</div>` : ''}
          </section>`
        : ''
    }`
  document.title = `${product.name} | Nutrex Lab`
  update()
}

function update() {
  const item = current()
  const isVariable = product.type === 'variable' && product.variations?.length
  const chosen = findVariation()
  const prices = chosen ? chosen.prices : product.prices
  const off = discountPercent(prices)
  root.querySelector('[data-price]').innerHTML =
    priceHtml(prices, { from: !chosen && isVariable }) + (off && (chosen || !isVariable) ? ` <span class="pp__off">−${off}%</span>` : '')

  const stock = availability(item.stock)
  const stockEl = root.querySelector('[data-stock]')
  stockEl.className = `mono stock stock--${stock.tone}`
  stockEl.textContent = stock.text

  // limiti della quantita' (WooCommerce: stock disponibile, venduto singolarmente)
  const max = Math.max(1, item.addToCart?.max ?? 9999)
  if (qty > max) qty = max
  root.querySelector('[data-qty]').textContent = qty
  root.querySelector('[data-step="-1"]').disabled = qty <= 1
  root.querySelector('[data-step="1"]').disabled = qty >= max

  const add = root.querySelector('[data-add]')
  const label = add.querySelector('.btn__label')
  if (!add.classList.contains('is-added')) {
    if (isVariable && !chosen) label.textContent = 'Scegli una variante'
    else if (!item.stock.inStock) label.textContent = 'Esaurito'
    else label.textContent = 'Aggiungi al carrello'
  }
  add.disabled = (isVariable && !chosen) || !item.stock.inStock || !item.stock.purchasable

  const badges = []
  if (!item.stock.inStock) badges.push('<span class="mono badge badge--out">Esaurito</span>')
  else if (item.onSale) badges.push('<span class="mono badge badge--sale">Offerta</span>')
  root.querySelector('[data-badges]').innerHTML = badges.join('')

  const meta = []
  const sku = chosen?.sku ?? product.sku
  if (sku) meta.push(['Codice', sku])
  if (product.categories.length) meta.push(['Categoria', product.categories.map((c) => c.name).join(', ')])
  root.querySelector('[data-meta]').innerHTML = meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')

  for (const [name, value] of Object.entries(selected)) {
    const el = root.querySelector(`[data-attr-value="${CSS.escape(name)}"]`)
    if (el) el.textContent = value
  }
  // la variante ha una sua foto: si cambia l'immagine con una dissolvenza
  const img = (chosen?.images?.[0] ?? product.images[0]) || null
  const el = root.querySelector('[data-img]')
  if (img && el && el.getAttribute('src') !== img.src) swapImage(img)
}

function swapImage(img) {
  const media = root.querySelector('[data-media]')
  const el = root.querySelector('[data-img]')
  media.classList.add('is-swapping')
  setTimeout(() => {
    el.src = img.src
    if (img.srcset) el.srcset = img.srcset
    else el.removeAttribute('srcset')
    el.alt = img.alt || product.name
    media.classList.remove('is-swapping')
  }, reduced ? 0 : 200)
  root.querySelectorAll('[data-thumb]').forEach((b) => b.setAttribute('aria-pressed', String(product.images[b.dataset.thumb]?.src === img.src)))
}

// ---------------------------------------------------------------------------
// interazioni
root.addEventListener('click', async (e) => {
  const opt = e.target.closest('.opt')
  if (opt) {
    selected = { ...selected, [opt.dataset.attr]: opt.dataset.value }
    root.querySelector('[data-variants]').innerHTML = variantsHtml()
    setMsg('')
    return update()
  }
  const thumb = e.target.closest('[data-thumb]')
  if (thumb) return swapImage(product.images[Number(thumb.dataset.thumb)])
  const step = e.target.closest('[data-step]')
  if (step) {
    qty = Math.max(1, qty + Number(step.dataset.step))
    return update()
  }
  if (e.target.closest('[data-add]')) addToCart()
})

function setMsg(html, error = false) {
  const el = root.querySelector('[data-msg]')
  if (!el) return
  el.innerHTML = html
  el.classList.toggle('is-error', error)
}

async function addToCart() {
  const item = current()
  const btn = root.querySelector('[data-add]')
  const label = btn.querySelector('.btn__label')
  const icon = btn.querySelector('.btn__icon')
  btn.classList.add('is-busy')
  label.textContent = 'Aggiungo…'
  setMsg('')
  try {
    await cart.add(item.id, qty)
    btn.classList.add('is-added')
    label.textContent = 'Aggiunto'
    icon.textContent = '✓'
    if (!reduced) gsap.fromTo(icon, { scale: 0.3, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.6)' })
    setMsg('Aggiunto al carrello. <a class="link" href="/carrello">Vai al carrello</a>')
    dock.added(product.name)
    setTimeout(() => {
      btn.classList.remove('is-added')
      icon.textContent = '+'
      update()
    }, 1800)
  } catch (err) {
    label.textContent = 'Aggiungi al carrello'
    setMsg(esc(err.message), true)
  } finally {
    btn.classList.remove('is-busy')
  }
}

// ---------------------------------------------------------------------------
function showProblem(status, message) {
  root.removeAttribute('style')
  root.innerHTML =
    status === 404
      ? `<div class="alert"><p class="alert__title">Prodotto non trovato</p><p class="alert__text">Il prodotto che cerchi non c'e' piu' o ha cambiato indirizzo.</p><a class="btn btn--sm" href="/acquista"><span class="btn__label">Vai al negozio</span><span class="btn__icon" aria-hidden="true">&rarr;</span></a></div>`
      : `<div class="alert"><p class="alert__title">Prodotto non disponibile</p><p class="alert__text">${esc(message || 'Il negozio non risponde in questo momento.')}</p><button class="btn btn--sm" type="button" data-retry><span class="btn__label">Riprova</span><span class="btn__icon" aria-hidden="true">&#8635;</span></button></div>`
  root.querySelector('[data-retry]')?.addEventListener('click', () => location.reload())
}

function show(p) {
  product = p
  preselect()
  render()
  rise(root.querySelectorAll('[data-anim]'), { y: 34, stagger: 0.06, after: ready })
}

if (initial?.product) {
  show(initial.product)
  // prezzi e stock freschi (la pagina puo' essere in cache per qualche minuto)
  api
    .product(slug)
    .then(({ product: fresh }) => {
      const keep = selected
      product = fresh
      selected = keep
      root.querySelector('[data-variants]').innerHTML = variantsHtml()
      update()
    })
    .catch(() => {})
} else if (initial && initial.status === 404) {
  showProblem(404)
} else if (slug) {
  root.innerHTML = '<div class="pp__grid"><div class="pcard__media skel" style="aspect-ratio:4/5"></div><div><div class="skel skel-line skel-line--title"></div><div class="skel skel-line"></div><div class="skel skel-line skel-line--short"></div></div></div>'
  api
    .product(slug)
    .then(({ product: p }) => show(p))
    .catch((err) => showProblem(err.status, err.message))
} else {
  showProblem(404)
}
