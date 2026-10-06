/*
  Recapiti della pagina Contatti (null = non mostrato) e negozi online dove si trovano i prodotti.
  Prodotti, prezzi, stock, spedizioni, tasse e pagamenti non stanno qui: li gestisce WooCommerce.
*/
export const SHOP = {
  contacts: {
    email: 'info@nutrexlab.it',
    phone: '+39 333 719 2623',
    whatsapp: '393337192623', // numero internazionale senza spazi ne' +: pulsante "Scrivici su WhatsApp"
    address: null, // es. 'Via Roma 1, 00100 Roma (RM)'
    hours: null, // es. 'Dal lunedi' al venerdi', 9:00 - 18:00'
    instagram: null, // indirizzo completo del profilo
    facebook: null,
  },
  // "Dove vendiamo" (pagina Contatti): url = link al negozio, null = solo il nome
  marketplaces: {
    amazon: 'https://www.amazon.it/stores/page/E1F09FA2-E05D-49B3-AD2A-0B2F35D69BDF',
    tiktok: null,
    temu: null,
  },
  /*
    Offerte quantita': le stesse del WooCommerce condiviso, che le applica da solo nel carrello (prezzo
    scontato di ogni prodotto) contando il totale dei pezzi, anche di prodotti diversi. Qui servono solo
    per mostrarle: se cambiano su WooCommerce, vanno cambiate anche qui.
  */
  quantityOffers: [
    { pieces: 2, off: 5 },
    { pieces: 4, off: 10 },
    { pieces: 10, off: 15 },
  ],
  // metodi di pagamento attivi nel checkout di WooCommerce (icone nella pagina prodotto e nel carrello)
  payments: ['mastercard', 'visa', 'amex', 'paypal', 'klarna', 'applepay', 'googlepay'],
}
