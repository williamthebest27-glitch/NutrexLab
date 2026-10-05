import { initPage, rise } from './common.js'

/*
  Pagine legali (Note legali, Privacy Policy, Cookie Policy, Termini e condizioni, Spedizioni e resi):
  i testi sono nei rispettivi file HTML; qui solo la struttura comune e l'ingresso delle sezioni.
*/

const { ready } = initPage()

rise(document.querySelectorAll('[data-rise]'), { y: 24, stagger: 0.04, after: ready })
