import gsap from 'gsap'
import { initPage, rise, reduced } from './common.js'
import { initDock } from './dock.js'
import { api } from '../shop/api.js'
import { cart } from '../shop/cart.js'
import { SHOP } from '../shop/config.js'
import { money, priceHtml, discountPercent } from '../shop/money.js'
import { colorVars, storyUrl, esc, availability } from '../shop/themes.js'
import { productCard, HEX } from '../shop/card.js'
import { benefitsHtml, qualityHtml } from '../shop/quality.js'
import { labelThumbHtml, openLabel, refreshLabel } from '../shop/labels.js'
import { BRAND, productBySlug, categoryFor, categoryPath } from '../seo/catalog.js'
import { faqHtml } from '../seo/render.js'
import { t, tp, onLang, translateDom, setMeta, formatNumber, formatDate, locale } from '../i18n/index.js'
import { localizeProduct, category as localCategory, shop as localShop } from '../i18n/data.js'

/*
  Pagina prodotto (/prodotto/<slug>): tutto da WooCommerce (nome, descrizioni, prezzo e offerta,
  immagini, SKU, categorie, attributi, variazioni, stock, recensioni, prodotti correlati). Il server la
  prepara gia' con i dati (motori di ricerca e anteprime social); qui diventa interattiva e si aggiorna
  con prezzi e stock freschi. Scegliendo una variante cambiano prezzo, SKU, disponibilita' e immagine.
  Offerte quantita' e metodi di pagamento sono quelli del WooCommerce condiviso (src/shop/config.js):
  gli sconti li applica WooCommerce nel carrello, qui si vedono in anticipo.
  Sotto la foto c'e' l'etichetta nella lingua del sito (miniatura con la bandierina, src/shop/labels.js).
  Lingua del sito (src/i18n): testi e dati di WooCommerce si mostrano tradotti (base = dati originali,
  product = gli stessi tradotti); cambiando lingua la pagina si ridisegna (quantita', variante e testo
  della recensione restano).
*/

const { lenis, ready } = initPage()
const dock = initDock()
const root = document.querySelector('[data-pp]')
const ICON = {
  minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 12h11"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v11M6.5 12h11"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.4"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
}
const PAY = { mastercard: 'Mastercard', visa: 'Visa', amex: 'American Express', paypal: 'PayPal', klarna: 'Klarna', applepay: 'Apple Pay', googlepay: 'Google Pay' }
const TIERS = [...(SHOP.quantityOffers ?? [])].sort((a, b) => a.pieces - b.pieces)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

let base = null // prodotto come arriva da WooCommerce (in italiano)
let product = null // lo stesso nella lingua del sito
let selected = {} // variante scelta: nomi e valori italiani, come nelle variazioni di WooCommerce
let qty = 1
let baseRelated = []
let related = []
let reviews = null // null = non ancora lette
let problem = null // { status, message }: prodotto non trovato o negozio che non risponde

function setProduct(p) {
  base = p
  product = localizeProduct(p)
}

function setRelated(list) {
  baseRelated = list ?? []
  related = baseRelated.map(localizeProduct)
}

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
          return `<button type="button" class="opt${out ? ' is-unavailable' : ''}" data-attr="${esc(a.name)}" data-value="${esc(value)}" aria-pressed="${selected[a.name] === value}">${esc(t(value))}${out ? ` <small>${t('esaurito')}</small>` : ''}</button>`
        })
        .join('')
      return `<fieldset class="pp__attr"><legend class="mono">${esc(t(a.name))}<b data-attr-value="${esc(a.name)}">${esc(selected[a.name] ? t(selected[a.name]) : '')}</b></legend><div class="pp__opts">${options}</div></fieldset>`
    })
    .join('')
}

