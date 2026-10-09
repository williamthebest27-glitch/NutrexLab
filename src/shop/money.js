import { lang, locale, t } from '../i18n/index.js'

/*
  Importi del negozio: arrivano da WooCommerce in centesimi (unita' minori) con le impostazioni di
  valuta del negozio (simbolo, separatori, posizione): qui si scrivono come li scrive WooCommerce.
*/

const EUR = { code: 'EUR', minorUnit: 2, decimalSep: ',', thousandSep: '.', prefix: '', suffix: ' €' }

/** 4490 -> "44,90 €" (con la valuta di WooCommerce; nelle altre lingue nel loro formato: "€44.90"). */
export function money(minor, currency = EUR) {
  if (minor === null || minor === undefined || Number.isNaN(Number(minor))) return ''
  const c = { ...EUR, ...currency }
  const d = Number(c.minorUnit ?? 2)
  const value = Math.abs(Number(minor)) / 10 ** d
  if (lang() !== 'it') {
    const text = new Intl.NumberFormat(locale(), { style: 'currency', currency: c.code || 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }).format(value)
    return Number(minor) < 0 ? `−${text}` : text
  }
  const [int, dec] = value.toFixed(d).split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, c.thousandSep ?? '.')
  const text = `${c.prefix ?? ''}${grouped}${d > 0 ? `${c.decimalSep ?? ','}${dec}` : ''}${c.suffix ?? ''}`
  return Number(minor) < 0 ? `−${text}` : text
}

/** Prezzo con eventuale prezzo pieno barrato (HTML). prices: { price, regular, range } */
export function priceHtml(prices, { from = true } = {}) {
  if (!prices) return ''
  const c = prices.currency
  if (prices.range && from) {
    return `<span class="amount">${t('da {prezzo}', { prezzo: money(prices.range.min, c) })}</span>`
  }
  const onSale = prices.regular != null && prices.price != null && prices.price < prices.regular
  return onSale
    ? `<del class="amount amount--old">${money(prices.regular, c)}</del> <ins class="amount amount--sale">${money(prices.price, c)}</ins>`
    : `<span class="amount">${money(prices.price, c)}</span>`
}

/** Sconto in percentuale (per il bollino "Offerta"). */
export function discountPercent(prices) {
  if (!prices || prices.regular == null || prices.price == null || prices.regular <= 0 || prices.price >= prices.regular) return 0
  return Math.round((1 - prices.price / prices.regular) * 100)
}
