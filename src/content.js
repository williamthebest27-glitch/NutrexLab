/*
  Testi del sito per ogni prodotto (stessa struttura per tutti).
  Fonti: etichette di stampa e notifiche al Ministero della Salute di ogni prodotto.
  Le indicazioni sulla salute sono solo quelle riportate in etichetta o autorizzate
  (Reg. UE 432/2012) per i nutrienti presenti almeno al 15% del VNR: non aggiungerne altre.

  Campi:
  meta      titolo della pagina e descrizione
  hero      nome e frase sotto IL TUO, pulsante, etichetta accessibile della freccia
  about     sipario "Ingrediente principale": titolo su due righe, testo e frase sui benefici (claim):
            scorrendo il testo esce e al suo posto entra la frase, mentre il barattolo si avvicina
  tags      tre caratteristiche sotto "Puro. Semplice. Efficace."
  pins      dettagli agganciati al barattolo: [titolo, testo] (punti in products.js, geo)
  ing       tabella degli ingredienti (value + unit, nrv = % VNR oppure note = testo)
  sci       sezione scienza: titolo in due parti, testo, frase in evidenza, tre dati
  daily     la durata effettiva della confezione (duration: sezione La durata) e tre dati sull'uso
            quotidiano (facts: dosi e bicchiere d'acqua della sezione del bicchiere, src/main.js)
  experience  (facoltativo) testi propri della sezione del bicchiere, al posto di quelli presi da
            daily: pins.water = [titolo, testo, evidenziato] sulla dose del giorno
  shop      pulsante finale e riga sotto
*/

const VNR_NOTE = 'VNR: valori nutritivi di riferimento giornalieri per adulti, Reg. (UE) 1169/2011.'

const PILL_PINS = {
  cap: ['Tappo a strappo', 'Aletta di apertura'],
  band: ['Sigillo di garanzia', "Integro fino all'apertura"],
}
const SCREW_PINS = {
  cap: ['Tappo a vite', 'Presa zigrinata'],
  band: ['Anello di garanzia', "Integro fino all'apertura"],
}
const QUALITY_PIN = ['GMP / ISO 9001', 'Standard di qualità']