function specsHtml() {
  const rows = product.attributes.filter((a) => !a.variation).map((a) => [a.name, a.values.join(', ')])
  // peso di spedizione inserito in WooCommerce (kg, come nei negozi italiani)
  const weight = Number.parseFloat(product.weight)
  if (weight > 0) rows.push([t('Peso della confezione'), `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 3 }).format(weight)} kg`])
  if (!rows.length) return ''
  return `<table class="pp__specs"><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`
}

/** Offerte quantita': le soglie di sconto di WooCommerce (il messaggio si aggiorna con la quantita'). */
function offersHtml() {
  if (!TIERS.length) return ''
  const tiers = TIERS.map(
    (tier) =>
      `<button type="button" class="tier" data-tier="${tier.pieces}" aria-pressed="false" aria-label="${esc(t('{pezzi} pezzi: {sconto}% di sconto', { pezzi: tier.pieces, sconto: tier.off }))}"><b>${t('{pezzi} pezzi', { pezzi: tier.pieces })}</b><span>&minus;${tier.off}%</span></button>`,
  ).join('')
  return `<div class="pp__offers" data-offers data-anim>
    <p class="pp__offers-k"><span class="mono">${t('Offerte quantità')}</span><small>${t('Anche prodotti diversi: conta il totale dei pezzi. Lo sconto compare nel carrello.')}</small></p>
    <div class="pp__tiers" role="group" aria-label="${esc(t('Offerte quantità'))}">${tiers}</div>
    <p class="pp__offers-msg" data-offer-msg aria-live="polite"></p>
  </div>`
}

/** Metodi di pagamento del checkout. */
function payHtml() {
  const list = (SHOP.payments ?? []).filter((k) => PAY[k])
  if (!list.length) return ''
  const items = list.map((k) => `<li class="pay pay--${k}">${k === 'mastercard' ? '<i aria-hidden="true"></i>' : ''}${PAY[k]}</li>`).join('')
  return `<div class="pp__pay mono" data-anim><span class="pp__pay-k">${ICON.lock} ${t('Pagamento sicuro')}</span><ul class="pp__pay-list" aria-label="${esc(t('Metodi di pagamento accettati'))}">${items}</ul></div>`
}

function starsHtml(value, label) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100
  return `<span class="stars" role="img" aria-label="${esc(label ?? t('{voto} su 5', { voto: value }))}"><span class="stars__on" style="width:${pct.toFixed(1)}%" aria-hidden="true">★★★★★</span><span aria-hidden="true">★★★★★</span></span>`
}

function reviewFormHtml() {
  // nel codice le stelle stanno da 5 a 1 (si vedono da 1 a 5, vedi pages.css)
  const stars = [5, 4, 3, 2, 1]
    .map((n) => `<label class="starpick__s"><input type="radio" name="voto" value="${n}" /><span aria-hidden="true">★</span><span class="sr-only">${tp(n, '{n} stella', '{n} stelle')}</span></label>`)
    .join('')
  return `<form class="rform glass" data-rform novalidate aria-labelledby="scrivi-recensione">
    <p class="mono rform__k" id="scrivi-recensione">${t('Scrivi una recensione')}</p>
    <fieldset class="rform__stars"><legend class="rform__label">${t('La tua valutazione')}</legend><div class="starpick" data-starpick>${stars}</div></fieldset>
    <div class="fgrid">
      <div class="field field--3"><input id="r-nome" name="nome" autocomplete="name" placeholder=" " required /><label for="r-nome">${t('Nome')}</label></div>
      <div class="field field--3"><input id="r-email" name="email" type="email" autocomplete="email" placeholder=" " required /><label for="r-email">${t('Email (non pubblicata)')}</label></div>
      <div class="field"><textarea id="r-testo" name="testo" rows="4" placeholder=" " required></textarea><label for="r-testo">${t('La tua recensione')}</label></div>
    </div>
    <div class="cform__hp" aria-hidden="true"><label for="r-sito">Sito web</label><input id="r-sito" name="sito" type="text" tabindex="-1" autocomplete="off" /></div>
    <button class="btn btn--sm" type="submit"><span class="btn__label">${t('Invia la recensione')}</span><span class="btn__icon" aria-hidden="true">&rarr;</span></button>
    <p class="mono rform__status" role="status" data-rstatus></p>
  </form>`
}

