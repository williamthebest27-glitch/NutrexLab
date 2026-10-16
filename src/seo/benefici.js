/*
  Pagina Benefici (/benefici): i contenuti scientifici, separati da quelli commerciali.
  Nomi, prezzi, disponibilita' e collegamenti dei prodotti arrivano da WooCommerce (src/pages/benefici.js,
  /api/products); nomi e righe brevi di riserva da src/seo/catalog.js. Qui solo quello che dicono le
  etichette e la normativa. Solo dati e funzioni pure: lo usano la pagina (src/seo/benefici-page.js), i test
  (tests/benefici.test.js) e la matrice per la redazione (npm run matrice-benefici -> docs/matrice-benefici.md).

  Regole (Reg. CE 1924/2006, Reg. UE 432/2012, Reg. UE 1169/2011):
  - vitamine e minerali: indicazioni autorizzate dal Reg. (UE) 432/2012, testo ufficiale; si pubblicano solo con
    stato 'verified', con il nutriente presente almeno come "fonte" (15% del VNR nella dose giornaliera
    dell'etichetta) e le condizioni d'uso specifiche rispettate;
  - estratti vegetali: indicazioni "in attesa" (on hold) a livello UE, usate con gli effetti fisiologici delle
    linee guida del Ministero della Salute (BOTANICALS), solo per piante senza indicazioni respinte nel
    registro UE e presenti nella formula;
  - 'needs_review': da verificare prima di pubblicarla, non va mai sulla pagina; 'not_applicable': nessuna
    indicazione consentita per quella sostanza. Gli stati servono alla redazione.
  - blocked: per ogni prodotto i benefici che NON si possono scrivere e perche' (respinti nel registro UE,
    quantita' sotto il 15% del VNR, frasi d'etichetta da correggere): i test controllano che non finiscano
    mai sulla pagina.
  Per i prodotti senza indicazioni consentite (bromelina) si scrivono i punti di forza del prodotto (features):
  caratteristiche dell'etichetta, nessun effetto sulla salute.

  Fonti dei dati di prodotto: le etichette di stampa (cartella prodotti/ del progetto); il collagene marino in
  polvere dall'etichetta corretta del 2026-10-16.
*/

/** Fonti ufficiali (verificate il 2026-10-16). */
export const SOURCES = {
  reg432: {
    name: 'Regolamento (UE) n. 432/2012',
    note: 'Elenco delle indicazioni sulla salute consentite',
    url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32012R0432',
  },
  reg1924: {
    name: 'Regolamento (CE) n. 1924/2006',
    note: 'Indicazioni nutrizionali e sulla salute',
    url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32006R1924',
  },
  reg1169: {
    name: 'Regolamento (UE) n. 1169/2011',
    note: 'Valori nutritivi di riferimento (allegato XIII)',
    url: 'https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32011R1169',
  },
  register: {
    name: 'Registro UE delle indicazioni nutrizionali e sulla salute',
    note: 'Commissione europea',
    url: 'https://ec.europa.eu/food/food-feed-portal/screen/health-claims/eu-register',
  },
  botanicals: {
    name: 'Sostanze e preparati vegetali negli integratori',
    note: 'Ministero della Salute, linee guida sugli effetti fisiologici',
    url: 'https://www.salute.gov.it/new/it/tema/alimenti-fini-medici-speciali-ed-integratori/sostanze-e-preparati-vegetali/',
  },
}

/** Valori nutritivi di riferimento per adulti (Reg. UE 1169/2011, all. XIII, parte A, punto 1). */
export const NUTRIENTS = {
  vitC: { name: 'Vitamina C', nrv: 80, unit: 'mg' },
  zinc: { name: 'Zinco', nrv: 10, unit: 'mg' },
  vitE: { name: 'Vitamina E', nrv: 12, unit: 'mg' },
  b2: { name: 'Riboflavina', nrv: 1.4, unit: 'mg' },
  biotin: { name: 'Biotina', nrv: 50, unit: 'µg' },
  copper: { name: 'Rame', nrv: 1, unit: 'mg' },
  selenium: { name: 'Selenio', nrv: 55, unit: 'µg' },
  mg: { name: 'Magnesio', nrv: 375, unit: 'mg' },
  b1: { name: 'Tiamina', nrv: 1.1, unit: 'mg' },
  b6: { name: 'Vitamina B6', nrv: 1.4, unit: 'mg' },
  b12: { name: 'Vitamina B12', nrv: 2.5, unit: 'µg' },
  vitD: { name: 'Vitamina D', nrv: 5, unit: 'µg' },
  vitK: { name: 'Vitamina K', nrv: 75, unit: 'µg' },
}

/** Quantita' significativa: almeno il 15% del VNR (Reg. UE 1169/2011, all. XIII, parte A, punto 2). */
export const SIGNIFICANT = 0.15

/*
  Estratti vegetali con indicazioni "in attesa" (on hold) a livello UE: si possono usare sotto la
  responsabilita' dell'operatore (art. 28, par. 5 e 6, Reg. CE 1924/2006). Gli effetti sono quelli delle
  "Linee guida ministeriali di riferimento per gli effetti fisiologici" (Ministero della Salute, DM 9 luglio
  2012, aggiornate con il parere della CUDN del 18 dicembre 2013): lgm e' il testo delle linee guida.
  Nel registro UE (consultato il 2026-10-16) queste piante non hanno indicazioni respinte.
*/
export const BOTANICALS = {
  ashwagandha: {
    name: 'Ashwagandha',
    latin: 'Withania somnifera (L.) Dunal',
    part: 'radice',
    lgm: 'Tonico-adattogeno. Tonico (stanchezza fisica, mentale). Rilassamento e benessere mentale. Naturali difese dell’organismo.',
  },
  biancospino: {
    name: 'Biancospino',
    latin: 'Crataegus spp.',
    part: 'fiori e foglie',
    lgm: 'Regolare funzionalità dell’apparato cardiovascolare. Rilassamento e benessere mentale. Antiossidante. Regolarità della pressione arteriosa.',
  },
  uvaursina: {
    name: 'Uva ursina',
    latin: 'Arctostaphylos uva-ursi (L.) Spreng.',
    part: 'foglie',
    lgm: 'Drenaggio dei liquidi corporei. Funzionalità delle vie urinarie.',
  },
}