export const COPY = {
  collagene: {
    meta: {
      title: 'Collagene Marino | Nutrex Lab',
      description:
        'Collagene marino idrolizzato di tipo I con vitamina C, acido ialuronico, coenzima Q10 e biotina. 10.000 mg in ogni misurino. Prodotto in Italia.',
    },
    hero: {
      name: 'Collagene marino.',
      line: 'Pensato per il tuo benessere di ogni giorno.',
      cta: 'Scopri il collagene',
      down: 'Scopri il collagene marino',
    },
    about: {
      title: 'Collagene<br>marino',
      copy: 'Collagene idrolizzato di tipo I da pesce: 10.000&nbsp;mg in ogni misurino. Con acido ialuronico, coenzima Q10 e biotina.',
      claim: 'Zinco e biotina contribuiscono al mantenimento di una pelle normale.',
    },
    tags: ['Gusto neutro', 'Senza glutine', 'Senza lattosio'],
    pins: {
      cap: ['Tappo zigrinato', 'HDPE, presa sicura'],
      band: ['Sigillo di garanzia', "Integro fino all'apertura"],
      dose: ['10.000 mg', 'Collagene per dose'],
      gmp: QUALITY_PIN,
    },
    ing: {
      intro: 'Otto attivi in ogni misurino da 10&nbsp;g.',
      hero: { name: 'Collagene marino', sub: 'Idrolizzato, tipo I', value: 10000, unit: 'mg' },
      items: [
        { name: 'Vitamina C', value: 232, unit: 'mg', nrv: 290 },
        { name: 'Acido ialuronico', value: 145, unit: 'mg', note: 'Sodio ialuronato' },
        { name: 'Coenzima Q10', value: 29, unit: 'mg', note: 'Ubichinone' },
        { name: 'Zinco', value: 29, unit: 'mg', nrv: 290 },
        { name: 'Vitamina E', value: 35, unit: 'mg', nrv: 290 },
        { name: 'Riboflavina (B2)', value: 4.1, decimals: 1, unit: 'mg', nrv: 293 },
        { name: 'Biotina', value: 145, unit: 'µg', nrv: 290 },
      ],
      note: VNR_NOTE,
    },
    sci: {
      a: 'La tripla',
      b: 'elica.',
      copy: "Il collagene è formato da tre catene proteiche avvolte in un'unica elica. L'idrolisi lo scompone in piccoli peptidi.",
      claim: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione della pelle.',
      data: [
        { label: 'Collagene per dose', value: 10000, unit: 'mg' },
        { label: 'Vitamina C', value: 290, unit: '% VNR' },
        { label: 'Origine', text: 'Tipo I', unit: 'Marino' },
      ],
    },
    daily: {
      duration: { value: 50, unit: 'giorni', text: 'In ogni barattolo da 500 g, con un misurino da 10 g al giorno' },
      facts: [
        { value: 10, unit: 'g', text: 'Un misurino raso' },
        { value: 1, unit: 'bicchiere', text: "D'acqua, una volta al giorno" },
        { value: 50, unit: 'giorni', text: 'In ogni barattolo da 500 g' },
      ],
    },
    shop: { cta: 'Acquista il collagene', meta: '500 g. Gusto neutro. Prodotto in Italia.' },
  },

  bromelina: {
    meta: {
      title: 'Bromelina Alto Dosaggio | Nutrex Lab',
      description:
        'Bromelina alto dosaggio in compresse gastroresistenti: 500 mg di bromelina e 1875 GDU di attività enzimatica in ogni compressa. 180 compresse, prodotto in Italia.',
    },
    hero: {
      name: 'Bromelina alto dosaggio.',
      line: '1875 GDU in ogni compressa gastroprotetta.',
      cta: 'Scopri la bromelina',
      down: 'Scopri la bromelina',
    },
    about: {
      title: "Bromelina<br>dall'ananas",
      copy: 'Due bromeline titolate, a 5000 e 2500&nbsp;GDU/g: 500&nbsp;mg in ogni compressa, protetti da un rivestimento gastroresistente.',
      claim: 'Compresse gastroresistenti, con rivestimento a base di alginato e HPMC, da assumere lontano dai pasti.',
    },
    tags: ['Gastroprotetta', 'Senza glutine', 'Senza lattosio'],
    pins: { ...PILL_PINS, dose: ['Alto dosaggio', '1875 GDU per compressa'], gmp: QUALITY_PIN },
    ing: {
      intro: 'Due bromeline titolate in ogni compressa da 700&nbsp;mg.',
      hero: { name: 'Bromelina', sub: 'Attività enzimatica per compressa', value: 1875, unit: 'GDU' },
      items: [
        { name: 'Bromelina 5000 GDU/g', value: 250, unit: 'mg', note: '1250 GDU' },
        { name: 'Bromelina 2500 GDU/g', value: 250, unit: 'mg', note: '625 GDU' },
        { name: 'Bromelina totale', value: 500, unit: 'mg', note: 'Per compressa' },
      ],
      note: "GDU: unità di attività enzimatica. Rivestimento gastroresistente a base di alginato e HPMC.",
    },
    sci: {
      a: 'Enzimi',
      b: "dell'ananas.",
      copy: "La bromelina è un insieme di enzimi proteolitici dell'ananas. La sua forza non si misura in milligrammi, ma in GDU: unità di attività enzimatica.",
      claim: 'Prima settimana due compresse al giorno, poi una: lontano dai pasti, con un bicchiere d’acqua.',
      data: [
        { label: 'Attività enzimatica', value: 1875, unit: 'GDU' },
        { label: 'Bromelina per compressa', value: 500, unit: 'mg' },
        { label: 'Titolo', value: 5000, unit: 'GDU/g' },
      ],
    },
    daily: {
      duration: { value: 24, unit: 'settimane', text: 'Oltre 170 giorni: due compresse al giorno la prima settimana, poi una' },
      facts: [
        { value: 2, unit: 'compresse', text: 'Al giorno nella prima settimana' },
        { value: 1, unit: 'compressa', text: 'Al giorno per il mantenimento' },
        { value: 6, unit: 'mesi', text: 'Fino a sei mesi di fornitura' },
      ],
    },
    // sezione del bicchiere: sopra le due compresse della prima settimana, evidenziato
    experience: { pins: { water: ['2 compresse la prima settimana', "Al giorno, con un bicchiere d'acqua", true] } },
    shop: { cta: 'Acquista la bromelina', meta: '180 compresse gastroprotette. Prodotto in Italia.' },
  },

  ashwagandha: {
    meta: {
      title: 'Ashwagandha KSM-66 | Nutrex Lab',
      description:
        'Ashwagandha certificata KSM-66®: 600 mg di estratto secco di radice titolato al 5% in withanolidi in ogni compressa. 180 compresse, sei mesi di fornitura.',
    },
    hero: {
      name: 'Ashwagandha KSM-66®.',
      line: 'Pensata per il tuo benessere psicofisico.',
      cta: "Scopri l'ashwagandha",
      down: "Scopri l'ashwagandha",
    },
    about: {
      title: 'Ashwagandha<br>KSM-66®',
      copy: 'Estratto secco di radice di <i>Withania somnifera</i>, titolato al 5% in withanolidi: 600&nbsp;mg di KSM-66® in ogni compressa.',
      claim: "L'ashwagandha svolge un'azione tonico-adattogena e favorisce il rilassamento e il benessere mentale.",
    },
    tags: ['KSM-66®', 'Prodotto vegano', 'Senza glutine'],
    pins: { ...PILL_PINS, dose: ['KSM-66®', 'Estratto di radice certificato'], gmp: QUALITY_PIN },
    ing: {
      intro: 'Un solo attivo, titolato, in ogni compressa.',
      hero: { name: 'Ashwagandha KSM-66®', sub: 'Estratto secco di radice', value: 600, unit: 'mg' },
      items: [{ name: 'Withanolidi', value: 30, unit: 'mg', note: 'Titolo 5%' }],
      note: 'Withania somnifera (L.) Dunal, estratto secco di radice. Quantità per 1 compressa.',
    },
    sci: {
      a: 'Radice',
      b: 'adattogena.',
      copy: "KSM-66® è un estratto secco di radice di ashwagandha (Withania somnifera), standardizzato al 5% in withanolidi.",
      claim: "L'ashwagandha favorisce il rilassamento, il benessere mentale e il benessere psicofisico.",
      data: [
        { label: 'Estratto per dose', value: 600, unit: 'mg' },
        { label: 'Withanolidi', value: 30, unit: 'mg' },
        { label: 'Titolo', value: 5, unit: '%' },
      ],
    },
    daily: {
      duration: { value: 6, unit: 'mesi', text: '180 compresse, una al giorno' },
      facts: [
        { value: 1, unit: 'compressa', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 600, unit: 'mg', text: 'Di KSM-66® per dose' },
        { value: 6, unit: 'mesi', text: 'In ogni flacone da 180 compresse' },
      ],
    },
    shop: { cta: "Acquista l'ashwagandha", meta: '180 compresse. Prodotto vegano. Prodotto in Italia.' },
  },

  'coenzima-q10': {
    meta: {
      title: 'Coenzima Q10 Cardio Premium | Nutrex Lab',
      description:
        'Coenzima Q10 Cardio Premium: 200 mg di coenzima Q10 con acetil L-carnitina, biancospino, magnesio e vitamine C, B1 e B12. 180 capsule vegetali.',
    },
    hero: {
      name: 'Coenzima Q10 Cardio Premium.',
      line: 'Con acetil L-carnitina e biancospino.',
      cta: 'Scopri il coenzima Q10',
      down: 'Scopri il coenzima Q10',
    },
    about: {
      title: 'Coenzima<br>Q10',
      copy: '200&nbsp;mg di coenzima Q10 con acetil L-carnitina, biancospino, magnesio e vitamine C, B1 e B12, in due capsule vegetali al giorno.',
      claim: 'La vitamina B1 contribuisce alla normale funzione cardiaca.',
    },
    tags: ['Capsule vegetali', 'Prodotto vegano', 'Made in Italy'],
    pins: { ...PILL_PINS, dose: ['Cardio Premium', 'Con acetil L-carnitina'], gmp: QUALITY_PIN },
    ing: {
      intro: 'Sette attivi in ogni dose da due capsule.',
      hero: { name: 'Coenzima Q10', sub: 'Ubidecarenone', value: 200, unit: 'mg' },
      items: [
        { name: 'Acetil L-carnitina', value: 300, unit: 'mg', note: 'Cloridrato' },
        { name: 'Biancospino', value: 200, unit: 'mg', note: 'E.s. titolato 1% in flavonoidi' },
        { name: 'Magnesio', value: 30, unit: 'mg', nrv: 8 },
        { name: 'Vitamina C', value: 80, unit: 'mg', nrv: 100 },
        { name: 'Vitamina B1', value: 1.1, decimals: 1, unit: 'mg', nrv: 100 },
        { name: 'Vitamina B12', value: 100, unit: 'µg', nrv: 4000 },
      ],
      note: `Quantità per 2 capsule. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Cardio',
      b: 'Premium.',
      copy: "Coenzima Q10 e acetil L-carnitina, con estratto di biancospino titolato all'1% in flavonoidi, magnesio bisglicinato e vitamine C, B1 e B12.",
      claim: "Il biancospino favorisce la regolare funzionalità dell'apparato cardiovascolare.",
      data: [
        { label: 'Coenzima Q10', value: 200, unit: 'mg' },
        { label: 'Acetil L-carnitina', value: 300, unit: 'mg' },
        { label: 'Vitamina B12', value: 4000, unit: '% VNR' },
      ],
    },
    daily: {
      duration: { value: 3, unit: 'mesi', text: '180 capsule, due al giorno' },
      facts: [
        { value: 2, unit: 'capsule', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 200, unit: 'mg', text: 'Di coenzima Q10 per dose' },
        { value: 3, unit: 'mesi', text: 'In ogni flacone da 180 capsule' },
      ],
    },
    shop: { cta: 'Acquista il coenzima Q10', meta: '180 capsule vegetali. Prodotto in Italia.' },
  },

  'collagene-bovino': {
    meta: {
      title: 'Collagene Bovino in compresse | Nutrex Lab',
      description:
        'Collagene bovino idrolizzato di tipo I in compresse: 2100 mg per dose con acido ialuronico, coenzima Q10, vitamine C ed E, zinco, rame e selenio. 180 compresse.',
    },
    hero: {
      name: 'Collagene bovino.',
      line: 'Con acido ialuronico, vitamine e minerali.',
      cta: 'Scopri il collagene',
      down: 'Scopri il collagene bovino',
    },
    about: {
      title: 'Collagene<br>bovino',
      copy: 'Collagene idrolizzato di tipo I: 2100&nbsp;mg ogni tre compresse, con acido ialuronico, coenzima Q10, vitamine C ed E, zinco, rame e selenio.',
      claim: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione delle ossa, delle cartilagini e della pelle.',
    },
    tags: ['Senza glutine', 'Senza lattosio', 'Stabilimento GMP'],
    pins: { ...PILL_PINS, dose: ['Acido ialuronico', '100 mg per dose'], gmp: ['GMP', 'Stabilimento certificato'] },
    ing: {
      intro: 'Dieci attivi in ogni dose da tre compresse.',
      hero: { name: 'Collagene bovino', sub: 'Idrolizzato, tipo I', value: 2100, unit: 'mg' },
      items: [
        { name: 'Vitamina C', value: 80, unit: 'mg', nrv: 100 },
        { name: 'Acido ialuronico', value: 100, unit: 'mg', note: 'Sodio ialuronato' },
        { name: 'Coenzima Q10', value: 10, unit: 'mg' },
        { name: 'Zinco', value: 10, unit: 'mg', nrv: 100 },
        { name: 'Vitamina E', value: 12, unit: 'mg', nrv: 100 },
        { name: 'Riboflavina (B2)', value: 1.4, decimals: 1, unit: 'mg', nrv: 100 },
        { name: 'Biotina', value: 50, unit: 'µg', nrv: 100 },
        { name: 'Rame', value: 1, unit: 'mg', nrv: 100 },
        { name: 'Selenio', value: 55, unit: 'µg', nrv: 100 },
      ],
      note: `Quantità per 3 compresse. ${VNR_NOTE}`,
    },
    sci: {
      a: 'La tripla',
      b: 'elica.',
      copy: "Il collagene di tipo I è formato da tre catene proteiche avvolte in un'unica elica. Idrolizzato, è scomposto in piccoli peptidi.",
      claim: 'Il rame contribuisce al mantenimento di tessuti connettivi normali.',
      data: [
        { label: 'Collagene per dose', value: 2100, unit: 'mg' },
        { label: 'Rame', value: 100, unit: '% VNR' },
        { label: 'Origine', text: 'Tipo I', unit: 'Bovino' },
      ],
    },
    daily: {
      duration: { value: 2, unit: 'mesi', text: '180 compresse, tre al giorno: 60 giorni' },
      facts: [
        { value: 3, unit: 'compresse', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 2100, unit: 'mg', text: 'Di collagene per dose' },
        { value: 180, unit: 'compresse', text: 'In ogni flacone' },
      ],
    },
    shop: { cta: 'Acquista il collagene', meta: '180 compresse. Senza glutine e lattosio. Prodotto in Italia.' },
  },

  'collagene-marino-compresse': {
    meta: {
      title: 'Collagene Marino in compresse | Nutrex Lab',
      description:
        'Collagene marino idrolizzato di tipo I in compresse: 3000 mg per dose con acido ialuronico, coenzima Q10, vitamina C, zinco e biotina. 180 compresse.',
    },
    hero: {
      name: 'Collagene marino in compresse.',
      line: 'Il tuo rituale, in tre compresse al giorno.',
      cta: 'Scopri il collagene',
      down: 'Scopri il collagene marino in compresse',
    },
    about: {
      title: 'Collagene<br>marino',
      copy: 'Collagene idrolizzato di tipo I da pesce: 3000&nbsp;mg ogni tre compresse, con acido ialuronico, coenzima Q10, zinco e biotina.',
      claim: 'Zinco e biotina contribuiscono al mantenimento di una pelle normale.',
    },
    tags: ['Senza glutine', 'Senza lattosio', 'GMP / ISO 9001'],
    pins: { ...PILL_PINS, dose: ['Acido ialuronico', '100 mg per dose'], gmp: QUALITY_PIN },
    ing: {
      intro: 'Otto attivi in ogni dose da tre compresse.',
      hero: { name: 'Collagene marino', sub: 'Idrolizzato, tipo I, da pesce', value: 3000, unit: 'mg' },
      items: [
        { name: 'Vitamina C', value: 80, unit: 'mg', nrv: 100 },
        { name: 'Acido ialuronico', value: 100, unit: 'mg', note: 'Sodio ialuronato' },
        { name: 'Coenzima Q10', value: 10, unit: 'mg' },
        { name: 'Zinco', value: 10, unit: 'mg', nrv: 100 },
        { name: 'Vitamina E', value: 12, unit: 'mg', nrv: 100 },
        { name: 'Riboflavina (B2)', value: 1.4, decimals: 1, unit: 'mg', nrv: 100 },
        { name: 'Biotina', value: 50, unit: 'µg', nrv: 100 },
      ],
      note: `Quantità per 3 compresse. ${VNR_NOTE}`,
    },
    sci: {
      a: 'La tripla',
      b: 'elica.',
      copy: "Il collagene è formato da tre catene proteiche avvolte in un'unica elica. L'idrolisi lo scompone in piccoli peptidi.",
      claim: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione della pelle.',
      data: [
        { label: 'Collagene per dose', value: 3000, unit: 'mg' },
        { label: 'Vitamina C', value: 100, unit: '% VNR' },
        { label: 'Origine', text: 'Tipo I', unit: 'Marino' },
      ],
    },
    daily: {
      duration: { value: 2, unit: 'mesi', text: '180 compresse, tre al giorno: 60 giorni' },
      facts: [
        { value: 3, unit: 'compresse', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 3000, unit: 'mg', text: 'Di collagene per dose' },
        { value: 180, unit: 'compresse', text: 'In ogni flacone' },
      ],
    },
    shop: { cta: 'Acquista il collagene', meta: '180 compresse. Senza glutine e lattosio. Prodotto in Italia.' },
  },

  'd-mannosio': {
    meta: {
      title: 'D-Mannosio Uro Care | Nutrex Lab',
      description:
        'D-Mannosio Uro Care: 2400 mg di D-mannosio per dose con cranberry, uva ursina, fermenti lattici vivi e vitamina C. 180 compresse, prodotto in Italia.',
    },
    hero: {
      name: 'D-Mannosio Uro Care.',
      line: 'Con cranberry, uva ursina e probiotici.',
      cta: 'Scopri il D-mannosio',
      down: 'Scopri il D-mannosio',
    },
    about: {
      title: 'D-Mannosio<br>Uro Care',
      copy: '2400&nbsp;mg di D-mannosio in tre compresse, con cranberry titolato al 30% in PAC, uva ursina, due fermenti lattici vivi e vitamina C.',
      claim: 'Il cranberry e l’uva ursina favoriscono la funzionalità delle vie urinarie e il drenaggio dei liquidi corporei.',
    },
    tags: ['Con probiotici', 'Senza glutine', 'Senza lattosio'],
    pins: { ...PILL_PINS, dose: ['Uro Care', 'Con probiotici'], gmp: QUALITY_PIN },
    ing: {
      intro: 'Sei attivi in ogni dose da tre compresse.',
      hero: { name: 'D-Mannosio', sub: 'Per dose da 3 compresse', value: 2400, unit: 'mg' },
      items: [
        { name: 'Cranberry e.s.', value: 300, unit: 'mg', note: 'Titolato al 30% in PAC' },
        { name: 'Uva ursina e.s.', value: 200, unit: 'mg', note: 'Titolato al 10%' },
        { name: 'L. rhamnosus SGL06', value: 100, unit: 'mg', note: 'Fermenti lattici vivi, 1 miliardo' },
        { name: 'L. reuteri SGL01', value: 100, unit: 'mg', note: 'Fermenti lattici vivi, 1 miliardo' },
        { name: 'Vitamina C', value: 80, unit: 'mg', nrv: 100 },
      ],
      note: `Quantità per 3 compresse. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Uro',
      b: 'Care.',
      copy: 'Il D-mannosio è uno zucchero semplice. In ogni dose è insieme agli estratti di cranberry e uva ursina, a due ceppi di fermenti lattici vivi e alla vitamina C.',
      claim: 'La vitamina C contribuisce alla normale funzione del sistema immunitario e alla protezione delle cellule dallo stress ossidativo.',
      data: [
        { label: 'D-mannosio per dose', value: 2400, unit: 'mg' },
        { label: 'Cranberry e.s.', value: 300, unit: 'mg' },
        { label: 'Vitamina C', value: 100, unit: '% VNR' },
      ],
    },
    daily: {
      duration: { value: 2, unit: 'mesi', text: '180 compresse, tre al giorno: 60 giorni' },
      facts: [
        { value: 3, unit: 'compresse', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 2400, unit: 'mg', text: 'Di D-mannosio per dose' },
        { value: 2, unit: 'mesi', text: 'In ogni flacone da 180 compresse' },
      ],
    },
    shop: { cta: 'Acquista il D-mannosio', meta: '180 compresse. Con probiotici. Prodotto in Italia.' },
  },

  diosmina: {
    meta: {
      title: 'Diosmina ed Esperidina 1200 | Nutrex Lab',
      description:
        'Diosmina ed Esperidina 1200: 1000 mg di diosmina e 200 mg di esperidina per dose, con estratto di semi di vite rossa, rutina e vitamina C. 180 capsule vegetali.',
    },
    hero: {
      name: 'Diosmina ed Esperidina.',
      line: '1200 mg per dose, con estratto di vite rossa.',
      cta: 'Scopri la diosmina',
      down: 'Scopri la diosmina ed esperidina',
    },
    about: {
      title: 'Diosmina<br>ed esperidina',
      copy: '1000&nbsp;mg di diosmina e 200&nbsp;mg di esperidina in due capsule vegetali, con estratto di semi di vite rossa, rutina e vitamina C.',
      claim: 'La vite rossa favorisce la funzionalità del microcircolo e contrasta la sensazione di pesantezza alle gambe.',
    },
    tags: ['Capsule vegetali', 'Prodotto vegano', 'GMP / ISO 9001'],
    pins: { ...PILL_PINS, dose: ['Esperidina', '200 mg per dose'], gmp: QUALITY_PIN },
    ing: {
      intro: 'Cinque attivi in ogni dose da due capsule.',
      hero: { name: 'Diosmina', sub: 'Per dose da 2 capsule', value: 1000, unit: 'mg' },
      items: [
        { name: 'Esperidina', value: 200, unit: 'mg' },
        { name: 'Vite rossa e.s.', value: 100, unit: 'mg', note: 'Semi, 95% in proantocianidine' },
        { name: 'Rutina', value: 50, unit: 'mg' },
        { name: 'Vitamina C', value: 80, unit: 'mg', nrv: 100 },
      ],
      note: `Quantità per 2 capsule. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Formula',
      b: '1200.',
      copy: 'Diosmina ed esperidina sono flavonoidi: 1200&nbsp;mg in ogni dose, insieme all’estratto di semi di vite rossa titolato al 95% in proantocianidine e alla rutina.',
      claim: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione dei vasi sanguigni.',
      data: [
        { label: 'Diosmina', value: 1000, unit: 'mg' },
        { label: 'Esperidina', value: 200, unit: 'mg' },
        { label: 'Vite rossa e.s.', value: 100, unit: 'mg' },
      ],
    },
    daily: {
      duration: { value: 3, unit: 'mesi', text: '180 capsule, due al giorno' },
      facts: [
        { value: 2, unit: 'capsule', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 1200, unit: 'mg', text: 'Di diosmina ed esperidina per dose' },
        { value: 3, unit: 'mesi', text: 'In ogni flacone da 180 capsule' },
      ],
    },
    shop: { cta: 'Acquista la diosmina', meta: '180 capsule vegetali. Prodotto vegano. Prodotto in Italia.' },
  },

  magnesio: {
    meta: {
      title: 'Magnesio Bisglicinato | Nutrex Lab',
      description:
        'Magnesio bisglicinato con vitamine B1, B6 e B12: 375 mg di magnesio per dose, il 100% del valore di riferimento. 180 compresse, prodotto vegano.',
    },
    hero: {
      name: 'Magnesio bisglicinato.',
      line: 'Con vitamine B1, B6 e B12, in due compresse.',
      cta: 'Scopri il magnesio',
      down: 'Scopri il magnesio bisglicinato',
    },
    about: {
      title: 'Magnesio<br>bisglicinato',
      copy: '375&nbsp;mg di magnesio da bisglicinato, il 100% del valore di riferimento, con le vitamine B1, B6 e B12 in due compresse al giorno.',
      claim: 'Il magnesio contribuisce alla normale funzione muscolare e al normale funzionamento del sistema nervoso.',
    },
    tags: ['Prodotto vegano', 'Senza glutine', 'Senza lattosio'],
    pins: { ...SCREW_PINS, dose: ['Vitamine B1, B6, B12', '100% VNR per dose'], gmp: ['Prodotto vegano', 'Senza glutine e lattosio'] },
    ing: {
      intro: 'Magnesio e tre vitamine del gruppo B in ogni dose da due compresse.',
      hero: { name: 'Magnesio', sub: 'Da bisglicinato, 100% VNR', value: 375, unit: 'mg' },
      items: [
        { name: 'Vitamina B1', value: 1.1, decimals: 1, unit: 'mg', nrv: 100 },
        { name: 'Vitamina B6', value: 1.4, decimals: 1, unit: 'mg', nrv: 100 },
        { name: 'Vitamina B12', value: 2.5, decimals: 1, unit: 'µg', nrv: 100 },
      ],
      note: `Quantità per 2 compresse. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Magnesio',
      b: 'chelato.',
      copy: "Nel bisglicinato ogni ione di magnesio è legato a due molecole di glicina, un amminoacido: una forma chelata.",
      claim: 'Il magnesio e le vitamine B6 e B12 contribuiscono alla riduzione della stanchezza e dell’affaticamento.',
      data: [
        { label: 'Magnesio per dose', value: 375, unit: 'mg' },
        { label: 'Valore di riferimento', value: 100, unit: '% VNR' },
        { label: 'Vitamine', text: 'B1 B6 B12', unit: '' },
      ],
    },
    daily: {
      duration: { value: 3, unit: 'mesi', text: '180 compresse, due al giorno' },
      facts: [
        { value: 2, unit: 'compresse', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 375, unit: 'mg', text: 'Di magnesio per dose' },
        { value: 3, unit: 'mesi', text: 'In ogni flacone da 180 compresse' },
      ],
    },
    shop: { cta: 'Acquista il magnesio', meta: '180 compresse. Prodotto vegano. Prodotto in Italia.' },
  },

  'vitamina-b12': {
    meta: {
      title: 'Vitamina B12 Metilcobalamina | Nutrex Lab',
      description:
        'Vitamina B12 come metilcobalamina: 1000 µg in una compressa al giorno. 450 compresse, oltre un anno di fornitura. Prodotto vegano.',
    },
    hero: {
      name: 'Vitamina B12.',
      line: 'Metilcobalamina, 1000 µg al giorno.',
      cta: 'Scopri la vitamina B12',
      down: 'Scopri la vitamina B12',
    },
    about: {
      title: 'Vitamina<br>B12',
      copy: 'Metilcobalamina, una delle forme naturali della vitamina B12: 1000&nbsp;µg in una piccola compressa al giorno, per oltre un anno.',
      claim: 'La vitamina B12 contribuisce alla riduzione della stanchezza e dell’affaticamento.',
    },
    tags: ['Prodotto vegano', 'Senza OGM', 'Senza glutine'],
    pins: { ...SCREW_PINS, dose: ['Metilcobalamina', '1000 µg per compressa'], gmp: ['Prodotto vegano', 'Senza OGM, glutine e lattosio'] },
    ing: {
      intro: 'Un solo attivo, nella sua forma metilata.',
      hero: { name: 'Vitamina B12', sub: 'Metilcobalamina', value: 1000, unit: 'µg' },
      items: [
        { name: 'Valore di riferimento', value: 40000, unit: '%', note: 'Per compressa' },
        { name: 'Compresse', value: 450, unit: '', note: 'Oltre un anno di fornitura' },
      ],
      note: `Quantità per 1 compressa. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Forma',
      b: 'metilata.',
      copy: 'La metilcobalamina è una delle forme naturali della vitamina B12: in ogni compressa ce n’è 400 volte il valore di riferimento giornaliero.',
      claim: 'La vitamina B12 contribuisce alla normale formazione dei globuli rossi e alla normale funzione del sistema immunitario.',
      data: [
        { label: 'B12 per compressa', value: 1000, unit: 'µg' },
        { label: 'Valore di riferimento', value: 40000, unit: '% VNR' },
        { label: 'Fornitura', value: 450, unit: 'compresse' },
      ],
    },
    daily: {
      duration: { value: 450, unit: 'giorni', text: 'Oltre 14 mesi: 450 compresse, una al giorno' },
      facts: [
        { value: 1, unit: 'compressa', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 1000, unit: 'µg', text: 'Di vitamina B12' },
        { value: 450, unit: 'compresse', text: 'Oltre un anno di fornitura' },
      ],
    },
    shop: { cta: 'Acquista la vitamina B12', meta: '450 compresse. Prodotto vegano. Prodotto in Italia.' },
  },

  'vitamina-c': {
    meta: {
      title: 'Vitamina C con Rosa Canina | Nutrex Lab',
      description:
        'Vitamina C con rosa canina e bioflavonoidi: 1000 mg per compressa, il 1250% del valore di riferimento. 180 compresse, sei mesi di fornitura.',
    },
    hero: {
      name: 'Vitamina C 1000 mg.',
      line: 'Con rosa canina e bioflavonoidi.',
      cta: 'Scopri la vitamina C',
      down: 'Scopri la vitamina C',
    },
    about: {
      title: 'Vitamina<br>C',
      copy: '1000&nbsp;mg di vitamina C per compressa: acido L-ascorbico e rosa canina titolata al 70%, con 50&nbsp;mg di bioflavonoidi da agrumi.',
      claim: 'La vitamina C contribuisce alla normale funzione del sistema immunitario.',
    },
    tags: ['Prodotto vegano', 'Senza OGM', 'Senza glutine'],
    pins: { ...SCREW_PINS, dose: ['Rosa canina', 'E bioflavonoidi da agrumi'], gmp: ['Prodotto vegano', 'Senza OGM, glutine e lattosio'] },
    ing: {
      intro: 'Vitamina C da due fonti, con i bioflavonoidi degli agrumi.',
      hero: { name: 'Vitamina C totale', sub: '1.250% VNR per compressa', value: 1000, unit: 'mg' },
      items: [
        { name: 'Acido L-ascorbico', value: 930, unit: 'mg', nrv: 1163 },
        { name: 'Rosa canina e.s.', value: 100, unit: 'mg', note: 'Titolata al 70% in vitamina C' },
        { name: 'Bioflavonoidi', value: 50, unit: 'mg', note: 'Da agrumi' },
      ],
      note: `Quantità per 1 compressa. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Doppia',
      b: 'fonte.',
      copy: 'Acido L-ascorbico e vitamina C della rosa canina, insieme ai bioflavonoidi degli agrumi.',
      claim: 'La vitamina C contribuisce alla protezione delle cellule dallo stress ossidativo.',
      data: [
        { label: 'Vitamina C totale', value: 1000, unit: 'mg' },
        { label: 'Valore di riferimento', value: 1250, unit: '% VNR' },
        { label: 'Bioflavonoidi', value: 50, unit: 'mg' },
      ],
    },
    daily: {
      duration: { value: 6, unit: 'mesi', text: '180 compresse, una al giorno' },
      facts: [
        { value: 1, unit: 'compressa', text: "Al giorno, con un bicchiere d'acqua" },
        { value: 1000, unit: 'mg', text: 'Di vitamina C per porzione' },
        { value: 6, unit: 'mesi', text: 'In ogni flacone da 180 compresse' },
      ],
    },
    shop: { cta: 'Acquista la vitamina C', meta: '180 compresse. Prodotto vegano. Prodotto in Italia.' },
  },

  'vitamina-d3-k2': {
    meta: {
      title: 'Vitamina D3 + K2 (MK-7) | Nutrex Lab',
      description:
        'Vitamina D3 + K2 (MK-7): 2000 UI di vitamina D3 e 100 µg di vitamina K2 in una compressa al giorno. 365 compresse, un anno di fornitura. Prodotto vegano.',
    },
    hero: {
      name: 'Vitamina D3 + K2.',
      line: '2000 UI e 100 µg in una compressa al giorno.',
      cta: 'Scopri la vitamina D3',
      down: 'Scopri la vitamina D3 + K2',
    },
    about: {
      title: 'Vitamina<br>D3 + K2',
      copy: 'Colecalciferolo e menachinone-7: 2000&nbsp;UI di vitamina D3 e 100&nbsp;µg di vitamina K2 in una compressa al giorno, per un anno.',
      claim: 'La vitamina D contribuisce alla normale funzione del sistema immunitario.',
    },
    tags: ['Prodotto vegano', 'Senza OGM', 'Senza glutine'],
    pins: { ...SCREW_PINS, dose: ['Vitamina K2', 'Menachinone-7 (MK-7)'], gmp: ['Prodotto vegano', 'Senza OGM, glutine e lattosio'] },
    ing: {
      intro: 'Due vitamine in ogni compressa.',
      hero: { name: 'Vitamina D3', sub: 'Colecalciferolo, 1.000% VNR', value: 2000, unit: 'UI' },
      items: [
        { name: 'Vitamina D3', value: 50, unit: 'µg', note: 'Pari a 2000 UI' },
        { name: 'Vitamina K2 (MK-7)', value: 100, unit: 'µg', nrv: 133 },
      ],
      note: `Quantità per 1 compressa. ${VNR_NOTE}`,
    },
    sci: {
      a: 'Vitamina',
      b: 'del sole.',
      copy: 'La vitamina D3 (colecalciferolo) insieme alla vitamina K2 nella forma menachinone-7 (MK-7): 2000&nbsp;UI e 100&nbsp;µg in ogni compressa.',
      claim: 'La vitamina D contribuisce al normale assorbimento e utilizzo di calcio e fosforo; la vitamina K al mantenimento di ossa normali.',
      data: [
        { label: 'Vitamina D3', value: 2000, unit: 'UI' },
        { label: 'Vitamina K2', value: 100, unit: 'µg' },
        { label: 'Valore di riferimento D3', value: 1000, unit: '% VNR' },
      ],
    },
    daily: {
      duration: { value: 12, unit: 'mesi', text: 'Un anno intero: 365 compresse, una al giorno' },
      facts: [
        { value: 1, unit: 'compressa', text: 'Al giorno, durante i pasti principali' },
        { value: 2000, unit: 'UI', text: 'Di vitamina D3 per compressa' },
        { value: 365, unit: 'compresse', text: 'Un anno di fornitura' },
      ],
    },
    shop: { cta: 'Acquista la vitamina D3 + K2', meta: '365 compresse. Prodotto vegano. Prodotto in Italia.' },
  },
}