function reviewsSectionHtml() {
  if (product.reviewsAllowed === false) return ''
  return `<section class="pp__reviews" data-reviews data-anim aria-labelledby="recensioni">
    <div class="pp__reviews-head"><h2 class="display pp__h" id="recensioni">${t('Recensioni')}</h2><p class="pp__rating" data-rating></p></div>
    <div class="pp__reviews-grid"><div class="reviews" data-reviews-list></div>${reviewFormHtml()}</div>
  </section>`
}

/**
 * Percorso in alto (stesso aspetto di sempre): Integratori / categoria del sito, con i loro link.
 * La categoria e' quella di src/seo/catalog.js o la sottocategoria di WooCommerce con lo stesso slug.
 */
function crumbsHtml() {
  const cat = localCategory(categoryFor(product.slug, product.categories))
  const woo = product.categories.find((c) => !/nutrex/i.test(c.slug)) ?? product.categories[0]
  const second = cat ? `<a href="${categoryPath(cat.slug)}">${esc(cat.name)}</a>` : `<span>${esc(woo?.name ?? t('Prodotto'))}</span>`
  const shop = localShop()
  return `<nav class="mono pp__crumbs" aria-label="${esc(t('Percorso'))}" data-anim><a href="${shop.path}">${esc(shop.name)}</a><span aria-hidden="true">/</span>${second}</nav>`
}

