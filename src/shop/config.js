/*
  Impostazioni del negozio: prezzi, spedizione, pagamento e recapiti.
  Tutti i valori sono qui, in un solo posto. Finche' un valore e' null il sito non lo inventa:
  mostra "Prezzo in arrivo", "Da definire" o nasconde il recapito.
*/
export const SHOP = {
  currency: 'EUR',

  /** prezzi in euro IVA inclusa (es. 24.9), per id del prodotto (src/products.js) */
  prices: {
    collagene: null,
    'collagene-marino-compresse': null,
    'collagene-bovino': null,
    bromelina: null,
    ashwagandha: null,
    'coenzima-q10': null,
    'd-mannosio': null,
    diosmina: null,
    magnesio: null,
    'vitamina-b12': null,
    'vitamina-c': null,
    'vitamina-d3-k2': null,
  },

  shipping: {
    /** spedizione standard in euro (0 = gratuita, null = da definire) */
    cost: null,
    /** spedizione gratuita da questo subtotale in euro (null = nessuna soglia) */
    freeFrom: null,
    /** tempi di consegna, es. '24/48 ore lavorative' (null = non indicati) */
    time: null,
  },

  payments: {
    /** true quando il pagamento online e' collegato a un circuito (es. Stripe, PayPal) */
    active: false,
    /** metodi mostrati nella pagina Pagamenti */
    methods: [
      { id: 'carta', name: 'Carta di credito o debito', note: 'Pagamento con carta' },
      { id: 'paypal', name: 'PayPal', note: 'Con il tuo conto PayPal' },
      { id: 'bonifico', name: 'Bonifico bancario', note: "Spedizione all'arrivo del bonifico" },
    ],
  },

  /** recapiti della pagina Contatti (null = non mostrato) */
  contacts: {
    email: null, // es. 'info@nutrexlab.it'
    phone: null, // es. '+39 333 123 4567'
    whatsapp: null, // numero internazionale senza spazi ne' +, es. '393331234567'
    address: null, // es. 'Via Roma 1, 00100 Roma (RM)'
    hours: null, // es. 'Dal lunedi' al venerdi', 9:00 - 18:00'
    instagram: null, // indirizzo completo del profilo
    facebook: null,
  },
}
