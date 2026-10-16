import { PRODUCTS as CATALOG, productPath } from './catalog.js'
import { AREAS, BOTANICALS, FAQ, FORMULAS, IMAGES, NUTRIENTS, SOURCES, areasOf, benefitsCount, claimGroups, joinClaims, nrvPercent, publishedClaims } from './benefici.js'
import { crumbsHtml, faqHtml, esc } from './render.js'

/*
  Contenuto della pagina Benefici (<!-- benefici:pagina --> in benefici.html, vite.config.js), gia'
  nell'HTML: lo leggono motori di ricerca e assistenti AI senza JavaScript, e nelle altre lingue lo
  traduce la build (elementi data-i18n).
  Come la homepage, la pagina parla di un prodotto alla volta. Nell'HTML ci sono tutti: per ogni
  prodotto la sua parte della hero e la sua "vista" ([data-view]: benefici area per area, formula,
  uso). Il browser (src/pages/benefici.js) mostra quello scelto nel menu PRODOTTI o in ?prodotto= e,
  cambiando prodotto, cambia barattolo 3D, colori e contenuti. Senza JavaScript le viste si vedono tutte.
  Le indicazioni sulla salute sono solo quelle pubblicabili della matrice (src/seo/benefici.js): autorizzate
  per vitamine e minerali, delle linee guida ministeriali per gli estratti vegetali (segnalate come tali).
  Prezzo e disponibilita' li scrive il browser con i dati di WooCommerce ([data-price], [data-stock]).
*/

const HEX = 'M7.2 2.5h11.6l5.6 9.5-5.6 9.5H7.2L1.6 12z'
const hex = (cls) => `<svg class="${cls}" viewBox="0 0 26 24" aria-hidden="true"><path d="${HEX}" /></svg>`
const pad = (n) => String(n).padStart(2, '0')
const hidden = (i) => (i ? ' hidden' : '')
/** Esagono del marchio, grande e sottile, dietro al barattolo nelle sezioni (gira piano). */
const jarHex = `<svg class="bx-jarhex" viewBox="0 0 26 24" aria-hidden="true" focusable="false"><path d="${HEX}" /></svg>`

/** Versione delle foto (public/images/benefici): cambiala quando le sostituisci, la cache si aggiorna. */
const PHOTOS_V = 2

/**
 * Foto in due misure (telefono 720 px, schermi grandi 1200 px), testo alternativo tradotto; focus: la parte da
 * tenere in vista quando la cornice la ritaglia (AREAS).
 */
function photo(name, { cls, sizes, eager = false, focus }) {
  const src = (suffix) => `/images/benefici/${name}${suffix}.webp?v=${PHOTOS_V}`
  const at = focus ? ` data-focus="${focus}"` : ''
  return `<img class="${cls}" src="${src('')}" srcset="${src('-m')} 720w, ${src('')} 1200w" sizes="${sizes}" width="1200" height="1600" alt="${esc(IMAGES[name])}" data-i18n-attr="alt"${at} loading="${eager ? 'eager' : 'lazy'}" decoding="async" />`
}

const catalogOf = (slug) => CATALOG.find((p) => p.slug === slug)

/** Spazio del barattolo 3D (src/pages/benefici.js): senza WebGL ci va la foto del barattolo. */
const slot = (f, cls = '') =>
  `<div class="bx-slot${cls}" data-jar-slot="${f.slug}" aria-hidden="true"><img class="bx-slot__fallback" src="/images/prodotti/${f.slug}.webp" alt="" width="800" height="1000" loading="lazy" decoding="async" hidden /></div>`