function render() {
  const story = storyUrl(product.slug)
  // domande frequenti: le stesse del server (dati strutturati FAQPage) e di src/seo/catalog.js (in
  // italiano con data-i18n: le traduce translateDom qui sotto)
  const seo = productBySlug(product.slug)
  // sotto la foto: l'etichetta nella lingua del sito (le altre foto di WooCommerce solo per i prodotti senza etichetta)
  const label = labelThumbHtml(product.slug)
  // sotto la tabella delle caratteristiche: benefici, sigilli e simboli del prodotto (src/shop/quality.js)
  const specs = specsHtml()
  const quality = benefitsHtml(product.slug) + qualityHtml(product.slug)
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
          label
            ? `<div class="pp__thumbs">${label}</div>`
            : product.images.length > 1
              ? `<div class="pp__thumbs">${product.images
                  .map((img, i) => `<button type="button" class="pp__thumb" data-thumb="${i}" aria-pressed="${i === 0}" aria-label="${esc(t('Foto {n}', { n: i + 1 }))}"><img src="${esc(img.thumbnail || img.src)}" alt="" loading="lazy" /></button>`)
                  .join('')}</div>`
              : ''
        }
      </div>
      <div class="pp__info">
        ${crumbsHtml()}
        <h1 class="display pp__name" data-anim>${esc(product.name)}</h1>
        ${product.shortDescription ? `<div class="pp__summary" data-anim>${product.shortDescription}</div>` : ''}
        <div data-anim>
          <p class="pp__price" data-price></p>
          <p class="mono pp__vat">${t('IVA inclusa &middot; spedizione calcolata al pagamento')}</p>
        </div>
        <p class="mono stock" data-stock data-anim></p>
        <div class="pp__variants" data-variants data-anim>${variantsHtml()}</div>
        <div class="pp__buy" data-anim>
          <div class="qty" role="group" aria-label="${esc(t('Quantità'))}">
            <button class="icon-btn" type="button" data-step="-1" aria-label="${esc(t('Una confezione in meno'))}">${ICON.minus}</button>
            <span class="qty__n" aria-live="polite"><span data-qty>1</span></span>
            <button class="icon-btn" type="button" data-step="1" aria-label="${esc(t('Una confezione in più'))}">${ICON.plus}</button>
          </div>
          <button class="btn btn--xl pp__add" type="button" data-add>
            <span class="btn__label">${t('Aggiungi al carrello')}</span><span class="btn__icon" aria-hidden="true">+</span>
          </button>
        </div>
        <p class="pp__msg" role="status" data-msg></p>
        ${offersHtml()}
        ${payHtml()}
        ${story ? `<a class="link mono pp__story" href="${story}" data-anim>${t('Scopri il prodotto in 3D')} &rarr;</a>` : ''}
        <dl class="pp__meta mono" data-meta data-anim></dl>
      </div>
    </div>
    ${
      product.description || specs || quality
        ? `<section class="pp__details" data-anim>
            ${product.description ? `<div><h2 class="display pp__h">${t('Descrizione')}</h2><div class="pp__desc">${product.description}</div></div>` : '<div></div>'}
            ${specs || quality ? `<div><h2 class="display pp__h">${t('Caratteristiche')}</h2>${specs}${quality}</div>` : ''}
          </section>`
        : ''
    }
    ${faqHtml(seo?.faq, { attrs: 'data-anim' })}
    ${reviewsSectionHtml()}
    <section class="pp__related" data-related hidden aria-labelledby="correlati">
      <h2 class="display pp__h" id="correlati">${t('Ti potrebbero piacere')}</h2>
      <ul class="pp__related-grid" data-related-grid></ul>
    </section>`
  translateDom(root)
  // il titolo lo scrive il server (src/seo/catalog.js); senza pagina preparata dal server si mette qui
  // (in italiano: setMeta lo traduce, anche cambiando lingua)
  if (!initial?.product) setMeta({ title: seo?.title ?? `${base.name} | ${BRAND}`, ...(seo?.description ? { description: seo.description } : {}) })
  update()
  renderReviews()
  renderRelated()
}

function update() {
  const item = current()
  const isVariable = product.type === 'variable' && product.variations?.length
  const chosen = findVariation()
  const prices = chosen ? chosen.prices : product.prices
  const off = discountPercent(prices)
  // prezzo non ancora inserito in WooCommerce: niente "0,00 €"
  const hasPrice = ((isVariable && !chosen ? prices?.range?.min : null) ?? prices?.price ?? 0) > 0
  root.querySelector('[data-price]').innerHTML = hasPrice
    ? priceHtml(prices, { from: !chosen && isVariable }) + (off && (chosen || !isVariable) ? ` <span class="pp__off">−${off}%</span>` : '')
    : `<span class="amount amount--soon">${t('Prezzo in arrivo')}</span>`
  root.querySelector('.pp__vat').hidden = !hasPrice

  const stock = availability(item.stock, { quantity: true })
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
  const buyable = item.stock.inStock && item.stock.purchasable && hasPrice
  if (!add.classList.contains('is-added')) {
    if (isVariable && !chosen) label.textContent = t('Scegli una variante')
    else if (!item.stock.inStock) label.textContent = t('Esaurito')
    else if (!buyable) label.textContent = t('Presto disponibile')
    else label.textContent = t('Aggiungi al carrello')
  }
  add.disabled = (isVariable && !chosen) || !buyable

  // offerte quantita': conta anche i pezzi gia' nel carrello (come fa WooCommerce)
  const offers = root.querySelector('[data-offers]')
  if (offers) {
    offers.hidden = !buyable && !(isVariable && !chosen && hasPrice)
    const inCart = cart.count || 0
    const total = qty + inCart
    const reached = [...TIERS].reverse().find((tier) => total >= tier.pieces) ?? null
    const next = TIERS.find((tier) => total < tier.pieces) ?? null
    offers.querySelectorAll('[data-tier]').forEach((b) => b.setAttribute('aria-pressed', String(!!reached && Number(b.dataset.tier) === reached.pieces)))
    const unit = reached && prices?.price > 0 ? money(Math.round((prices.price * (100 - reached.off)) / 100), prices.currency) : ''
    const vars = {
      totale: total,
      carrello: inCart ? ` ${t('({pezzi} + {carrello} già nel carrello)', { pezzi: qty, carrello: inCart })}` : '',
      sconto: reached?.off,
      prezzo: unit,
    }
    let msg = ''
    if (!reached && next) msg = t("Con {pezzi} pezzi ottieni il <b>{sconto}%</b> di sconto su tutto l'ordine.", { pezzi: next.pieces, sconto: next.off })
    else if (reached) {
      msg = unit
        ? t("Con {totale} pezzi{carrello} hai il <b>{sconto}%</b> di sconto su tutto l'ordine: <b>{prezzo} cad.</b>", vars)
        : t("Con {totale} pezzi{carrello} hai il <b>{sconto}%</b> di sconto su tutto l'ordine.", vars)
      if (next) msg += ` &middot; ${t('con {pezzi} pezzi il {sconto}%.', { pezzi: next.pieces, sconto: next.off })}`
    }
    offers.querySelector('[data-offer-msg]').innerHTML = msg
  }

  const badges = []
  if (!item.stock.inStock) badges.push(`<span class="mono badge badge--out">${t('Esaurito')}</span>`)
  else if (item.onSale) badges.push(`<span class="mono badge badge--sale">${t('Offerta')}</span>`)
  root.querySelector('[data-badges]').innerHTML = badges.join('')

  const meta = []
  const sku = chosen?.sku ?? product.sku
  if (sku) meta.push([t('Codice'), esc(sku)])
  // categoria del sito con il suo link, stesso aspetto del testo (quella di WooCommerce, "Nutrex Lab", non dice nulla)
  const cat = localCategory(categoryFor(product.slug, product.categories))
  if (cat) meta.push([t('Categoria'), `<a href="${categoryPath(cat.slug)}">${esc(cat.name)}</a>`])
  else if (product.categories.length) meta.push([t('Categoria'), esc(product.categories.map((c) => c.name).join(', '))])
  root.querySelector('[data-meta]').innerHTML = meta.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')

  for (const [name, value] of Object.entries(selected)) {
    const el = root.querySelector(`[data-attr-value="${CSS.escape(name)}"]`)
    if (el) el.textContent = t(value)
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

/** Recensioni: media e conteggio di WooCommerce, poi l'elenco appena arriva. */
function renderReviews() {
  const box = root.querySelector('[data-reviews-list]')
  if (!box) return
  const list = reviews ?? []
  const count = product.rating?.count || list.length
  const avg = product.rating?.count ? product.rating.average : list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0
  const voto = formatNumber(avg, { decimals: 1 })
  root.querySelector('[data-rating]').innerHTML = count
    ? `${starsHtml(avg, t('{voto} su 5', { voto }))} <span>${t('<b>{voto}</b> su 5', { voto })} &middot; ${tp(count, '{n} recensione', '{n} recensioni')}</span>`
    : ''
  if (reviews === null) {
    box.innerHTML = `<p class="reviews__empty">${t('Caricamento delle recensioni…')}</p>`
    return
  }
  box.innerHTML = list.length
    ? list
        .map(
          (r) =>
            `<article class="review"><header>${starsHtml(r.rating, t('{voto} su 5', { voto: r.rating }))}<b class="review__who">${esc(r.reviewer)}</b>${r.verified ? `<span class="mono review__ok">${t('Acquisto verificato')}</span>` : ''}<time class="mono" datetime="${esc(r.date)}">${esc(formatDate(new Date(r.date)))}</time></header><div class="review__text">${r.review}</div></article>`,
        )
        .join('')
    : `<p class="reviews__empty">${t('Ancora nessuna recensione: scrivi tu la prima.')}</p>`
}

function loadReviews() {
  if (product.reviewsAllowed === false) return
  api
    .reviews(product.id)
    .then(({ reviews: list }) => {
      reviews = list ?? []
      renderReviews()
    })
    .catch(() => {
      reviews = []
      renderReviews()
    })
}

function renderRelated() {
  const sec = root.querySelector('[data-related]')
  if (!sec) return
  sec.hidden = !related.length
  sec.querySelector('[data-related-grid]').innerHTML = related
    .map((p, i) => productCard(p, i, [], { heading: 'h3', sizes: '(max-width: 1080px) 46vw, 22vw' }))
    .join('')
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
  const label = e.target.closest('[data-label]')
  if (label) return openLabel(product.slug, { name: product.name, opener: label, lenis })
  const step = e.target.closest('[data-step]')
  if (step) {
    qty = Math.max(1, qty + Number(step.dataset.step))
    return update()
  }
  const tier = e.target.closest('[data-tier]')
  if (tier) {
    // la soglia conta anche i pezzi gia' nel carrello
    qty = Math.max(1, Number(tier.dataset.tier) - (cart.count || 0))
    return update()
  }
  if (e.target.closest('[data-add]')) addToCart()
})

// stelle della recensione: si accendono fino a quella scelta
root.addEventListener('change', (e) => {
  if (e.target.name !== 'voto') return
  const v = Number(e.target.value)
  root.querySelectorAll('[data-starpick] .starpick__s').forEach((l) => l.classList.toggle('is-on', Number(l.querySelector('input').value) <= v))
})

root.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-rform]')
  if (!form) return
  e.preventDefault()
  submitReview(form)
})

// i pezzi nel carrello cambiano (anche da un'altra scheda): il messaggio delle offerte si aggiorna
cart.subscribe(() => product && root.querySelector('[data-offers]') && update())

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
  label.textContent = t('Aggiungo…')
  setMsg('')
  try {
    await cart.add(item.id, qty)
    btn.classList.add('is-added')
    label.textContent = t('Aggiunto')
    icon.textContent = '✓'
    if (!reduced) gsap.fromTo(icon, { scale: 0.3, rotation: -90 }, { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(2.6)' })
    setMsg(`${t('Aggiunto al carrello.')} <a class="link" href="/carrello">${t('Vai al carrello')}</a>`)
    dock.added(product.name)
    setTimeout(() => {
      btn.classList.remove('is-added')
      icon.textContent = '+'
      update()
    }, 1800)
  } catch (err) {
    label.textContent = t('Aggiungi al carrello')
    setMsg(esc(t(err.message)), true)
  } finally {
    btn.classList.remove('is-busy')
  }
}

async function submitReview(form) {
  const f = form.elements
  const status = form.querySelector('[data-rstatus]')
  const say = (html, error = false) => {
    status.classList.toggle('is-error', error)
    status.innerHTML = html
  }
  const voto = Number(form.querySelector('input[name="voto"]:checked')?.value || 0)
  if (!voto) return say(t('Scegli da 1 a 5 stelle.'), true)
  if (f.nome.value.trim().length < 2) {
    f.nome.focus()
    return say(t('Inserisci il tuo nome.'), true)
  }
  if (!EMAIL.test(f.email.value.trim())) {
    f.email.focus()
    return say(t('Inserisci un indirizzo email valido.'), true)
  }
  if (f.testo.value.trim().length < 5) {
    f.testo.focus()
    return say(t('Scrivi la tua recensione.'), true)
  }
  const btn = form.querySelector('[type="submit"]')
  btn.disabled = true
  say(t('Invio…'))
  try {
    const { approved } = await api.review({ product: product.id, nome: f.nome.value, email: f.email.value, voto, testo: f.testo.value, sito: f.sito.value })
    form.reset()
    root.querySelectorAll('[data-starpick] .starpick__s').forEach((l) => l.classList.remove('is-on'))
    say(approved ? t('Grazie! La tua recensione è pubblicata.') : t('Grazie! La tua recensione sarà pubblicata dopo un controllo.'))
    if (approved) loadReviews()
  } catch (err) {
    say(esc(t(err.message)), true)
  } finally {
    btn.disabled = false
  }
}

// ---------------------------------------------------------------------------
function showProblem(status, message) {
  problem = { status, message }
  root.removeAttribute('style')
  root.innerHTML =
    status === 404
      ? `<div class="alert"><p class="alert__title">${t('Prodotto non trovato')}</p><p class="alert__text">${t('Il prodotto che cerchi non c’è più o ha cambiato indirizzo.')}</p><a class="btn btn--sm" href="/integratori"><span class="btn__label">${t('Vai al negozio')}</span><span class="btn__icon" aria-hidden="true">&rarr;</span></a></div>`
      : `<div class="alert"><p class="alert__title">${t('Prodotto non disponibile')}</p><p class="alert__text">${esc(t(message || 'Il negozio non risponde in questo momento.'))}</p><button class="btn btn--sm" type="button" data-retry><span class="btn__label">${t('Riprova')}</span><span class="btn__icon" aria-hidden="true">&#8635;</span></button></div>`
  root.querySelector('[data-retry]')?.addEventListener('click', () => location.reload())
}

