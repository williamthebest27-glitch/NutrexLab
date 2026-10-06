import { colorVars, productUrl, pad, esc, availability } from './themes.js'
import { discountPercent } from './money.js'

/*
  Scheda di un prodotto, la stessa nella griglia Acquista e tra i prodotti correlati della pagina
  prodotto: foto con l'esagono del marchio, bollini, nome, riga breve, disponibilita' e pulsante.
  Niente prezzi: si vedono nella pagina del prodotto, dove si sceglie la variante.
*/

export const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'

function badges(p, categories) {
  const out = []
  const cat = p.categories.find((c) => categories.some((k) => k.id === c.id))
  if (cat) out.push(`<span class="mono badge">${esc(cat.name)}</span>`)
  if (!p.stock.inStock) out.push('<span class="mono badge badge--out">Esaurito</span>')
  else if (p.onSale) {
    const off = p.type === 'variable' ? 0 : discountPercent(p.prices)
    out.push(`<span class="mono badge badge--sale">${off ? `−${off}%` : 'Offerta'}</span>`)
  } else if (p.stock.low) out.push('<span class="mono badge badge--low">Ultimi pezzi</span>')
  return `<span class="badges">${out.join('')}</span>`
}

/**
 * HTML della scheda (un <li class="pcard">). categories: le sottocategorie del negozio, per il bollino.
 * heading: livello del titolo (h2 nella griglia, h3 tra i correlati).
 */
export function productCard(p, i, categories = [], { heading = 'h2', sizes = '(max-width: 767px) 46vw, (max-width: 1240px) 30vw, 22vw' } = {}) {
  const name = esc(p.name)
  const url = productUrl(p.slug)
  const img = p.images[0]
  const stock = availability(p.stock)
  const picture = img
    ? `<img class="pcard__img" src="${esc(img.src)}"${img.srcset ? ` srcset="${esc(img.srcset)}" sizes="${sizes}"` : ''} alt="${esc(img.alt || p.name)}" width="800" height="1000" loading="lazy" decoding="async" />`
    : `<svg class="pcard__noimg" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>`
  return `<li class="pcard${p.stock.inStock ? '' : ' is-soldout'}" id="p-${esc(p.slug)}" data-cats="${p.categories.map((c) => c.id).join(',')}" style="${colorVars(p.slug)}">
    <a class="pcard__media" href="${url}" aria-label="${name}">
      <svg class="pcard__hex" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
      <svg class="pcard__hex pcard__hex--in" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}"/></svg>
      <span class="pcard__floor" aria-hidden="true"></span>
      ${picture}
      <span class="mono pcard__idx" aria-hidden="true">${pad(i + 1)}</span>
      ${badges(p, categories)}
    </a>
    <div class="pcard__body">
      <${heading} class="display pcard__name"><a href="${url}">${name}</a></${heading}>
      ${p.summary ? `<p class="pcard__line">${esc(p.summary)}</p>` : ''}
      <div class="pcard__foot">
        <p class="mono stock stock--${stock.tone}">${esc(stock.text)}</p>
        <a class="btn btn--sm pcard__cta" href="${url}">
          <span class="btn__label">Scopri</span><span class="btn__icon" aria-hidden="true">&rarr;</span>
        </a>
      </div>
    </div>
  </li>`
}