/*
  Motivo scientifico della hero: anelli esagonali (molecole) collegati da filamenti sottili, attorno al
  barattolo. Solo decorazione (aria-hidden); si disegna e gira piano (src/styles/benefici.css).
*/
function molecules() {
  const ring = (cx, cy, r, i) => {
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k + Math.PI / 6
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
    })
    const d = `M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`
    const dots = pts.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" />`).join('')
    return `<g class="bx-mol" style="--i:${i}"><path pathLength="1" d="${d}" />${dots}</g>`
  }
  const links = [
    [458, 154, 512, 222],
    [146, 438, 92, 382],
    [512, 222, 548, 318],
    [92, 382, 70, 290],
  ]
  return `<svg class="bx-orbit" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
            <g class="bx-orbit__spin">
              <circle class="bx-orbit__ring" cx="300" cy="300" r="262" pathLength="1" />
              <circle class="bx-orbit__ring bx-orbit__ring--in" cx="300" cy="300" r="214" pathLength="1" />
              ${ring(458, 154, 30, 0)}${ring(146, 438, 26, 1)}${ring(548, 318, 18, 2)}${ring(70, 290, 16, 3)}
              ${links.map(([a, b, c, d], i) => `<line class="bx-orbit__link" style="--i:${i}" pathLength="1" x1="${a}" y1="${b}" x2="${c}" y2="${d}" />`).join('')}
            </g>
          </svg>`
}

/** Parte della hero di un prodotto: categoria, nome, frase, benefici (aree come link), prezzo e acquisto. */
function heroProduct(f, i) {
  const c = catalogOf(f.slug)
  const areas = areasOf(f).map((key) => AREAS.find((a) => a.key === key)) // (prima l'area principale del prodotto)
  const chips = areas.length
    ? `<ul class="bx-hp__areas" data-reveal data-delay="0.25">${areas.map((a) => `<li><a class="chip" href="#benefici-${f.slug}-${a.key}" data-i18n>${esc(a.name)}</a></li>`).join('')}</ul>`
    : ''
  return `<div class="bx-hp" data-view="${f.slug}"${hidden(i)}>
            <p class="mono bx-hp__meta" data-reveal><span class="bx-hp__idx">${pad(i + 1)} / ${pad(FORMULAS.length)}</span><span data-i18n>${esc(f.kicker)}</span></p>
            <h2 class="display bx-hp__name"><span data-split="lines" data-i18n data-woo-name>${esc(c.name)}</span></h2>
            <p class="bx-hp__headline" data-reveal data-delay="0.15" data-i18n>${esc(f.headline)}</p>
            <p class="mono bx-hp__count" data-reveal data-delay="0.2"><b data-count="${benefitsCount(f)}">${benefitsCount(f)}</b> <span data-i18n>benefici</span></p>
            ${chips}
            <div class="bx-hp__buy" data-reveal data-delay="0.35">
              <a class="btn btn--xl bx-hp__cta" href="${productPath(f.slug)}" data-magnetic><span class="btn__label" data-i18n>Acquista ora</span><span class="btn__icon" aria-hidden="true">&rarr;</span></a>
              <p class="bx-hp__price"><span class="price" data-price></span><span class="mono stock bx-stock" data-stock aria-live="polite"></span></p>
            </div>
            <a class="link mono bx-hp__more" href="#benefici-${f.slug}" data-reveal data-delay="0.45"><span data-i18n>Esplora i benefici</span> &darr;</a>
          </div>`
}

function hero() {
  return `<section class="bx-hero" aria-labelledby="bx-title">
        <div class="bx-hero__copy">
          ${crumbsHtml([['Home', '/'], ['Benefici', '/benefici']], { className: 'mono eyebrow', hex: true, attrs: 'data-reveal' })}
          <p class="mono bx-hero__kicker" data-reveal data-delay="0.1" data-i18n>La scienza del benessere, visibile.</p>
          <h1 class="display bx-hero__title" id="bx-title" aria-label="Il benessere, in ogni sua forma." data-i18n-attr="aria-label">
            <span><span data-split="chars" aria-hidden="true" data-i18n>Il benessere,</span></span>
            <span><span data-split="chars" data-delay="0.12" aria-hidden="true" data-i18n>in ogni sua forma</span>${hex('hexdot')}</span>
          </h1>
          <div class="bx-hero__products">
          ${FORMULAS.map(heroProduct).join('\n          ')}
          </div>
        </div>
        <div class="bx-hero__stage">
          ${molecules()}
          ${FORMULAS.map((f, i) => `<figure class="bx-hero__photo" data-view="${f.slug}"${hidden(i)}>${photo(f.image, { cls: 'bx-hero__img', sizes: '(max-width: 1023px) 80vw, 30vw', eager: !i })}</figure>`).join('\n          ')}
          ${slot(FORMULAS[0], ' bx-slot--hero')}
        </div>
      </section>`
}