/*
  Indicazioni usate sulla pagina.
  - n: nutriente (testo ufficiale italiano del Reg. UE 432/2012; le altre lingue sono i testi ufficiali dello
    stesso regolamento, in src/i18n/locales/<lingua>/benefici.js);
  - b: estratto vegetale (BOTANICALS); lgm: l'effetto delle linee guida da cui viene la frase.
  area: il gruppo della vista del prodotto in cui compare (nessuna = "Altre indicazioni autorizzate").
  condition: condizione d'uso specifica oltre alla quantita' significativa (min = apporto giornaliero minimo)
  e frase da mostrare insieme all'indicazione, quando la normativa la richiede.
*/
export const CLAIMS = {
  // vitamina C
  'vitC.collagene-vasi': { n: 'vitC', area: 'cuore', it: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione dei vasi sanguigni' },
  'vitC.collagene-ossa': { n: 'vitC', area: 'ossa', it: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione delle ossa' },
  'vitC.collagene-cartilagini': { n: 'vitC', area: 'ossa', it: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione delle cartilagini' },
  'vitC.denti': { n: 'vitC', area: 'ossa', it: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione dei denti' },
  'vitC.collagene-pelle': { n: 'vitC', area: 'pelle', it: 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione della pelle' },
  'vitC.immunitario': { n: 'vitC', area: 'difese', it: 'La vitamina C contribuisce alla normale funzione del sistema immunitario' },
  'vitC.immunitario-sforzo': {
    n: 'vitC',
    area: 'difese',
    it: 'La vitamina C contribuisce al mantenimento della normale funzione del sistema immunitario durante e dopo uno sforzo fisico intenso',
    condition: {
      min: 200,
      text: 'L’effetto benefico si ottiene con l’assunzione giornaliera di 200 mg di vitamina C in aggiunta all’apporto giornaliero raccomandato di vitamina C.',
    },
  },
  'vitC.energia': { n: 'vitC', area: 'energia', it: 'La vitamina C contribuisce al normale metabolismo energetico' },
  'vitC.stanchezza': { n: 'vitC', area: 'energia', it: 'La vitamina C contribuisce alla riduzione della stanchezza e dell’affaticamento' },
  'vitC.nervoso': { n: 'vitC', area: 'mente', it: 'La vitamina C contribuisce al normale funzionamento del sistema nervoso' },
  'vitC.psicologica': { n: 'vitC', area: 'mente', it: 'La vitamina C contribuisce alla normale funzione psicologica' },
  'vitC.ossidativo': { n: 'vitC', it: 'La vitamina C contribuisce alla protezione delle cellule dallo stress ossidativo' },
  'vitC.ferro': { n: 'vitC', it: 'La vitamina C accresce l’assorbimento del ferro' },
  // zinco
  'zinc.ossa': { n: 'zinc', area: 'ossa', it: 'Lo zinco contribuisce al mantenimento di ossa normali' },
  'zinc.capelli': { n: 'zinc', area: 'pelle', it: 'Lo zinco contribuisce al mantenimento di capelli normali' },
  'zinc.unghie': { n: 'zinc', area: 'pelle', it: 'Lo zinco contribuisce al mantenimento di unghie normali' },
  'zinc.pelle': { n: 'zinc', area: 'pelle', it: 'Lo zinco contribuisce al mantenimento di una pelle normale' },
  'zinc.immunitario': { n: 'zinc', area: 'difese', it: 'Lo zinco contribuisce alla normale funzione del sistema immunitario' },
  // vitamina E, riboflavina, biotina
  'vitE.ossidativo': { n: 'vitE', it: 'La vitamina E contribuisce alla protezione delle cellule dallo stress ossidativo' },
  'b2.pelle': { n: 'b2', area: 'pelle', it: 'La riboflavina contribuisce al mantenimento di una pelle normale' },
  'b2.stanchezza': { n: 'b2', area: 'energia', it: 'La riboflavina contribuisce alla riduzione della stanchezza e dell’affaticamento' },
  'biotin.capelli': { n: 'biotin', area: 'pelle', it: 'La biotina contribuisce al mantenimento di capelli normali' },
  'biotin.pelle': { n: 'biotin', area: 'pelle', it: 'La biotina contribuisce al mantenimento di una pelle normale' },
  'biotin.psicologica': { n: 'biotin', area: 'mente', it: 'La biotina contribuisce alla normale funzione psicologica' },
  // rame e selenio
  'copper.tessuti': { n: 'copper', area: 'ossa', it: 'Il rame contribuisce al mantenimento di tessuti connettivi normali' },
  'copper.pigmentazione-pelle': { n: 'copper', area: 'pelle', it: 'Il rame contribuisce alla normale pigmentazione della pelle' },
  'copper.capelli': { n: 'copper', area: 'pelle', it: 'Il rame contribuisce alla normale pigmentazione dei capelli' },
  'selenium.capelli': { n: 'selenium', area: 'pelle', it: 'Il selenio contribuisce al mantenimento di capelli normali' },
  'selenium.unghie': { n: 'selenium', area: 'pelle', it: 'Il selenio contribuisce al mantenimento di unghie normali' },
  'selenium.immunitario': { n: 'selenium', area: 'difese', it: 'Il selenio contribuisce alla normale funzione del sistema immunitario' },
  'selenium.tiroide': { n: 'selenium', it: 'Il selenio contribuisce alla normale funzione tiroidea' },
  // magnesio
  'mg.stanchezza': { n: 'mg', area: 'energia', it: 'Il magnesio contribuisce alla riduzione della stanchezza e dell’affaticamento' },
  'mg.energia': { n: 'mg', area: 'energia', it: 'Il magnesio contribuisce al normale metabolismo energetico' },
  'mg.elettrolitico': { n: 'mg', area: 'muscoli', it: 'Il magnesio contribuisce all’equilibrio elettrolitico' },
  'mg.muscoli': { n: 'mg', area: 'muscoli', it: 'Il magnesio contribuisce alla normale funzione muscolare' },
  'mg.proteica': { n: 'mg', area: 'muscoli', it: 'Il magnesio contribuisce alla normale sintesi proteica' },
  'mg.nervoso': { n: 'mg', area: 'mente', it: 'Il magnesio contribuisce al normale funzionamento del sistema nervoso' },
  'mg.psicologica': { n: 'mg', area: 'mente', it: 'Il magnesio contribuisce alla normale funzione psicologica' },
  'mg.ossa': { n: 'mg', area: 'ossa', it: 'Il magnesio contribuisce al mantenimento di ossa normali' },
  'mg.denti': { n: 'mg', area: 'ossa', it: 'Il magnesio contribuisce al mantenimento di denti normali' },
  // vitamine del gruppo B
  'b1.energia': { n: 'b1', area: 'energia', it: 'La tiamina contribuisce al normale metabolismo energetico' },
  'b1.cuore': { n: 'b1', area: 'cuore', it: 'La tiamina contribuisce alla normale funzione cardiaca' },
  'b1.nervoso': { n: 'b1', area: 'mente', it: 'La tiamina contribuisce al normale funzionamento del sistema nervoso' },
  'b1.psicologica': { n: 'b1', area: 'mente', it: 'La tiamina contribuisce alla normale funzione psicologica' },
  'b6.stanchezza': { n: 'b6', area: 'energia', it: 'La vitamina B6 contribuisce alla riduzione della stanchezza e dell’affaticamento' },
  'b6.psicologica': { n: 'b6', area: 'mente', it: 'La vitamina B6 contribuisce alla normale funzione psicologica' },
  'b6.nervoso': { n: 'b6', area: 'mente', it: 'La vitamina B6 contribuisce al normale funzionamento del sistema nervoso' },
  'b6.immunitario': { n: 'b6', area: 'difese', it: 'La vitamina B6 contribuisce alla normale funzione del sistema immunitario' },
  'b6.ormonale': { n: 'b6', it: 'La vitamina B6 contribuisce alla regolazione dell’attività ormonale' },
  'b12.energia': { n: 'b12', area: 'energia', it: 'La vitamina B12 contribuisce al normale metabolismo energetico' },
  'b12.stanchezza': { n: 'b12', area: 'energia', it: 'La vitamina B12 contribuisce alla riduzione della stanchezza e dell’affaticamento' },
  'b12.nervoso': { n: 'b12', area: 'mente', it: 'La vitamina B12 contribuisce al normale funzionamento del sistema nervoso' },
  'b12.psicologica': { n: 'b12', area: 'mente', it: 'La vitamina B12 contribuisce alla normale funzione psicologica' },
  'b12.immunitario': { n: 'b12', area: 'difese', it: 'La vitamina B12 contribuisce alla normale funzione del sistema immunitario' },
  'b12.globuli-rossi': { n: 'b12', it: 'La vitamina B12 contribuisce alla normale formazione dei globuli rossi' },
  'b12.omocisteina': { n: 'b12', it: 'La vitamina B12 contribuisce al normale metabolismo dell’omocisteina' },
  'b12.divisione': { n: 'b12', it: 'La vitamina B12 interviene nel processo di divisione delle cellule' },
  // vitamine D e K
  'vitD.calcio-fosforo': { n: 'vitD', area: 'ossa', it: 'La vitamina D contribuisce al normale assorbimento/utilizzo del calcio e del fosforo' },
  'vitD.ossa': { n: 'vitD', area: 'ossa', it: 'La vitamina D contribuisce al mantenimento di ossa normali' },
  'vitD.denti': { n: 'vitD', area: 'ossa', it: 'La vitamina D contribuisce al mantenimento di denti normali' },
  'vitD.muscoli': { n: 'vitD', area: 'muscoli', it: 'La vitamina D contribuisce al mantenimento della normale funzione muscolare' },
  'vitD.immunitario': { n: 'vitD', area: 'difese', it: 'La vitamina D contribuisce alla normale funzione del sistema immunitario' },
  'vitD.calcemia': { n: 'vitD', it: 'La vitamina D contribuisce a normali livelli di calcio nel sangue' },
  'vitD.divisione': { n: 'vitD', it: 'La vitamina D interviene nel processo di divisione delle cellule' },
  'vitK.ossa': { n: 'vitK', area: 'ossa', it: 'La vitamina K contribuisce al mantenimento di ossa normali' },
  'vitK.coagulazione': { n: 'vitK', it: 'La vitamina K contribuisce alla normale coagulazione del sangue' },
  // estratti vegetali (linee guida del Ministero della Salute)
  'ashwagandha.adattogeno': { b: 'ashwagandha', area: 'energia', lgm: 'Tonico-adattogeno', it: 'L’ashwagandha ha un’azione tonico-adattogena' },
  'ashwagandha.tonico': { b: 'ashwagandha', area: 'energia', lgm: 'Tonico (stanchezza fisica, mentale)', it: 'L’ashwagandha ha un’azione tonica in caso di stanchezza fisica e mentale' },
  'ashwagandha.difese': { b: 'ashwagandha', area: 'difese', lgm: 'Naturali difese dell’organismo', it: 'L’ashwagandha sostiene le naturali difese dell’organismo' },
  'ashwagandha.rilassamento': { b: 'ashwagandha', area: 'mente', lgm: 'Rilassamento e benessere mentale', it: 'L’ashwagandha favorisce il rilassamento e il benessere mentale' },
  'biancospino.cardio': { b: 'biancospino', area: 'cuore', lgm: 'Regolare funzionalità dell’apparato cardiovascolare', it: 'Il biancospino favorisce la regolare funzionalità dell’apparato cardiovascolare' },
  'biancospino.pressione': { b: 'biancospino', area: 'cuore', lgm: 'Regolarità della pressione arteriosa', it: 'Il biancospino contribuisce alla regolarità della pressione arteriosa' },
  'biancospino.rilassamento': { b: 'biancospino', area: 'mente', lgm: 'Rilassamento e benessere mentale', it: 'Il biancospino favorisce il rilassamento e il benessere mentale' },
  'uvaursina.vie-urinarie': { b: 'uvaursina', area: 'urinario', lgm: 'Funzionalità delle vie urinarie', it: 'L’uva ursina favorisce la funzionalità delle vie urinarie' },
  'uvaursina.drenaggio': { b: 'uvaursina', area: 'urinario', lgm: 'Drenaggio dei liquidi corporei', it: 'L’uva ursina favorisce il drenaggio dei liquidi corporei' },
}

/*
  Aree di benessere: nella vista di un prodotto le sue indicazioni pubblicabili sono raggruppate per area
  (foto, nome e frase dell'area); quelle senza area vanno in "Altre indicazioni autorizzate".
  focus 'top': quando la cornice ritaglia la foto (orizzontale su telefono e schermi medi) resta in vista la
  parte alta, per le foto con il viso vicino al bordo.
*/
export const AREAS = [
  { key: 'pelle', name: 'Pelle, capelli e unghie', tagline: 'I dettagli di ogni giorno.', image: 'area-pelle' },
  { key: 'ossa', name: 'Ossa, cartilagini e denti', tagline: 'La struttura che ti sostiene.', image: 'area-ossa' },
  { key: 'muscoli', name: 'Muscoli e movimento', tagline: 'Ogni passo, ogni allenamento.', image: 'area-muscoli' },
  { key: 'energia', name: 'Energia e stanchezza', tagline: 'Il ritmo delle tue giornate.', image: 'area-energia' },
  { key: 'difese', name: 'Sistema immunitario', tagline: 'Le difese di tutti i giorni.', image: 'area-difese', focus: 'top' },
  { key: 'cuore', name: 'Cuore e vasi sanguigni', tagline: 'Il ritmo di uno stile di vita attivo.', image: 'area-cuore' },
  { key: 'mente', name: 'Mente e sistema nervoso', tagline: 'L’equilibrio del quotidiano.', image: 'area-mente' },
  { key: 'urinario', name: 'Vie urinarie', tagline: 'La leggerezza di ogni giorno.', image: 'area-urinario' },
]

/*
  Formule (stesso ordine e stessi slug di src/seo/catalog.js e di WooCommerce).
  dose: la dose giornaliera dell'etichetta; amounts: nutrienti con indicazioni autorizzate per dose
  giornaliera (unita' di NUTRIENTS); botanicals: estratti vegetali con indicazioni (quantita' per dose);
  ingredients: cosa dichiara l'etichetta (testo per la pagina).
  claims: indicazioni in evidenza, ognuna con il suo stato (si pubblicano solo le 'verified').
  features: punti di forza del prodotto dall'etichetta (nessun effetto sulla salute), dove servono.
  none: sostanze senza indicazioni consentite (per la matrice). blocked: benefici che non si possono scrivere
  (testo, motivo): nel documento per la redazione, mai sulla pagina.
*/
const V = 'verified'

/** Benefici respinti nel registro UE per gli ingredienti senza indicazioni consentite (piu' prodotti). */
const NO = {
  collagene: ['Collagene: pelle, rughe, articolazioni, ossa', 'Nessuna indicazione autorizzata: le richieste sul collagene sono state respinte o non presentate a livello UE. Si possono usare solo le indicazioni delle vitamine e dei minerali della formula (per esempio la vitamina C per la formazione del collagene).'],
  ialuronico: ['Acido ialuronico: idratazione ed elasticità della pelle, articolazioni', 'Indicazioni respinte nel registro UE (non autorizzate).'],
  q10: ['Coenzima Q10: energia, cuore, pressione, antiossidante, funzione cerebrale', 'Indicazioni respinte nel registro UE (non autorizzate).'],
}

export const FORMULAS = [
  {
    slug: 'collagene',
    kicker: 'Collagene · In polvere',
    headline: 'Il rituale del mattino, in un misurino.',
    formula:
      '9.834 mg di collagene marino idrolizzato di tipo I in ogni misurino da 10 g, con acido ialuronico, coenzima Q10, vitamine C ed E, zinco, riboflavina e biotina. Gusto neutro: si scioglie in un bicchiere d’acqua.',
    how: 'Il collagene è una delle proteine che danno struttura alla pelle e l’organismo lo produce da sé: la vitamina C contribuisce alla sua normale formazione. Zinco, biotina e riboflavina contribuiscono al mantenimento di una pelle normale.',
    dose: 'Un misurino raso da 10 g al giorno, in un bicchiere d’acqua.',
    amounts: { vitC: 80, zinc: 10, vitE: 12, b2: 1.4, biotin: 450 },
    ingredients: [
      ['Collagene marino idrolizzato, tipo I', '9.834 mg'],
      ['Vitamina C', '80 mg', 100],
      ['Acido ialuronico', '50 mg'],
      ['Coenzima Q10', '10 mg'],
      ['Zinco', '10 mg', 100],
      ['Vitamina E', '12 mg', 100],
      ['Riboflavina (B2)', '1,4 mg', 100],
      ['Biotina', '450 µg', 900],
    ],
    claims: [
      ['vitC.collagene-pelle', V],
      ['zinc.pelle', V],
      ['biotin.pelle', V],
      ['b2.pelle', V],
      ['biotin.capelli', V],
      ['zinc.capelli', V],
      ['zinc.unghie', V],
      ['vitC.collagene-ossa', V],
      ['vitC.collagene-cartilagini', V],
      ['zinc.ossa', V],
      ['vitC.stanchezza', V],
      ['b2.stanchezza', V],
      ['vitC.immunitario', V],
      ['zinc.immunitario', V],
      ['biotin.psicologica', V],
      ['vitE.ossidativo', V],
    ],
    none: ['Collagene marino idrolizzato', 'Acido ialuronico', 'Coenzima Q10'],
    blocked: [NO.collagene, NO.ialuronico, NO.q10],
    source: 'Etichetta "Collagene polvere con lotto e scadenza - CORRETTA.pdf" (2026-10-16)',
    image: 'prodotto-collagene',
  },
  {
    slug: 'collagene-marino-compresse',
    kicker: 'Collagene · Compresse',
    headline: 'Lo stesso collagene marino, in tre compresse.',
    formula:
      '3000 mg di collagene marino idrolizzato di tipo I in tre compresse, con vitamina C, acido ialuronico, coenzima Q10, zinco, vitamina E, riboflavina e biotina: ogni vitamina e minerale al 100% del valore di riferimento.',
    how: 'La vitamina C contribuisce alla normale formazione del collagene, la proteina che dà struttura a pelle, ossa e cartilagini. Lo zinco contribuisce al mantenimento di ossa normali.',
    dose: 'Tre compresse al giorno, con un bicchiere d’acqua.',
    amounts: { vitC: 80, zinc: 10, vitE: 12, b2: 1.4, biotin: 50 },
    ingredients: [
      ['Collagene marino idrolizzato, tipo I', '3000 mg'],
      ['Vitamina C', '80 mg', 100],
      ['Acido ialuronico', '100 mg'],
      ['Coenzima Q10', '10 mg'],
      ['Zinco', '10 mg', 100],
      ['Vitamina E', '12 mg', 100],
      ['Riboflavina (B2)', '1,4 mg', 100],
      ['Biotina', '50 µg', 100],
    ],
    claims: [
      ['vitC.collagene-pelle', V],
      ['b2.pelle', V],
      ['zinc.pelle', V],
      ['biotin.pelle', V],
      ['zinc.capelli', V],
      ['biotin.capelli', V],
      ['zinc.unghie', V],
      ['vitC.collagene-ossa', V],
      ['vitC.collagene-cartilagini', V],
      ['zinc.ossa', V],
      ['vitC.stanchezza', V],
      ['b2.stanchezza', V],
      ['vitC.immunitario', V],
      ['zinc.immunitario', V],
      ['vitE.ossidativo', V],
    ],
    none: ['Collagene marino idrolizzato', 'Acido ialuronico', 'Coenzima Q10'],
    blocked: [NO.collagene, NO.ialuronico, NO.q10],
    source: 'Etichetta "Collagene Marino compresse 75x195"',
    image: 'prodotto-collagene-marino-compresse',
  },
  {
    slug: 'collagene-bovino',
    kicker: 'Collagene · Compresse',
    headline: 'Collagene bovino, con rame e selenio.',
    formula:
      '2100 mg di collagene bovino idrolizzato di tipo I in tre compresse, con vitamine C ed E, zinco, rame, selenio, riboflavina e biotina, insieme ad acido ialuronico e coenzima Q10.',
    how: 'Il rame contribuisce al mantenimento di tessuti connettivi normali, quelli che sostengono e collegano gli organi; il selenio contribuisce al mantenimento di capelli e unghie normali.',
    dose: 'Tre compresse al giorno, con un bicchiere d’acqua.',
    amounts: { vitC: 80, zinc: 10, vitE: 12, b2: 1.4, biotin: 50, copper: 1, selenium: 55 },
    ingredients: [
      ['Collagene bovino idrolizzato, tipo I', '2100 mg'],
      ['Vitamina C', '80 mg', 100],
      ['Acido ialuronico', '100 mg'],
      ['Coenzima Q10', '10 mg'],
      ['Zinco', '10 mg', 100],
      ['Vitamina E', '12 mg', 100],
      ['Riboflavina (B2)', '1,4 mg', 100],
      ['Biotina', '50 µg', 100],
      ['Rame', '1 mg', 100],
      ['Selenio', '55 µg', 100],
    ],
    claims: [
      ['vitC.collagene-pelle', V],
      ['zinc.pelle', V],
      ['copper.pigmentazione-pelle', V],
      ['biotin.capelli', V],
      ['selenium.capelli', V],
      ['copper.capelli', V],
      ['zinc.unghie', V],
      ['selenium.unghie', V],
      ['copper.tessuti', V],
      ['vitC.collagene-cartilagini', V],
      ['vitC.collagene-ossa', V],
      ['zinc.ossa', V],
      ['vitC.stanchezza', V],
      ['b2.stanchezza', V],
      ['vitC.immunitario', V],
      ['zinc.immunitario', V],
      ['selenium.immunitario', V],
      ['selenium.tiroide', V],
      ['vitE.ossidativo', V],
    ],
    none: ['Collagene bovino idrolizzato', 'Acido ialuronico', 'Coenzima Q10'],
    blocked: [
      NO.collagene,
      NO.ialuronico,
      NO.q10,
      ['"Per pelle, ossa e articolazioni" (fronte dell’etichetta)', 'Indicazione generica (art. 10.3 Reg. 1924/2006): va accompagnata da indicazioni specifiche autorizzate; "articolazioni" non corrisponde a nessuna (la vitamina C riguarda le cartilagini). Da correggere in etichetta.'],
    ],
    source: 'Etichetta "ETICHETTA 195x75mm compressa_bovino_variante2"',
    image: 'prodotto-collagene-bovino',
  },
  {
    slug: 'bromelina',
    kicker: 'Estratti vegetali · Compresse gastroresistenti',
    headline: 'Dall’ananas, misurata in attività enzimatica.',
    formula:
      'Due bromeline titolate, a 5000 e 2500 GDU/g: 500 mg in ogni compressa, pari a 1875 GDU di attività enzimatica. Il rivestimento gastroresistente, a base di alginato e HPMC, fa sì che la compressa superi lo stomaco intatta.',
    how: 'La bromelina è un insieme di enzimi che si ricava dal gambo dell’ananas: la sua forza si misura in GDU, l’attività enzimatica. Il rivestimento gastroresistente protegge la compressa dall’acidità dello stomaco.',
    dose: 'La prima settimana due compresse al giorno, poi una, lontano dai pasti e con un bicchiere d’acqua.',
    warnings:
      'In caso di assunzione di farmaci anticoagulanti o antiaggreganti piastrinici consultare il medico prima dell’uso. In gravidanza e durante l’allattamento consultare il medico prima dell’uso.',
    amounts: {},
    ingredients: [
      ['Bromelina 5000 GDU/g', '250 mg'],
      ['Bromelina 2500 GDU/g', '250 mg'],
      ['Attività enzimatica totale', '1875 GDU'],
    ],
    claims: [],
    // punti di forza dall'etichetta: caratteristiche del prodotto, nessun effetto sulla salute
    features: [
      '1875 GDU di attività enzimatica in ogni compressa',
      'Due bromeline titolate, a 5000 e 2500 GDU/g',
      'Compressa gastroresistente, a base di alginato e HPMC',
      'Fino a 6 mesi di fornitura: 180 compresse',
      'Senza glutine e senza lattosio',
      'Prodotto in Italia, qualità certificata GMP e ISO 9001',
    ],
    none: ['Bromelina'],
    blocked: [
      ['Bromelina e ananas: microcircolo, gambe pesanti, drenaggio, digestione, cellulite, difese, fluidità del sangue', 'Indicazioni respinte nel registro UE (non autorizzate), anche quelle sull’ananas come fonte di bromelina. Gli effetti delle linee guida ministeriali per l’ananas non si possono usare per la bromelina.'],
    ],
    source: 'Etichetta "Bromelina compresse_etichetta_con scadenza"',
    image: 'prodotto-bromelina',
  },
  {
    slug: 'ashwagandha',
    kicker: 'Estratti vegetali · Compresse',
    headline: 'Una radice, un estratto certificato.',
    formula: '600 mg di estratto secco di radice di ashwagandha KSM-66® (Withania somnifera) in ogni compressa, titolato al 5% in withanolidi: 30 mg per compressa.',
    how: 'L’estratto KSM-66® si ottiene dalla sola radice di ashwagandha ed è titolato al 5% in withanolidi. La radice ha un’azione tonico-adattogena e favorisce il rilassamento e il benessere mentale.',
    dose: 'Una compressa al giorno, con un bicchiere d’acqua.',
    warnings:
      'Non utilizzare in gravidanza e durante l’allattamento. In caso di alterazioni della funzione epatica, biliare o di calcolosi delle vie biliari l’uso del prodotto è sconsigliato. Se si stanno assumendo farmaci è opportuno sentire il parere del medico.',
    amounts: {},
    botanicals: { ashwagandha: '600 mg' },
    ingredients: [
      ['Ashwagandha KSM-66®, estratto secco di radice', '600 mg'],
      ['Withanolidi', '30 mg'],
    ],
    claims: [
      ['ashwagandha.rilassamento', V],
      ['ashwagandha.adattogeno', V],
      ['ashwagandha.tonico', V],
      ['ashwagandha.difese', V],
    ],
    none: [],
    blocked: [
      ['"Benessere psicofisico" (etichetta)', 'Non è tra gli effetti delle linee guida ministeriali per la Withania: sulla pagina si usano i quattro effetti delle linee guida. Da valutare in etichetta.'],
      ['Ashwagandha: stress, sonno, ansia, testosterone, tiroide', 'Non sono effetti delle linee guida ministeriali; stress, ansia e sonno come disturbi rimandano a malattie.'],
    ],
    source: 'Etichetta "Etichetta Aswagandha"',
    image: 'prodotto-ashwagandha',
  },
  {
    slug: 'coenzima-q10',
    kicker: 'Estratti vegetali · Capsule vegetali',
    headline: 'Coenzima Q10, con vitamine B1, B12 e C.',
    formula:
      '200 mg di coenzima Q10 in due capsule vegetali, con acetil L-carnitina, estratto di biancospino, vitamina C, tiamina (vitamina B1), vitamina B12 come metilcobalamina e magnesio bisglicinato.',
    how: 'La tiamina (vitamina B1) contribuisce alla normale funzione cardiaca. Tiamina e vitamina B12 contribuiscono al normale metabolismo energetico: i processi con cui l’organismo ricava energia dagli alimenti.',
    dose: 'Due capsule al giorno, con un bicchiere d’acqua.',
    amounts: { vitC: 80, b1: 1.1, b12: 100, mg: 30 },
    botanicals: { biancospino: '200 mg' },
    ingredients: [
      ['Coenzima Q10', '200 mg'],
      ['Acetil L-carnitina cloridrato', '300 mg'],
      ['Biancospino, estratto secco (1% flavonoidi)', '200 mg'],
      ['Magnesio', '30 mg', 8],
      ['Vitamina C', '80 mg', 100],
      ['Vitamina B1 (tiamina)', '1,1 mg', 100],
      ['Vitamina B12 (metilcobalamina)', '100 µg', 4000],
    ],
    claims: [
      ['b1.cuore', V],
      ['biancospino.cardio', V],
      ['biancospino.pressione', V],
      ['vitC.collagene-vasi', V],
      ['b1.energia', V],
      ['b12.energia', V],
      ['vitC.energia', V],
      ['b12.stanchezza', V],
      ['vitC.stanchezza', V],
      ['vitC.immunitario', V],
      ['b12.immunitario', V],
      ['biancospino.rilassamento', V],
      ['b1.psicologica', V],
      ['b12.psicologica', V],
      ['vitC.ossidativo', V],
    ],
    none: ['Coenzima Q10', 'Acetil L-carnitina', 'Magnesio (30 mg, 8% del VNR: sotto la quantità significativa)'],
    blocked: [
      NO.q10,
      ['Acetil L-carnitina: energia, funzione cerebrale', 'Nessuna indicazione autorizzata.'],
      ['Magnesio: stanchezza, muscoli, sistema nervoso', '30 mg sono l’8% del VNR: sotto il 15%, nessuna indicazione sul magnesio.'],
      ['Biancospino: azione antiossidante', 'Effetto presente nelle linee guida ministeriali ma non usato: le indicazioni "antiossidanti" degli estratti vegetali sono le più contestate. La protezione dallo stress ossidativo è indicata per la vitamina C.'],
    ],
    source: 'Etichetta "Etichetta Carlo Coenzima Q10"',
    image: 'prodotto-coenzima-q10',
  },
  {
    slug: 'd-mannosio',
    kicker: 'Estratti vegetali · Compresse',
    headline: 'D-mannosio, cranberry e vitamina C.',
    formula:
      '2400 mg di D-mannosio in tre compresse, con estratto di cranberry titolato al 30% in proantocianidine, estratto di uva ursina, due ceppi di fermenti lattici vivi (Lactobacillus rhamnosus SGL06 e Lactobacillus reuteri SGL01) e vitamina C.',
    how: 'La vitamina C contribuisce alla normale funzione del sistema immunitario e alla protezione delle cellule dallo stress ossidativo.',
    dose: 'Tre compresse al giorno, con un bicchiere d’acqua.',
    warnings: 'Non utilizzare in gravidanza e durante l’allattamento.',
    amounts: { vitC: 80 },
    botanicals: { uvaursina: '200 mg' },
    ingredients: [
      ['D-mannosio', '2400 mg'],
      ['Cranberry, estratto secco (30% PAC)', '300 mg'],
      ['Uva ursina, estratto secco', '200 mg'],
      ['Lactobacillus rhamnosus SGL06', '100 mg'],
      ['Lactobacillus reuteri SGL01', '100 mg'],
      ['Vitamina C', '80 mg', 100],
    ],
    claims: [
      ['uvaursina.vie-urinarie', V],
      ['uvaursina.drenaggio', V],
      ['vitC.immunitario', V],
      ['vitC.stanchezza', V],
      ['vitC.energia', V],
      ['vitC.collagene-pelle', V],
      ['vitC.ossidativo', V],
      ['vitC.ferro', V],
    ],
    none: ['D-mannosio', 'Cranberry'],
    blocked: [
      ['Cranberry: vie urinarie, difese, antiossidante, cuore', 'Indicazioni respinte nel registro UE. In etichetta la funzionalità delle vie urinarie e il drenaggio vanno riferiti solo all’uva ursina, non al cranberry.'],
      ['D-mannosio: vie urinarie, adesione dei batteri alla vescica', 'Nessuna indicazione autorizzata; respinta nel registro UE l’indicazione su cranberry e D-mannosio insieme.'],
      ['Fermenti lattici, "probiotici": equilibrio della flora intestinale', 'In Italia si può usare con almeno un miliardo di cellule vive al giorno per ceppo: in etichetta c’è solo il peso (100 mg). Il termine "probiotico" segue le linee guida ministeriali: da verificare con il consulente.'],
    ],
    source: 'Etichetta "Etichetta D-Mannosio (senza Lotto e scadenza)"',
    image: 'prodotto-d-mannosio',
  },
  {
    slug: 'diosmina',
    kicker: 'Estratti vegetali · Capsule vegetali',
    headline: '1200 mg di flavonoidi, con vite rossa e vitamina C.',
    formula:
      '1000 mg di diosmina e 200 mg di esperidina in due capsule vegetali, con estratto di semi di vite rossa titolato al 95% in proantocianidine, rutina e vitamina C.',
    how: 'Le pareti dei vasi sanguigni contengono collagene: la vitamina C contribuisce alla sua normale formazione per la normale funzione dei vasi sanguigni, e alla protezione delle cellule dallo stress ossidativo.',
    dose: 'Due capsule al giorno, con un bicchiere d’acqua.',
    warnings:
      'Non utilizzare in gravidanza e durante l’allattamento. In caso di assunzione di farmaci, in particolare anticoagulanti o antiaggreganti, consultare il medico prima dell’uso.',
    amounts: { vitC: 80 },
    ingredients: [
      ['Diosmina', '1000 mg'],
      ['Esperidina', '200 mg'],
      ['Vite rossa, estratto secco di semi (95% proantocianidine)', '100 mg'],
      ['Rutina', '50 mg'],
      ['Vitamina C', '80 mg', 100],
    ],
    claims: [
      ['vitC.collagene-vasi', V],
      ['vitC.collagene-pelle', V],
      ['vitC.collagene-cartilagini', V],
      ['vitC.stanchezza', V],
      ['vitC.energia', V],
      ['vitC.immunitario', V],
      ['vitC.psicologica', V],
      ['vitC.ossidativo', V],
      ['vitC.ferro', V],
    ],
    none: ['Diosmina', 'Esperidina', 'Rutina', 'Vite rossa'],
    blocked: [
      ['Vite rossa: microcircolo, circolazione venosa, gambe pesanti o gonfie, drenaggio', 'Indicazioni respinte nel registro UE (estratto di semi di vite rossa): non si possono usare, anche se presenti nelle linee guida ministeriali. Da correggere in etichetta.'],
      ['Diosmina ed esperidina: circolazione venosa, tono delle vene, colesterolo, ossa', 'Indicazioni respinte nel registro UE.'],
    ],
    source: 'Etichetta "Etichetta Carlo Diosmina 2"',
    image: 'prodotto-diosmina',
  },
  {
    slug: 'magnesio',
    kicker: 'Vitamine e minerali · Compresse',
    headline: 'Magnesio bisglicinato, con le vitamine del gruppo B.',
    formula: '375 mg di magnesio da bisglicinato in due compresse, il 100% del valore di riferimento, con vitamine B1, B6 e B12, anche loro al 100%.',
    how: 'Il magnesio contribuisce alla normale funzione muscolare e all’equilibrio elettrolitico. Insieme alle vitamine B6 e B12 contribuisce alla riduzione della stanchezza e dell’affaticamento.',
    dose: 'Due compresse al giorno, con un bicchiere d’acqua.',
    amounts: { mg: 375, b1: 1.1, b6: 1.4, b12: 2.5 },
    ingredients: [
      ['Magnesio (da bisglicinato)', '375 mg', 100],
      ['Vitamina B1 (tiamina)', '1,1 mg', 100],
      ['Vitamina B6 (piridossina)', '1,4 mg', 100],
      ['Vitamina B12 (metilcobalamina)', '2,5 µg', 100],
    ],
    claims: [
      ['mg.muscoli', V],
      ['mg.elettrolitico', V],
      ['mg.proteica', V],
      ['mg.stanchezza', V],
      ['b6.stanchezza', V],
      ['b12.stanchezza', V],
      ['mg.energia', V],
      ['b1.energia', V],
      ['mg.nervoso', V],
      ['mg.psicologica', V],
      ['b6.psicologica', V],
      ['b12.psicologica', V],
      ['b1.nervoso', V],
      ['b6.nervoso', V],
      ['mg.ossa', V],
      ['mg.denti', V],
      ['b6.immunitario', V],
      ['b12.immunitario', V],
      ['b1.cuore', V],
      ['b6.ormonale', V],
    ],
    none: [],
    blocked: [
      ['"Le vitamine B1, B6 e B12 contribuiscono ... alla riduzione della stanchezza e dell’affaticamento" (etichetta)', 'La tiamina (B1) non ha questa indicazione autorizzata: in etichetta va corretta in "le vitamine B6 e B12".'],
      ['"Il magnesio e la vitamina B6 contribuiscono all’equilibrio elettrolitico" (etichetta)', 'La vitamina B6 non ha questa indicazione autorizzata: vale solo per il magnesio. Da correggere in etichetta.'],
    ],
    source: 'Etichetta "Magnesio_190x80 (3)"',
    image: 'prodotto-magnesio',
  },
  {
    slug: 'vitamina-b12',
    kicker: 'Vitamine e minerali · Compresse',
    headline: 'Metilcobalamina, una compressa al giorno.',
    formula: '1000 µg di vitamina B12 come metilcobalamina, una delle sue forme naturali, in ogni compressa. 450 compresse: oltre un anno di fornitura.',
    how: 'La vitamina B12 contribuisce al normale metabolismo energetico e alla normale formazione dei globuli rossi, le cellule del sangue che trasportano l’ossigeno.',
    dose: 'Una compressa al giorno, con un bicchiere d’acqua.',
    amounts: { b12: 1000 },
    ingredients: [['Vitamina B12 (metilcobalamina)', '1000 µg', 40000]],
    claims: [
      ['b12.energia', V],
      ['b12.stanchezza', V],
      ['b12.nervoso', V],
      ['b12.psicologica', V],
      ['b12.immunitario', V],
      ['b12.globuli-rossi', V],
      ['b12.omocisteina', V],
      ['b12.divisione', V],
    ],
    none: [],
    blocked: [['Tabella dell’etichetta: "Vitamina B1 (Metilcobalamina)"', 'Refuso in etichetta: deve essere "Vitamina B12 (Metilcobalamina)".']],
    source: 'Etichetta "Vitamina_B12_130x50"',
    image: 'prodotto-vitamina-b12',
  },
  {
    slug: 'vitamina-c',
    kicker: 'Vitamine e minerali · Compresse',
    headline: 'Vitamina C da acido ascorbico e rosa canina.',
    formula:
      '1000 mg di vitamina C in una compressa: 930 mg da acido L-ascorbico e 70 mg dall’estratto di rosa canina titolato al 70%, con 50 mg di bioflavonoidi da agrumi.',
    how: 'La vitamina C contribuisce alla normale funzione del sistema immunitario e alla normale formazione del collagene per la normale funzione della pelle.',
    dose: 'Una compressa al giorno, con un bicchiere d’acqua.',
    amounts: { vitC: 1000 },
    ingredients: [
      ['Vitamina C totale', '1000 mg', 1250],
      ['di cui da acido L-ascorbico', '930 mg', 1163],
      ['Rosa canina, estratto (70% vitamina C)', '100 mg'],
      ['Bioflavonoidi da agrumi', '50 mg'],
    ],
    claims: [
      ['vitC.immunitario', V],
      ['vitC.immunitario-sforzo', V],
      ['vitC.collagene-pelle', V],
      ['vitC.collagene-ossa', V],
      ['vitC.collagene-cartilagini', V],
      ['vitC.denti', V],
      ['vitC.collagene-vasi', V],
      ['vitC.stanchezza', V],
      ['vitC.energia', V],
      ['vitC.nervoso', V],
      ['vitC.psicologica', V],
      ['vitC.ossidativo', V],
      ['vitC.ferro', V],
    ],
    none: ['Bioflavonoidi'],
    blocked: [
      ['Rosa canina: azione di sostegno e ricostituente, transito intestinale, antiossidante', 'Effetti delle linee guida ministeriali, non usati: 100 mg di estratto servono a dare vitamina C, la quantità utile per questi effetti va verificata con il consulente.'],
      ['Bioflavonoidi: circolazione, antiossidanti', 'Nessuna indicazione autorizzata.'],
    ],
    source: 'Etichetta "Etichetta Vitamina C (1000mg totali)"',
    image: 'prodotto-vitamina-c',
  },
  {
    slug: 'vitamina-d3-k2',
    kicker: 'Vitamine e minerali · Compresse',
    headline: 'Vitamina D3 e K2 nella stessa compressa.',
    formula: '2000 UI (50 µg) di vitamina D3 e 100 µg di vitamina K2 come menachinone-7 (MK-7) in una compressa: 365 compresse, un anno di fornitura.',
    how: 'La vitamina D contribuisce al normale assorbimento e utilizzo di calcio e fosforo e al mantenimento di ossa normali; anche la vitamina K contribuisce al mantenimento di ossa normali.',
    dose: 'Una compressa al giorno, durante i pasti principali.',
    amounts: { vitD: 50, vitK: 100 },
    ingredients: [
      ['Vitamina D3 (colecalciferolo)', '50 µg · 2000 UI', 1000],
      ['Vitamina K2 (menachinone-7)', '100 µg', 133],
    ],
    claims: [
      ['vitD.calcio-fosforo', V],
      ['vitD.ossa', V],
      ['vitK.ossa', V],
      ['vitD.denti', V],
      ['vitD.muscoli', V],
      ['vitD.immunitario', V],
      ['vitD.calcemia', V],
      ['vitK.coagulazione', V],
      ['vitD.divisione', V],
    ],
    none: [],
    blocked: [
      ['Vitamina K2: salute del cuore e delle arterie, calcio nei vasi', 'Nessuna indicazione autorizzata per la vitamina K oltre a ossa e coagulazione.'],
      ['Vitamina K e farmaci anticoagulanti', 'L’etichetta non riporta un’avvertenza per chi assume anticoagulanti: valutarla con il consulente regolatorio.'],
    ],
    source: 'Etichetta "Etichetta Vitamina D3+K2 (nuova versione)"',
    image: 'prodotto-vitamina-d3-k2',
  },
]

/** Le foto della pagina (public/images/benefici/<nome>.webp e <nome>-m.webp): testo alternativo. */
export const IMAGES = {
  'area-pelle': 'Ritratto ravvicinato di una donna con la pelle al naturale, alla luce morbida di una finestra',
  'area-ossa': 'Un uomo e una donna salgono un sentiero di montagna nella luce del mattino',
  'area-muscoli': 'Un uomo e una donna corrono in una pineta all’alba',
  'area-energia': 'Una donna in bicicletta in una via del centro, di mattina presto',
  'area-difese': 'Una donna corre in un parco innevato, nella luce del mattino',
  'area-cuore': 'Un uomo nuota in mare all’alba',
  'area-mente': 'Una donna con una tazza di tè guarda fuori da una grande finestra, al mattino',
  'area-urinario': 'Una donna cammina a piedi nudi sulla riva del mare all’alba',
  'prodotto-collagene': 'Una donna sugli scogli al tramonto, con il vento tra i capelli',
  'prodotto-collagene-marino-compresse': 'Mani che tengono un bicchiere d’acqua nella luce del mattino',
  'prodotto-collagene-bovino': 'Ritratto di un uomo con capelli e barba brizzolati, alla luce del pomeriggio',
  'prodotto-bromelina': 'Un ananas tagliato a metà su una pietra calda, al sole',
  'prodotto-ashwagandha': 'Radici essiccate e bacche di ashwagandha in una ciotola di ceramica',
  'prodotto-coenzima-q10': 'Un uomo in bicicletta su una strada costiera all’alba',
  'prodotto-d-mannosio': 'Mirtilli rossi in una ciotola di vetro piena d’acqua',
  'prodotto-diosmina': 'Uva nera, foglie di vite e scorza d’arancia su una pietra chiara',
  'prodotto-magnesio': 'Una donna fa stretching su un tappetino in una sala luminosa',
  'prodotto-vitamina-b12': 'Una donna sale una scalinata in pietra in un borgo, al mattino',
  'prodotto-vitamina-c': 'Bacche di rosa canina e arance tagliate su un telo di lino',
  'prodotto-vitamina-d3-k2': 'Un uomo e una donna camminano mano nella mano in un prato di montagna',
}

/** Domande frequenti della pagina (anche nei dati strutturati FAQPage, src/seo/pages.js). */
export const FAQ = [
  [
    'Cos’è un’indicazione sulla salute autorizzata?',
    'È una frase che descrive il ruolo di un nutriente nell’organismo, valutata dall’EFSA e autorizzata dalla Commissione europea. Le indicazioni consentite sono elencate nel Reg. (UE) 432/2012 e nel registro UE delle indicazioni nutrizionali e sulla salute.',
  ],
  [
    'Cosa sono le indicazioni sugli estratti vegetali?',
    'Sono gli effetti fisiologici degli estratti vegetali che, in attesa della valutazione dell’Unione europea, in Italia si possono usare secondo le linee guida del Ministero della Salute. Sulla pagina sono segnalate come estratto vegetale, distinte da quelle autorizzate per vitamine e minerali.',
  ],
  [
    'Cosa significa VNR?',
    'È il valore nutritivo di riferimento giornaliero per un adulto, fissato dal Reg. (UE) 1169/2011. La percentuale indica quanta parte del riferimento copre una dose giornaliera.',
  ],
  [
    'Un integratore sostituisce una dieta equilibrata?',
    'No. Gli integratori alimentari non vanno intesi come sostituti di una dieta variata ed equilibrata e di uno stile di vita sano. Per dubbi su un prodotto o sul suo uso chiedi al tuo medico o al farmacista.',
  ],
]

// ---------------------------------------------------------------------------------------------
/** Percentuale del VNR di un nutriente in una formula (dose giornaliera). */
export const nrvPercent = (formula, n) => Math.round(((formula.amounts?.[n] ?? 0) / NUTRIENTS[n].nrv) * 100)

/**
 * Un'indicazione e' pubblicabile in una formula? Stato 'verified' e testo consentito; per vitamine e minerali
 * nutriente almeno al 15% del VNR nella dose giornaliera e condizione d'uso specifica rispettata; per gli
 * estratti vegetali la pianta presente nella formula.
 */
export function publishable(formula, [key, status]) {
  const c = CLAIMS[key]
  if (status !== 'verified' || !c) return false
  if (c.b) return !!BOTANICALS[c.b] && !!formula.botanicals?.[c.b]
  const amount = formula.amounts?.[c.n] ?? 0
  if (amount < NUTRIENTS[c.n].nrv * SIGNIFICANT) return false
  if (c.condition?.min && amount < c.condition.min) return false
  return true
}

/** Indicazioni da mostrare per una formula (solo quelle pubblicabili, nell'ordine dei dati). */
export const publishedClaims = (formula) => formula.claims.filter((c) => publishable(formula, c)).map(([key]) => ({ key, ...CLAIMS[key] }))

/** Aree di una formula: quelle delle sue indicazioni pubblicabili. */
export const areasOf = (formula) => [...new Set(publishedClaims(formula).map((c) => c.area).filter(Boolean))]

/** Benefici di una formula sulla pagina: indicazioni pubblicabili e punti di forza. */
export const benefitsCount = (formula) => publishedClaims(formula).length + (formula.features?.length ?? 0)

export const formulaBySlug = (slug) => FORMULAS.find((f) => f.slug === slug) ?? null

/**
 * Gruppi della vista di un prodotto: le sue aree (prima la principale), poi le indicazioni senza area
 * (area null). In ogni gruppo le indicazioni sono riunite per ingrediente (nutriente o estratto), nell'ordine
 * dei dati: sulla pagina un ingrediente compare una volta per gruppo, con una frase sola (joinClaims).
 */
export function claimGroups(formula) {
  const claims = publishedClaims(formula)
  const areas = [...areasOf(formula), ...(claims.some((c) => !c.area) ? [null] : [])]
  return areas.map((area) => {
    const byIngredient = new Map()
    for (const c of claims.filter((x) => (x.area ?? null) === area)) {
      const key = c.n ?? c.b
      byIngredient.set(key, [...(byIngredient.get(key) ?? []), c])
    }
    return { area, ingredients: [...byIngredient.values()] }
  })
}

// ---------------------------------------------------------------------------------------------
/*
  Indicazioni dello stesso ingrediente in una frase sola: le parole uguali all'inizio e alla fine dei testi si
  scrivono una volta ("Lo zinco contribuisce al mantenimento di una pelle normale, capelli normali e unghie
  normali"). Nessuna parola cambia e nessuna si aggiunge, a parte virgole e congiunzioni: rimettendo a ogni
  parte variabile le parti comuni si rileggono i testi ufficiali, e joinClaims lo controlla ogni volta.
  Le stesse regole valgono nelle altre lingue, con i testi ufficiali tradotti
  (src/i18n/locales/<lingua>/benefici-gruppi.js, npm run traduzioni-benefici).
*/
const words = (s) => new Set(s.split(' '))

/**
 * Parole che legano, per lingua. stop: non chiudono la parte comune iniziale (articoli e preposizioni
 * articolate; "to" e "à", che reggono anche un verbo); conj: congiunzioni; prep: preposizioni. before: "normale"
 * viene prima del nome; plural: un aggettivo da solo in comune alla fine solo se plurale (vale per tutti i nomi).
 */
const GLUE = {
  it: {
    and: 'e',
    stop: words('il lo la i gli le un uno una del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle'),
    conj: words('e ed o'),
    prep: words('di a da in con su per tra fra'),
    before: true,
    plural: /i$/,
  },
  en: { and: 'and', stop: words('the a an to'), conj: words('and or'), prep: words('of for in on at by with from during'), before: true },
  fr: {
    and: 'et',
    stop: words('le la les un une des du au aux à d’un d’une'),
    conj: words('et ou'),
    prep: words('de en dans pour par sur avec'),
    plural: /[sx]$/,
  },
  de: {
    and: 'und',
    stop: words('der die das den dem des ein eine einer einen einem eines zur zum im am vom beim'),
    conj: words('und oder'),
    prep: words('zu von für mit bei in an auf aus nach vor'),
    before: true,
  },
  es: { and: 'y', stop: words('el la los las un una unos unas del al'), conj: words('y e o u'), prep: words('de a en con por para'), plural: /s$/ },
}

const low = (w = '') => w.toLowerCase()

/** Parte comune iniziale (head) e finale (tail) di piu' testi divisi in parole, e le parti variabili. */
function factor(lists, g) {
  const [first] = lists
  const min = Math.min(...lists.map((x) => x.length))
  const glue = (w) => g.stop.has(low(w)) || g.conj.has(low(w)) || g.prep.has(low(w))
  const sameEnd = (k) => lists.every((x) => x[x.length - 1 - k] === first[first.length - 1 - k])
  // parole uguali alla fine dopo le prime k, lasciando almeno una parola a ogni parte variabile
  const tailAfter = (k) => {
    let t = 0
    while (t < min - k - 1 && sameEnd(t)) t++
    return t
  }
  let h = 0
  while (h < min && lists.every((x) => x[h] === first[h])) h++
  let whole = 0
  while (whole < min - h && sameEnd(whole)) whole++
  // un testo e' contenuto in un altro: in comune solo l'ingrediente e il verbo (fino alla prima parola che lega)
  if (lists.some((x) => x.length - h - whole < 1)) {
    const verb = first.findIndex((w, i) => i > 0 && glue(w) && !glue(first[i - 1]))
    h = verb > 0 && verb < h ? verb : 0
  }
  const headOk = (k) => {
    const last = first[k - 1]
    if (g.stop.has(low(last)) || g.conj.has(low(last))) return false
    if (lists.some((x) => g.conj.has(low(x[k])))) return false
    // "normale" prima del nome si mette in comune solo davanti a nomi singoli ("normal skin, hair and nails")
    if (g.before && /^normal/i.test(last)) return lists.every((x) => x.length - k - tailAfter(k) === 1)
    return true
  }
  while (h > 0 && !headOk(h)) h--
  const tailOk = (k) => {
    const start = first[first.length - k]
    if (g.conj.has(low(start))) return false
    if (lists.some((x) => glue(x[x.length - 1 - k]))) return false
    return !(k === 1 && g.plural && !g.plural.test(start))
  }
  let t = tailAfter(h)
  while (t > 0 && !tailOk(t)) t--
  return { head: first.slice(0, h), tail: first.slice(first.length - t), rests: lists.map((x) => x.slice(h, x.length - t)) }
}

/**
 * Albero della frase: parte comune iniziale, elenco delle parti variabili, parte comune finale. Nell'elenco
 * si uniscono ancora le parti con lo stesso verbo, quando i verbi sono diversi ("contribuisce a… e a… e
 * interviene…"), e le coordinate brevi ("al mantenimento di ossa e denti normali").
 */
function claimTree(lists, g) {
  const { head, tail, rests } = factor(lists, g)
  const glue = (w) => g.stop.has(low(w)) || g.conj.has(low(w)) || g.prep.has(low(w))
  const verbs = rests.some((r) => r[0] !== rests[0][0])
  const short = (s) => s.head.length > 0 && (s.rests.every((x) => x.length === 1) || (s.tail.length > 0 && s.rests.every((x) => x.length <= 2)))
  let left = rests.map((_, i) => i)
  const items = []
  while (left.length) {
    const [i, ...others] = left
    const r = rests[i]
    let mates = verbs && !glue(r[0]) ? others.filter((j) => rests[j][0] === r[0]) : []
    if (!mates.length) mates = others.filter((j) => short(factor([r, rests[j]], g)))
    const sub = mates.length ? factor([i, ...mates].map((k) => rests[k]), g) : null
    if (sub?.head.length) {
      items.push({ head: sub.head, tail: sub.tail, items: sub.rests.map((x) => ({ words: x })) })
      left = others.filter((j) => !mates.includes(j))
    } else {
      items.push({ words: r })
      left = others
    }
  }
  return { head, tail, items }
}

function sentence(node, g) {
  if (node.words) return node.words.join(' ')
  const parts = node.items.map((x) => sentence(x, g))
  const last = parts.pop()
  let list = last
  if (parts.length) {
    // spagnolo: "e" davanti a i- e hi- ("e inmunitario")
    const and = g === GLUE.es && /^h?i(?![aeiouáéíóú])/i.test(last) ? 'e' : g.and
    list = `${parts.join(', ')}${parts[parts.length - 1].includes(',') ? ',' : ''} ${and} ${last}`
  }
  return [node.head.join(' '), list, node.tail.join(' ')].filter(Boolean).join(' ')
}

/** Testi di partenza riletti dall'albero: a ogni parte variabile le sue parti comuni. */
const spread = (node) => (node.words ? [node.words.join(' ')] : node.items.flatMap((x) => spread(x).map((s) => [...node.head, s, ...node.tail].join(' '))))

/**
 * Indicazioni dello stesso ingrediente (testi ufficiali, nella lingua lang) in una frase sola. Errore se la
 * frase non restituisce, parola per parola, tutti i testi di partenza.
 */
export function joinClaims(texts, lang = 'it') {
  if (texts.length < 2) return texts[0]
  const g = GLUE[lang]
  const tree = claimTree(
    texts.map((s) => s.split(' ')),
    g,
  )
  const sorted = (list) => JSON.stringify([...list].sort())
  if (sorted(spread(tree)) !== sorted(texts)) throw new Error(`Indicazioni da non unire, cambierebbero: ${texts.join(' | ')}`)
  return sentence(tree, g)
}
