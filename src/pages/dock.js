import { cart } from '../shop/cart.js'
import { colorVars, pieces, esc } from '../shop/themes.js'
import { t, onLang } from '../i18n/index.js'

/*
  Carrello sempre a portata (Acquista, pagina prodotto): pillola scura in basso con le foto dei
  prodotti scelti. Compare se nel carrello c'e' qualcosa, si nasconde sopra il footer; dopo
  un'aggiunta per un attimo dice cosa e' stato aggiunto.
*/
export function initDock() {
  const dock = document.querySelector('[data-dock]')
  if (!dock) return { added() {} }
  const thumbs = dock.querySelector('[data-dock-thumbs]')
  const label = dock.querySelector('[data-dock-label]')
  const what = dock.querySelector('[data-dock-what]')
  let footerIn = false
  let flash = null
  let timer = 0

  function render() {
    const n = cart.count
    const on = n > 0 && !footerIn
    dock.classList.toggle('is-on', on)
    dock.inert = !on
    label.textContent = flash ? t('Aggiunto al carrello') : t('Carrello')
    what.textContent = flash ?? pieces(n)
    const items = cart.state?.items ?? []
    thumbs.innerHTML = items
      .slice(-3)
      .map((i) => `<span class="dock__thumb" style="${colorVars(i.slug)}">${i.image ? `<img src="${esc(i.image.thumbnail || i.image.src)}" alt="" loading="lazy" />` : ''}</span>`)
      .join('')
  }

  cart.subscribe(render)
  onLang(render)
  const footer = document.querySelector('[data-footer]')
  if (footer) {
    new IntersectionObserver(([e]) => {
      footerIn = e.isIntersecting
      render()
    }).observe(footer)
  }
  render()
  if (cart.count > 0 && !cart.state) cart.load().catch(() => {})

  return {
    /** Dopo un'aggiunta: il nome del prodotto per un paio di secondi e un piccolo sobbalzo. */
    added(name) {
      flash = name
      render()
      dock.classList.remove('is-bump')
      void dock.offsetWidth
      dock.classList.add('is-bump')
      clearTimeout(timer)
      timer = setTimeout(() => {
        flash = null
        render()
      }, 2400)
    },
  }
}