/**
 * Un ingrediente in un gruppo: nutriente e % VNR (o estratto vegetale), tutte le sue indicazioni consentite in
 * una frase (joinClaims), condizioni d'uso se servono.
 */
function claimItem(f, same) {
  const [c] = same
  const cond = same
    .filter((x) => x.condition)
    .map((x) => `<p class="bx-claim__cond" data-i18n>${esc(x.condition.text)}</p>`)
    .join('')
  const text = `<p class="bx-claim__text"><span data-i18n>${esc(joinClaims(same.map((x) => x.it)))}</span>.</p>${cond}`
  if (c.b) {
    return `<li class="bx-claim bx-claim--plant"><p class="mono bx-claim__tag"><span data-i18n>${esc(BOTANICALS[c.b].name)}</span> <b class="bx-claim__kind" data-i18n>Estratto vegetale</b></p>${text}</li>`
  }
  const pct = nrvPercent(f, c.n)
  return `<li class="bx-claim"><p class="mono bx-claim__tag"><span data-i18n>${esc(NUTRIENTS[c.n].name)}</span> <b data-count="${pct}">${pct.toLocaleString('it-IT')}</b><span data-i18n>% VNR</span></p>${text}</li>`
}

/** Punti di forza del prodotto (dall'etichetta, nessun effetto sulla salute). */
const featureList = (f) =>
  `<ul class="bx-features" data-reveal>${f.features.map((x) => `<li class="bx-feature">${hex('bx-feature__hex')}<span data-i18n>${esc(x)}</span></li>`).join('')}</ul>`

/**
 * Benefici di una formula: un gruppo per area di benessere (foto dell'area e indicazioni), poi le altre; in ogni
 * gruppo un ingrediente compare una volta.
 */
function benefits(f) {
  const c = catalogOf(f.slug)
  const claims = publishedClaims(f)
  const id = `benefici-${f.slug}`
  const eyebrow = `<p class="mono eyebrow bx-view__eyebrow" data-reveal>${hex('')}<span data-i18n data-woo-name>${esc(c.name)}</span></p>`
  if (!claims.length) {
    return `<section class="bx-benefits bx-benefits--features" id="${id}" aria-labelledby="${id}-t">
            <div class="bx-benefits__jar">${jarHex}${slot(f, ' bx-slot--side')}</div>
            <div class="bx-benefits__body">
              <header class="bx-head">
                ${eyebrow}
                <h2 class="display bx-head__title" id="${id}-t"><span data-split="chars" data-i18n>I punti di forza</span>${hex('hexdot')}</h2>
                <p class="bx-head__lead" data-reveal data-i18n>Cosa rende unica questa formula, dall’etichetta.</p>
              </header>
              ${featureList(f)}
            </div>
          </section>`
  }
  // gruppi nell'ordine delle indicazioni del prodotto: prima la sua area principale, in fondo le altre
  const all = claimGroups(f)
  const groups = all.filter((g) => g.area).map((g) => ({ ...g, area: AREAS.find((a) => a.key === g.area) }))
  const rest = all.find((g) => !g.area)
  const total = all.length
  const items = (ingredients) => ingredients.map((same) => claimItem(f, same)).join('')
  const group = ({ area, ingredients }, i) => `<section class="bx-group" id="${id}-${area.key}" aria-labelledby="${id}-${area.key}-t">
                <figure class="bx-group__media">${photo(area.image, { cls: 'bx-group__img', sizes: '(max-width: 1023px) 92vw, 26vw', focus: area.focus })}</figure>
                <div class="bx-group__body">
                  <p class="mono bx-group__n" data-reveal>${pad(i + 1)} / ${pad(total)}</p>
                  <h3 class="display bx-group__title" id="${id}-${area.key}-t" data-reveal data-i18n>${esc(area.name)}</h3>
                  <p class="bx-group__tagline" data-reveal data-i18n>${esc(area.tagline)}</p>
                  <ul class="bx-claims" data-reveal>${items(ingredients)}</ul>
                </div>
              </section>`
  const more = rest
    ? `<section class="bx-group bx-group--more" id="${id}-altre" aria-labelledby="${id}-altre-t">
                <div class="bx-group__body">
                  <p class="mono bx-group__n" data-reveal>${pad(total)} / ${pad(total)}</p>
                  <h3 class="display bx-group__title" id="${id}-altre-t" data-reveal data-i18n>Altre indicazioni autorizzate</h3>
                  <ul class="bx-claims" data-reveal>${items(rest.ingredients)}</ul>
                </div>
              </section>`
    : ''
  const features = f.features?.length
    ? `<section class="bx-group bx-group--more" id="${id}-forza" aria-labelledby="${id}-forza-t">
                <div class="bx-group__body">
                  <h3 class="display bx-group__title" id="${id}-forza-t" data-reveal data-i18n>I punti di forza</h3>
                  ${featureList(f)}
                </div>
              </section>`
    : ''
  const nutrients = claims.some((x) => x.n)
    ? `<p class="bx-fine" data-reveal data-i18n>Indicazioni autorizzate dal Reg. (UE) 432/2012 per i nutrienti presenti almeno al 15% del valore nutritivo di riferimento nella dose giornaliera.</p>`
    : ''
  const plants = claims.some((x) => x.b)
    ? `<p class="bx-fine" data-reveal data-i18n>Estratti vegetali: effetti fisiologici delle linee guida del Ministero della Salute, in attesa della valutazione dell’Unione europea.</p>`
    : ''
  return `<section class="bx-benefits" id="${id}" aria-labelledby="${id}-t">
            <div class="bx-benefits__jar">${jarHex}${slot(f, ' bx-slot--side')}</div>
            <div class="bx-benefits__body">
              <header class="bx-head">
                ${eyebrow}
                <h2 class="display bx-head__title" id="${id}-t"><span data-split="chars" data-i18n>Le aree del benessere</span>${hex('hexdot')}</h2>
                <p class="bx-head__lead" data-reveal data-i18n>Tutti i benefici di questa formula, area per area, con le indicazioni consentite dalla normativa.</p>
              </header>
              <div class="bx-groups">
              ${groups.map(group).join('\n              ')}
              ${more}
              ${features}
              </div>
              ${nutrients}
              ${plants}
            </div>
          </section>`
}