/** Modulo della recensione: quello che si stava scrivendo (resta cambiando lingua). */
function formState() {
  const form = root.querySelector('[data-rform]')
  if (!form) return null
  const f = form.elements
  const voto = form.querySelector('input[name="voto"]:checked')?.value ?? ''
  return { nome: f.nome.value, email: f.email.value, testo: f.testo.value, voto, focus: document.activeElement?.id || null }
}

function restoreForm(s) {
  const form = root.querySelector('[data-rform]')
  if (!s || !form) return
  const f = form.elements
  f.nome.value = s.nome
  f.email.value = s.email
  f.testo.value = s.testo
  const star = s.voto && form.querySelector(`input[name="voto"][value="${s.voto}"]`)
  if (star) {
    star.checked = true
    root.querySelectorAll('[data-starpick] .starpick__s').forEach((l) => l.classList.toggle('is-on', Number(l.querySelector('input').value) <= Number(s.voto)))
  }
  if (s.focus) document.getElementById(s.focus)?.focus({ preventScroll: true })
}

// cambio di lingua: la pagina si ridisegna nella nuova lingua (anche l'etichetta, se e' aperta)
onLang(() => {
  if (problem) return showProblem(problem.status, problem.message)
  if (!base) return
  const form = formState()
  setProduct(base)
  setRelated(baseRelated)
  render()
  restoreForm(form)
  refreshLabel({ name: product.name, opener: root.querySelector('[data-label]') })
})

function show(p) {
  setProduct(p)
  preselect()
  render()
  loadReviews()
  rise(root.querySelectorAll('[data-anim]'), { y: 34, stagger: 0.06, after: ready })
}

if (initial?.product) {
  show(initial.product)
  // prezzi, stock e correlati freschi (la pagina puo' essere in cache per qualche minuto)
  api
    .product(slug)
    .then(({ product: fresh, related: rel }) => {
      const keep = selected
      setProduct(fresh)
      selected = keep
      setRelated(rel)
      root.querySelector('[data-variants]').innerHTML = variantsHtml()
      update()
      renderReviews()
      renderRelated()
    })
    .catch(() => {})
} else if (initial && initial.status === 404) {
  showProblem(404)
} else if (slug) {
  root.innerHTML = '<div class="pp__grid"><div class="pcard__media skel" style="aspect-ratio:4/5"></div><div><div class="skel skel-line skel-line--title"></div><div class="skel skel-line"></div><div class="skel skel-line skel-line--short"></div></div></div>'
  api
    .product(slug)
    .then(({ product: p, related: rel }) => {
      setRelated(rel)
      show(p)
    })
    .catch((err) => showProblem(err.status, err.message))
} else {
  showProblem(404)
}