/** Tabella "Cosa contiene" (per dose giornaliera, dall'etichetta). */
function ingredientsTable(f) {
  const rows = f.ingredients
    .map(([name, amount, nrv]) => {
      const pct = nrv != null ? `<b data-count="${nrv}">${nrv.toLocaleString('it-IT')}</b><span data-i18n>% VNR</span>` : '<span aria-hidden="true">&ndash;</span>'
      return `<tr><th scope="row" data-i18n>${esc(name)}</th><td class="mono" data-i18n>${esc(amount)}</td><td class="mono bx-ing__nrv">${pct}</td></tr>`
    })
    .join('')
  return `<table class="bx-ing" data-reveal>
                <caption class="mono bx-block__h"><span data-i18n>Cosa contiene</span> <span class="bx-block__note" data-i18n>per dose giornaliera</span></caption>
                <tbody>${rows}</tbody>
              </table>`
}

/** Formula: cosa contiene, come funziona, come si usa, link al prodotto. */
function inside(f) {
  const id = `formula-${f.slug}`
  const how = f.how
    ? `<div class="bx-block" data-reveal><h3 class="mono bx-block__h" data-i18n>Come funziona</h3><p class="bx-block__text" data-i18n>${esc(f.how)}</p></div>`
    : ''
  const warn = f.warnings ? `<p class="bx-warn"><b class="mono" data-i18n>Da sapere</b> <span data-i18n>${esc(f.warnings)}</span></p>` : ''
  return `<section class="bx-inside" id="${id}" aria-labelledby="${id}-t">
            <div class="bx-inside__body">
              <header class="bx-head">
                <p class="mono eyebrow" data-reveal>${hex('')}<span data-i18n>Cosa c’è dentro</span></p>
                <h2 class="display bx-head__title" id="${id}-t"><span data-split="chars" data-i18n>La formula</span>${hex('hexdot')}</h2>
                <p class="bx-head__lead" data-reveal data-i18n>${esc(f.formula)}</p>
              </header>
              ${ingredientsTable(f)}
              ${how}
              <div class="bx-block" data-reveal>
                <h3 class="mono bx-block__h" data-i18n>Come si usa</h3>
                <p class="bx-block__text" data-i18n>${esc(f.dose)}</p>
                ${warn}
              </div>
              <div class="bx-cta" data-reveal>
                <a class="btn" href="${productPath(f.slug)}" data-magnetic><span class="btn__label" data-i18n>Scopri il prodotto</span><span class="btn__icon" aria-hidden="true">&rarr;</span></a>
                <p class="mono stock bx-stock" data-stock aria-live="polite"></p>
              </div>
            </div>
            <div class="bx-inside__jar">${jarHex}${slot(f, ' bx-slot--side')}</div>
          </section>`
}

/** Vista di un prodotto: benefici e formula. */
function view(f, i) {
  return `<article class="bx-view" data-view="${f.slug}" aria-label="${esc(catalogOf(f.slug).name)}" data-i18n-attr="aria-label"${hidden(i)}>
          ${benefits(f)}
          ${inside(f)}
        </article>`
}

function methodSection() {
  const rules = [
    [
      'Solo indicazioni consentite',
      'Per vitamine e minerali usiamo le indicazioni autorizzate dal Reg. (UE) 432/2012, con la loro formulazione; per gli estratti vegetali gli effetti delle linee guida del Ministero della Salute, in attesa della valutazione europea.',
    ],
    [
      'Solo in quantità significativa',
      'Un’indicazione su vitamine e minerali vale se il nutriente è presente almeno al 15% del valore nutritivo di riferimento nella dose giornaliera, e se sono rispettate le sue condizioni d’uso.',
    ],
    [
      'Nessuna promessa',
      'Gli integratori non curano né prevengono malattie e non garantiscono risultati. Non sostituiscono una dieta varia ed equilibrata e uno stile di vita sano.',
    ],
  ]
  return `<section class="bx-method" id="metodo" aria-labelledby="metodo-t" data-nav-dark>
        <svg class="bx-method__cap" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0Q50 20 100 0V10.6H0z" /></svg>
        <div class="bx-method__body">
          <header class="bx-head">
            <p class="mono eyebrow" data-reveal>${hex('')}<span data-i18n>Metodo</span></p>
            <h2 class="display bx-head__title" id="metodo-t"><span data-split="chars" data-i18n>Come scriviamo i benefici</span>${hex('hexdot')}</h2>
          </header>
          <ol class="bx-rules">${rules
            .map(
              ([t, d], i) =>
                `<li class="bx-rule" data-rise><span class="mono bx-rule__n">${pad(i + 1)}</span><h3 class="bx-rule__t" data-i18n>${esc(t)}</h3><p class="bx-rule__d" data-i18n>${esc(d)}</p></li>`,
            )
            .join('')}</ol>
          <div class="bx-sources" data-rise>
            <h3 class="mono bx-sources__t" data-i18n>Fonti</h3>
            <ul>${Object.values(SOURCES)
              .map(
                (s) =>
                  `<li><a class="link" href="${esc(s.url)}" target="_blank" rel="noopener"><span data-i18n>${esc(s.name)}</span></a><span class="mono" data-i18n>${esc(s.note)}</span></li>`,
              )
              .join('')}</ul>
          </div>
        </div>
      </section>`
}

/** Contenuto di <main> della pagina Benefici. */
export function beneficiMain() {
  return `${hero()}

      <div class="bx-views" data-views>
        ${FORMULAS.map(view).join('\n        ')}
      </div>

      ${methodSection()}

      <div class="bx-end">
        ${faqHtml(FAQ, { id: 'domande', attrs: 'data-rise' })}
        <div class="bx-end__cta" data-rise>
          <p class="display bx-end__title" data-i18n>Trova la tua formula.</p>
          <a class="btn btn--xl" href="/integratori" data-magnetic><span class="btn__label" data-i18n>Tutti gli integratori</span><span class="btn__icon" aria-hidden="true">&rarr;</span></a>
        </div>
      </div>`
}
