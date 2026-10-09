/*
  SEO di Nutrex Lab: una sola fonte per indirizzi, titoli, descrizioni, categorie, FAQ e dati
  dell'azienda. La usano la build (vite.config.js: <head> delle pagine, griglie statiche, sezione
  "La linea" della homepage), il server (pagina prodotto, sitemap) e il browser (pagina prodotto).
  Solo dati e funzioni pure: niente DOM e niente import di JSON (gira anche nelle funzioni di Vercel).

  Regole dei testi (le stesse di src/content.js): dati presi dalle etichette; indicazioni sulla salute
  solo quelle riportate in etichetta o autorizzate (Reg. UE 432/2012, nutrienti almeno al 15% del VNR),
  mai promesse di risultato. Prezzi, disponibilita' e recensioni non stanno qui: arrivano da WooCommerce.

  Titoli: al massimo ~60 caratteri (Google taglia i piu' lunghi). Descrizioni: ~150-160 caratteri.
*/

/** Indirizzo canonico del sito (www, https): canonical, Open Graph, sitemap e dati strutturati. */
export const ORIGIN = 'https://www.nutrexlab.it'
export const BRAND = 'Nutrex Lab'

/** Dati dell'azienda (gli stessi del pie' di pagina e delle Note legali). */
export const COMPANY = {
  name: BRAND,
  legalName: 'Carlo Lappostato',
  vatID: 'IT02157850898',
  email: 'info@nutrexlab.it',
  telephone: '+39 333 719 2623',
  address: { street: 'via Iblea 97', postalCode: '96010', locality: 'Melilli', region: 'SR', country: 'IT' },
  // profili ufficiali del marchio (social, marketplace): solo quelli che esistono davvero
  sameAs: ['https://www.amazon.it/stores/page/E1F09FA2-E05D-49B3-AD2A-0B2F35D69BDF'],
  // logo per Google (dati strutturati, almeno 112 x 112): il marchio esagonale del logo ufficiale
  // (wordpress/nutrex-headless/assets/nutrex-logo.svg) su fondo bianco, quadrato
  logo: { src: '/logo.png', width: 512, height: 512 },
}

/** Politica di reso (pagina Spedizioni e resi): 14 giorni, per posta, spese di reso a carico del cliente. */
export const RETURNS = { days: 14, country: 'IT' }

/** Immagine per le anteprime social delle pagine senza una foto propria. */
export const SOCIAL_IMAGE = { src: '/og.jpg', width: 1200, height: 1200, alt: 'Collagene marino Nutrex Lab, barattolo da 500 g' }

/* --------------------------------------------------------------------------
   Prodotti: i 12 integratori della linea (slug = slug di WooCommerce = id in src/products.js).
   name e summary sono gli stessi di WooCommerce (nome e breve descrizione): servono alle griglie
   statiche, che il browser aggiorna poi con i dati di WooCommerce.
   quality: i simboli di "Qualita' e garanzie" del prodotto (chiavi di QUALITY), presi dall'etichetta.
   benefits: [simbolo, titolo, testo] dei "Benefici" (simboli in src/shop/quality.js); i testi sono solo
   indicazioni riportate in etichetta o autorizzate (Reg. UE 432/2012, nutrienti almeno al 15% del VNR).
   -------------------------------------------------------------------------- */
export const PRODUCTS = [
  {
    slug: 'collagene',
    name: 'Collagene marino in polvere',
    label: 'Collagene marino',
    note: 'In polvere · 10.000 mg',
    category: 'collagene',
    pack: 'barattolo da 500 g',
    quality: ['glutine', 'lattosio', 'neutro'],
    benefits: [
      ['collagene', 'Collagene', 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione della pelle e delle ossa.'],
      ['pelle', 'Pelle', 'Zinco, biotina e riboflavina contribuiscono al mantenimento di una pelle normale.'],
      ['capelli', 'Capelli e unghie', 'Lo zinco contribuisce al mantenimento di capelli e unghie normali, la biotina di capelli normali.'],
      ['cellule', 'Protezione cellulare', 'Vitamina C, vitamina E, zinco e riboflavina contribuiscono alla protezione delle cellule dallo stress ossidativo.'],
    ],
    summary:
      'Collagene marino idrolizzato di tipo I con vitamina C, acido ialuronico, coenzima Q10 e biotina. 10.000 mg in ogni misurino. Prodotto in Italia.',
    title: 'Collagene Marino in Polvere 10.000 mg | Nutrex Lab',
    description:
      'Collagene marino idrolizzato di tipo I: 10.000 mg per misurino con vitamina C, acido ialuronico, coenzima Q10 e biotina. Gusto neutro, 500 g, made in Italy.',
    faq: [
      ['Come si usa il collagene marino in polvere?', "Sciogli un misurino raso da 10 g in un bicchiere d'acqua, una volta al giorno. Il gusto è neutro."],
      ['Quanto dura un barattolo?', 'Il barattolo da 500 g contiene 50 dosi da 10 g: 50 giorni con un misurino al giorno.'],
      [
        'Cosa contiene una dose?',
        'Un misurino da 10 g apporta 10.000 mg di collagene marino idrolizzato di tipo I, 232 mg di vitamina C (290% VNR), 145 mg di acido ialuronico, 29 mg di coenzima Q10, 29 mg di zinco, 35 mg di vitamina E, 4,1 mg di riboflavina (B2) e 145 µg di biotina.',
      ],
      ['È senza glutine e senza lattosio?', 'Sì: il collagene marino in polvere Nutrex Lab è senza glutine e senza lattosio.'],
    ],
  },
  {
    slug: 'collagene-marino-compresse',
    name: 'Collagene marino in compresse',
    label: 'Collagene marino',
    note: 'Compresse · 3000 mg',
    category: 'collagene',
    pack: 'flacone da 180 compresse',
    quality: ['glutine', 'lattosio'],
    benefits: [
      ['collagene', 'Collagene', 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione della pelle e delle ossa.'],
      ['pelle', 'Pelle', 'Zinco, biotina e riboflavina contribuiscono al mantenimento di una pelle normale.'],
      ['capelli', 'Capelli e unghie', 'Lo zinco contribuisce al mantenimento di capelli e unghie normali, la biotina di capelli normali.'],
      ['cellule', 'Protezione cellulare', 'Vitamina C, vitamina E, zinco e riboflavina contribuiscono alla protezione delle cellule dallo stress ossidativo.'],
    ],
    summary:
      'Collagene marino idrolizzato di tipo I in compresse: 3000 mg per dose con acido ialuronico, coenzima Q10, vitamina C, zinco e biotina. 180 compresse.',
    title: 'Collagene Marino in Compresse 3000 mg | Nutrex Lab',
    description:
      'Collagene marino idrolizzato di tipo I in compresse: 3000 mg per dose con acido ialuronico, coenzima Q10, vitamina C e biotina. 180 compresse, made in Italy.',
    faq: [
      ['Come si assume?', "Tre compresse al giorno con un bicchiere d'acqua: insieme apportano 3000 mg di collagene marino idrolizzato di tipo I."],
      ['Quanto dura un flacone?', 'Il flacone contiene 180 compresse, cioè 60 dosi da tre compresse.'],
      [
        'Che differenza c’è con il collagene marino in polvere?',
        'La fonte è la stessa: collagene marino idrolizzato di tipo I. Cambiano formato e dose: 3000 mg in tre compresse qui, 10.000 mg in un misurino da 10 g nella versione in polvere.',
      ],
      ['È senza glutine e senza lattosio?', 'Sì: il collagene marino in compresse Nutrex Lab è senza glutine e senza lattosio.'],
    ],
  },
  {
    slug: 'collagene-bovino',
    name: 'Collagene bovino',
    label: 'Collagene bovino',
    note: 'Compresse · 2100 mg',
    category: 'collagene',
    pack: 'flacone da 180 compresse',
    quality: ['glutine', 'lattosio'],
    benefits: [
      ['tessuti', 'Tessuti connettivi', 'Il rame contribuisce al mantenimento di tessuti connettivi normali.'],
      ['collagene', 'Collagene', 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione di ossa, cartilagini e pelle.'],
      ['pelle', 'Pelle', 'Zinco, biotina e riboflavina contribuiscono al mantenimento di una pelle normale.'],
      ['capelli', 'Capelli e unghie', 'Zinco e selenio contribuiscono al mantenimento di capelli e unghie normali.'],
    ],
    summary:
      'Collagene bovino idrolizzato di tipo I in compresse: 2100 mg per dose con acido ialuronico, coenzima Q10, vitamine C ed E, zinco, rame e selenio. 180 compresse.',
    title: 'Collagene Bovino Idrolizzato in Compresse | Nutrex Lab',
    description:
      'Collagene bovino idrolizzato di tipo I: 2100 mg per dose con acido ialuronico, coenzima Q10, vitamine C ed E, zinco, rame e selenio. 180 compresse.',
    faq: [
      ['Come si assume?', "Tre compresse al giorno con un bicchiere d'acqua: insieme apportano 2100 mg di collagene bovino idrolizzato di tipo I."],
      ['Quanto dura un flacone?', 'Il flacone contiene 180 compresse, cioè 60 dosi da tre compresse.'],
      [
        'Cosa contiene oltre al collagene?',
        'Per dose: 100 mg di acido ialuronico, 10 mg di coenzima Q10, vitamina C, vitamina E, zinco, riboflavina (B2), biotina, rame e selenio, ognuno al 100% del valore nutritivo di riferimento. Il rame contribuisce al mantenimento di tessuti connettivi normali.',
      ],
      [
        'Che differenza c’è tra collagene bovino e marino?',
        'La fonte: il collagene bovino è ricavato da fonte bovina, quello marino dal pesce. Entrambi sono collagene idrolizzato di tipo I.',
      ],
    ],
  },
  {
    slug: 'bromelina',
    name: 'Bromelina alto dosaggio',
    label: 'Bromelina',
    note: 'Alto dosaggio · 1875 GDU',
    category: 'estratti-vegetali',
    pack: 'flacone da 180 compresse gastroresistenti',
    quality: ['glutine', 'lattosio', 'gastro'],
    benefits: [
      ['enzimi', 'Alta attività enzimatica', '1875 GDU in ogni compressa, da due bromeline titolate a 5000 e 2500 GDU/g.'],
      ['ananas', "Dall'ananas", "La bromelina è un insieme di enzimi proteolitici estratti dall'ananas."],
      ['gastro', 'Rilascio protetto', 'Compresse gastroresistenti, con rivestimento a base di alginato e HPMC.'],
    ],
    summary:
      'Bromelina alto dosaggio in compresse gastroresistenti: 500 mg di bromelina e 1875 GDU di attività enzimatica in ogni compressa. 180 compresse, prodotto in Italia.',
    title: 'Bromelina Alto Dosaggio 1875 GDU in Compresse | Nutrex Lab',
    description:
      'Bromelina alto dosaggio in compresse gastroresistenti: 500 mg di bromelina e 1875 GDU di attività enzimatica per compressa. 180 compresse, made in Italy.',
    faq: [
      [
        'Come si assume la bromelina?',
        "Nella prima settimana due compresse al giorno, poi una al giorno: lontano dai pasti, con un bicchiere d'acqua.",
      ],
      [
        'Cosa sono le GDU?',
        'Sono unità di attività enzimatica: la forza della bromelina non si misura solo in milligrammi. Ogni compressa contiene due bromeline titolate, a 5000 e 2500 GDU/g, per un totale di 1875 GDU.',
      ],
      ['Che cosa vuol dire compressa gastroresistente?', 'Che la compressa ha un rivestimento gastroresistente, a base di alginato e HPMC.'],
      ['Quanto dura un flacone?', 'Le 180 compresse bastano fino a sei mesi: due al giorno nella prima settimana, poi una al giorno.'],
    ],
  },
  {
    slug: 'ashwagandha',
    name: 'Ashwagandha KSM-66',
    label: 'Ashwagandha',
    note: 'KSM-66® · 600 mg',
    category: 'estratti-vegetali',
    pack: 'flacone da 180 compresse',
    quality: ['vegano', 'glutine', 'lattosio', 'ksm66'],
    benefits: [
      ['equilibrio', 'Tonico-adattogena', "L'ashwagandha svolge un'azione tonico-adattogena."],
      ['relax', 'Rilassamento', "L'ashwagandha favorisce il rilassamento."],
      ['mente', 'Benessere mentale', "L'ashwagandha favorisce il benessere mentale e psicofisico."],
    ],
    summary:
      'Ashwagandha certificata KSM-66®: 600 mg di estratto secco di radice titolato al 5% in withanolidi in ogni compressa. 180 compresse, sei mesi di fornitura.',
    title: 'Ashwagandha KSM-66 600 mg in Compresse | Nutrex Lab',
    description:
      'Ashwagandha KSM-66®: 600 mg di estratto secco di radice titolato al 5% in withanolidi per compressa. 180 compresse, sei mesi di fornitura, prodotto vegano.',
    faq: [
      [
        'Che cos’è l’ashwagandha KSM-66®?',
        'È un estratto secco di radice di ashwagandha (Withania somnifera), standardizzato al 5% in withanolidi. Ogni compressa ne contiene 600 mg, pari a 30 mg di withanolidi.',
      ],
      ['Come si assume?', "Una compressa al giorno, con un bicchiere d'acqua."],
      ['Quanto dura un flacone?', 'Il flacone da 180 compresse copre sei mesi, con una compressa al giorno.'],
      ['È adatta ai vegani?', 'Sì: Ashwagandha KSM-66 Nutrex Lab è un prodotto vegano, senza glutine.'],
    ],
  },
  {
    slug: 'coenzima-q10',
    name: 'Coenzima Q10 Cardio Premium',
    label: 'Coenzima Q10',
    note: 'Cardio Premium · 200 mg',
    category: 'estratti-vegetali',
    pack: 'flacone da 180 capsule vegetali',
    quality: ['vegano', 'capsule'],
    benefits: [
      ['cuore', 'Funzione cardiaca', 'La vitamina B1 contribuisce alla normale funzione cardiaca.'],
      ['battito', 'Apparato cardiovascolare', "Il biancospino favorisce la regolare funzionalità dell'apparato cardiovascolare."],
      ['energia', 'Energia', 'Le vitamine C e B12 contribuiscono al normale metabolismo energetico.'],
      ['cellule', 'Protezione cellulare', 'La vitamina C contribuisce alla protezione delle cellule dallo stress ossidativo.'],
    ],
    summary:
      'Coenzima Q10 Cardio Premium: 200 mg di coenzima Q10 con acetil L-carnitina, biancospino, magnesio e vitamine C, B1 e B12. 180 capsule vegetali.',
    title: 'Coenzima Q10 200 mg Cardio Premium | Nutrex Lab',
    description:
      'Coenzima Q10 Cardio Premium: 200 mg di coenzima Q10 con acetil L-carnitina, biancospino, magnesio e vitamine C, B1 e B12. 180 capsule vegetali.',
    faq: [
      ['Come si assume?', "Due capsule al giorno con un bicchiere d'acqua: insieme apportano 200 mg di coenzima Q10."],
      [
        'Cosa contiene oltre al coenzima Q10?',
        'Per dose: 300 mg di acetil L-carnitina, 200 mg di estratto di biancospino titolato all’1% in flavonoidi, 30 mg di magnesio e le vitamine C, B1 e B12. La vitamina B1 contribuisce alla normale funzione cardiaca; il biancospino favorisce la regolare funzionalità dell’apparato cardiovascolare.',
      ],
      ['Quanto dura un flacone?', 'Le 180 capsule bastano tre mesi, con due capsule al giorno.'],
      ['È vegano?', 'Sì: è un prodotto vegano, in capsule vegetali.'],
    ],
  },
  {
    slug: 'd-mannosio',
    name: 'D-Mannosio Uro Care',
    label: 'D-Mannosio',
    note: 'Uro Care · 2400 mg',
    category: 'estratti-vegetali',
    pack: 'flacone da 180 compresse',
    quality: ['glutine', 'lattosio', 'probiotici'],
    benefits: [
      ['goccia', 'Vie urinarie', 'Cranberry e uva ursina favoriscono la funzionalità delle vie urinarie.'],
      ['onde', 'Drenaggio', 'Cranberry e uva ursina favoriscono il drenaggio dei liquidi corporei.'],
      ['difese', 'Sistema immunitario', 'La vitamina C contribuisce alla normale funzione del sistema immunitario.'],
      ['cellule', 'Protezione cellulare', 'La vitamina C contribuisce alla protezione delle cellule dallo stress ossidativo.'],
    ],
    summary:
      'D-Mannosio Uro Care: 2400 mg di D-mannosio per dose con cranberry, uva ursina, fermenti lattici vivi e vitamina C. 180 compresse, prodotto in Italia.',
    title: 'D-Mannosio con Cranberry e Probiotici | Nutrex Lab',
    description:
      'D-Mannosio Uro Care: 2400 mg di D-mannosio per dose con cranberry titolato al 30% in PAC, uva ursina, fermenti lattici vivi e vitamina C. 180 compresse.',
    faq: [
      ['Come si assume?', "Tre compresse al giorno con un bicchiere d'acqua: insieme apportano 2400 mg di D-mannosio."],
      [
        'Cosa contiene una dose?',
        '2400 mg di D-mannosio, 300 mg di estratto di cranberry titolato al 30% in PAC, 200 mg di estratto di uva ursina, due ceppi di fermenti lattici vivi (L. rhamnosus SGL06 e L. reuteri SGL01, 1 miliardo ciascuno) e 80 mg di vitamina C.',
      ],
      ['Cosa dice l’etichetta su cranberry e uva ursina?', 'Il cranberry e l’uva ursina favoriscono la funzionalità delle vie urinarie e il drenaggio dei liquidi corporei.'],
      ['Quanto dura un flacone?', 'Le 180 compresse bastano due mesi, con tre compresse al giorno.'],
    ],
  },
  {
    slug: 'diosmina',
    name: 'Diosmina ed Esperidina',
    label: 'Diosmina',
    note: 'Ed esperidina · 1200 mg',
    category: 'estratti-vegetali',
    pack: 'flacone da 180 capsule vegetali',
    quality: ['vegano', 'capsule'],
    benefits: [
      ['circolo', 'Microcircolo', 'La vite rossa favorisce la funzionalità del microcircolo.'],
      ['piuma', 'Gambe leggere', 'La vite rossa contrasta la sensazione di pesantezza alle gambe.'],
      ['vasi', 'Vasi sanguigni', 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione dei vasi sanguigni.'],
      ['cellule', 'Protezione cellulare', 'La vitamina C contribuisce alla protezione delle cellule dallo stress ossidativo.'],
    ],
    summary:
      'Diosmina ed Esperidina 1200: 1000 mg di diosmina e 200 mg di esperidina per dose, con estratto di semi di vite rossa, rutina e vitamina C. 180 capsule vegetali.',
    title: 'Diosmina 1000 mg ed Esperidina con Vite Rossa | Nutrex Lab',
    description:
      'Diosmina ed Esperidina 1200: 1000 mg di diosmina e 200 mg di esperidina per dose, con vite rossa, rutina e vitamina C. 180 capsule vegetali, vegano.',
    faq: [
      ['Come si assume?', "Due capsule al giorno con un bicchiere d'acqua: insieme apportano 1000 mg di diosmina e 200 mg di esperidina."],
      [
        'Cosa contiene oltre a diosmina ed esperidina?',
        '100 mg di estratto di semi di vite rossa titolato al 95% in proantocianidine, 50 mg di rutina e 80 mg di vitamina C. La vite rossa favorisce la funzionalità del microcircolo e contrasta la sensazione di pesantezza alle gambe.',
      ],
      ['Quanto dura un flacone?', 'Le 180 capsule bastano tre mesi, con due capsule al giorno.'],
      ['È vegano?', 'Sì: è un prodotto vegano, in capsule vegetali.'],
    ],
  },
  {
    slug: 'magnesio',
    name: 'Magnesio bisglicinato',
    label: 'Magnesio bisglicinato',
    note: 'Con vitamine B1, B6, B12',
    category: 'vitamine-e-minerali',
    pack: 'flacone da 180 compresse',
    quality: ['vegano', 'glutine', 'lattosio'],
    benefits: [
      ['muscoli', 'Muscoli', 'Il magnesio contribuisce alla normale funzione muscolare.'],
      ['nervi', 'Sistema nervoso', 'Il magnesio e la vitamina B6 contribuiscono al normale funzionamento del sistema nervoso.'],
      ['batteria', 'Meno stanchezza', "Il magnesio e le vitamine B6 e B12 contribuiscono alla riduzione della stanchezza e dell'affaticamento."],
      ['equilibrio', 'Equilibrio elettrolitico', "Il magnesio contribuisce all'equilibrio elettrolitico."],
    ],
    summary:
      'Magnesio bisglicinato con vitamine B1, B6 e B12: 375 mg di magnesio per dose, il 100% del valore di riferimento. 180 compresse, prodotto vegano.',
    title: 'Magnesio Bisglicinato 375 mg con Vitamine B | Nutrex Lab',
    description:
      'Magnesio bisglicinato con vitamine B1, B6 e B12: 375 mg di magnesio per dose, il 100% del valore di riferimento. 180 compresse, prodotto vegano.',
    faq: [
      [
        'Che cos’è il magnesio bisglicinato?',
        'È magnesio in forma chelata: ogni ione di magnesio è legato a due molecole di glicina, un amminoacido.',
      ],
      ['Come si assume?', "Due compresse al giorno con un bicchiere d'acqua: insieme apportano 375 mg di magnesio, il 100% del valore nutritivo di riferimento."],
      [
        'A cosa servono magnesio e vitamine del gruppo B?',
        'Il magnesio contribuisce alla normale funzione muscolare e al normale funzionamento del sistema nervoso; magnesio e vitamine B6 e B12 contribuiscono alla riduzione della stanchezza e dell’affaticamento.',
      ],
      ['Quanto dura un flacone?', 'Le 180 compresse bastano tre mesi, con due compresse al giorno. È un prodotto vegano, senza glutine e senza lattosio.'],
    ],
  },
  {
    slug: 'vitamina-b12',
    name: 'Vitamina B12',
    label: 'Vitamina B12',
    note: 'Metilcobalamina · 1000 µg',
    category: 'vitamine-e-minerali',
    pack: 'flacone da 450 compresse',
    quality: ['vegano', 'ogm', 'glutine', 'lattosio'],
    benefits: [
      ['energia', 'Energia', 'La vitamina B12 contribuisce al normale metabolismo energetico.'],
      ['batteria', 'Meno stanchezza', "La vitamina B12 contribuisce alla riduzione della stanchezza e dell'affaticamento."],
      ['nervi', 'Sistema nervoso', 'La vitamina B12 contribuisce al normale funzionamento del sistema nervoso.'],
      ['sangue', 'Globuli rossi e difese', 'La vitamina B12 contribuisce alla normale formazione dei globuli rossi e alla normale funzione del sistema immunitario.'],
    ],
    summary:
      'Vitamina B12 come metilcobalamina: 1000 µg in una compressa al giorno. 450 compresse, oltre un anno di fornitura. Prodotto vegano.',
    title: 'Vitamina B12 Metilcobalamina 1000 µg | Nutrex Lab',
    description:
      'Vitamina B12 come metilcobalamina: 1000 µg in una compressa al giorno. 450 compresse, oltre un anno di fornitura. Prodotto vegano, senza glutine.',
    faq: [
      ['Che cos’è la metilcobalamina?', 'È una delle forme naturali della vitamina B12. Ogni compressa ne contiene 1000 µg.'],
      ['Come si assume?', "Una compressa al giorno, con un bicchiere d'acqua."],
      [
        'A cosa serve la vitamina B12?',
        'La vitamina B12 contribuisce alla riduzione della stanchezza e dell’affaticamento, alla normale formazione dei globuli rossi e alla normale funzione del sistema immunitario.',
      ],
      ['Quanto dura un flacone?', 'Le 450 compresse bastano oltre un anno, con una compressa al giorno. È un prodotto vegano, senza OGM e senza glutine.'],
    ],
  },
  {
    slug: 'vitamina-c',
    name: 'Vitamina C',
    label: 'Vitamina C',
    note: 'Con rosa canina · 1000 mg',
    category: 'vitamine-e-minerali',
    pack: 'flacone da 180 compresse',
    quality: ['vegano', 'ogm', 'glutine', 'lattosio'],
    benefits: [
      ['difese', 'Sistema immunitario', 'La vitamina C contribuisce alla normale funzione del sistema immunitario.'],
      ['cellule', 'Protezione cellulare', 'La vitamina C contribuisce alla protezione delle cellule dallo stress ossidativo.'],
      ['collagene', 'Collagene', 'La vitamina C contribuisce alla normale formazione del collagene per la normale funzione di pelle, ossa e vasi sanguigni.'],
      ['batteria', 'Meno stanchezza', "La vitamina C contribuisce alla riduzione della stanchezza e dell'affaticamento."],
    ],
    summary:
      'Vitamina C con rosa canina e bioflavonoidi: 1000 mg per compressa, il 1250% del valore di riferimento. 180 compresse, sei mesi di fornitura.',
    title: 'Vitamina C 1000 mg con Rosa Canina | Nutrex Lab',
    description:
      'Vitamina C 1000 mg per compressa con rosa canina e bioflavonoidi da agrumi: il 1250% del valore di riferimento. 180 compresse, sei mesi di fornitura.',
    faq: [
      [
        'Da dove viene la vitamina C?',
        'Da due fonti: 930 mg di acido L-ascorbico e l’estratto di rosa canina titolato al 70% in vitamina C, per 1000 mg per compressa. In più, 50 mg di bioflavonoidi da agrumi.',
      ],
      ['Come si assume?', "Una compressa al giorno, con un bicchiere d'acqua."],
      [
        'A cosa serve la vitamina C?',
        'La vitamina C contribuisce alla normale funzione del sistema immunitario e alla protezione delle cellule dallo stress ossidativo.',
      ],
      ['Quanto dura un flacone?', 'Le 180 compresse bastano sei mesi, con una compressa al giorno. È un prodotto vegano, senza OGM e senza glutine.'],
    ],
  },
  {
    slug: 'vitamina-d3-k2',
    name: 'Vitamina D3 + K2',
    label: 'Vitamina D3 + K2',
    note: 'MK-7 · 2000 UI',
    category: 'vitamine-e-minerali',
    pack: 'flacone da 365 compresse',
    quality: ['vegano', 'ogm', 'glutine', 'lattosio'],
    benefits: [
      ['difese', 'Sistema immunitario', 'La vitamina D contribuisce alla normale funzione del sistema immunitario.'],
      ['ossa', 'Ossa', 'Le vitamine D e K contribuiscono al mantenimento di ossa normali.'],
      ['molecola', 'Calcio e fosforo', 'La vitamina D contribuisce al normale assorbimento e utilizzo di calcio e fosforo.'],
      ['muscoli', 'Muscoli', 'La vitamina D contribuisce al mantenimento della normale funzione muscolare.'],
    ],
    summary:
      'Vitamina D3 + K2 (MK-7): 2000 UI di vitamina D3 e 100 µg di vitamina K2 in una compressa al giorno. 365 compresse, un anno di fornitura. Prodotto vegano.',
    title: 'Vitamina D3 + K2 MK-7 2000 UI, 365 Compresse | Nutrex Lab',
    description:
      'Vitamina D3 + K2 (MK-7): 2000 UI di vitamina D3 e 100 µg di vitamina K2 in una compressa al giorno. 365 compresse, un anno di fornitura, vegana.',
    faq: [
      ['Come si assume?', 'Una compressa al giorno, durante i pasti principali.'],
      [
        'Perché vitamina D3 e K2 insieme?',
        'Per assumerle con una sola compressa: 2000 UI di vitamina D3 (colecalciferolo) e 100 µg di vitamina K2 come menachinone-7 (MK-7). La vitamina D contribuisce al normale assorbimento e utilizzo di calcio e fosforo, la vitamina K al mantenimento di ossa normali.',
      ],
      ['Quanto dura un flacone?', 'Le 365 compresse bastano un anno, con una compressa al giorno.'],
      ['È vegana?', 'Sì: è un prodotto vegano, senza OGM e senza glutine.'],
    ],
  },
]

/* --------------------------------------------------------------------------
   Categorie (pagine /integratori/<slug>): raggruppano i prodotti per tipo, senza indicazioni sulla
   salute nei nomi. Ogni prodotto appartiene a una sola categoria (breadcrumb e correlati).
   I testi lunghi sono HTML (link interni compresi).
   -------------------------------------------------------------------------- */
export const CATEGORIES = [
  {
    slug: 'collagene',
    name: 'Collagene',
    display: ['Collagene'],
    eyebrow: 'Collagene idrolizzato di tipo I',
    title: 'Integratori di Collagene Marino e Bovino | Nutrex Lab',
    description:
      'Collagene idrolizzato di tipo I in polvere e in compresse: marino da 10.000 mg o 3000 mg per dose e bovino da 2100 mg, con vitamina C e acido ialuronico.',
    lead: '<strong>Collagene idrolizzato di tipo I, marino e bovino.</strong> In polvere da sciogliere in acqua o in compresse, con vitamina C, acido ialuronico e coenzima Q10.',
    line: 'Marino e bovino, in polvere e in compresse.',
    sections: [
      [
        'Collagene marino o bovino: cosa cambia',
        '<p>Il collagene marino è ricavato dal pesce, quello bovino da fonte bovina: in entrambi i casi è collagene di tipo I, idrolizzato, cioè scomposto in piccoli peptidi. Cambiano la fonte, il formato e la dose: 10.000&nbsp;mg per misurino nel <a class="link" href="/prodotto/collagene">collagene marino in polvere</a>, 3000&nbsp;mg in tre compresse nel <a class="link" href="/prodotto/collagene-marino-compresse">collagene marino in compresse</a>, 2100&nbsp;mg in tre compresse nel <a class="link" href="/prodotto/collagene-bovino">collagene bovino</a>.</p>',
      ],
      [
        'Polvere o compresse',
        '<p>La polvere, a gusto neutro, si scioglie in un bicchiere d’acqua: un misurino da 10&nbsp;g al giorno, 50 giorni in ogni barattolo da 500&nbsp;g. Le compresse sono per chi preferisce un formato pronto: tre al giorno, 180 compresse in ogni flacone.</p>',
      ],
      [
        'Cosa c’è oltre al collagene',
        '<p>Ogni formula affianca al collagene acido ialuronico, coenzima Q10 e un gruppo di vitamine e minerali, con le quantità dichiarate in etichetta. La vitamina C contribuisce alla normale formazione del collagene per la normale funzione della pelle; zinco e biotina contribuiscono al mantenimento di una pelle normale.</p>',
      ],
    ],
    faq: [
      [
        'Che cos’è il collagene idrolizzato?',
        'È collagene scomposto con l’idrolisi in piccoli peptidi. Il collagene è formato da tre catene proteiche avvolte in un’unica elica: l’idrolisi le divide in frammenti più piccoli. Tutti gli integratori di collagene Nutrex Lab contengono collagene idrolizzato di tipo I.',
      ],
      [
        'Qual è la differenza tra collagene marino e bovino?',
        'La fonte: il collagene marino è ricavato dal pesce, quello bovino da fonte bovina. Entrambi sono di tipo I e idrolizzati. Il collagene marino Nutrex Lab è in polvere (10.000 mg per dose) e in compresse (3000 mg per dose), il collagene bovino in compresse (2100 mg per dose).',
      ],
      ['Come si assume il collagene in polvere?', "Un misurino raso da 10 g al giorno, sciolto in un bicchiere d'acqua. Ha gusto neutro e un barattolo da 500 g dura 50 giorni."],
      ['Gli integratori di collagene contengono glutine o lattosio?', 'No: collagene marino in polvere, collagene marino in compresse e collagene bovino sono senza glutine e senza lattosio.'],
    ],
  },
  {
    slug: 'vitamine-e-minerali',
    name: 'Vitamine e minerali',
    display: ['Vitamine e', 'minerali'],
    eyebrow: 'Vitamine C, B12, D3 + K2 e magnesio',
    title: 'Vitamine e Minerali: C, B12, D3+K2, Magnesio | Nutrex Lab',
    description:
      'Integratori di vitamine e minerali Nutrex Lab: vitamina C 1000 mg, vitamina B12 metilcobalamina, vitamina D3 + K2 e magnesio bisglicinato. Prodotti in Italia.',
    lead: '<strong>Vitamina C, vitamina B12, vitamina D3 + K2 e magnesio bisglicinato.</strong> Formule essenziali, con dosi e valori di riferimento dichiarati in etichetta.',
    line: 'Vitamine C, B12, D3 + K2 e magnesio bisglicinato.',
    sections: [
      [
        'Quattro formule per ogni giorno',
        '<p>La <a class="link" href="/prodotto/vitamina-c">vitamina C</a> apporta 1000&nbsp;mg in una compressa, da acido L-ascorbico e rosa canina, con i bioflavonoidi degli agrumi. La <a class="link" href="/prodotto/vitamina-b12">vitamina B12</a> è metilcobalamina, 1000&nbsp;µg in una compressa. La <a class="link" href="/prodotto/vitamina-d3-k2">vitamina D3 + K2</a> unisce 2000&nbsp;UI di vitamina D3 e 100&nbsp;µg di vitamina K2 (MK-7). Il <a class="link" href="/prodotto/magnesio">magnesio bisglicinato</a> apporta 375&nbsp;mg di magnesio con le vitamine B1, B6 e B12 in due compresse.</p>',
      ],
      [
        'Cosa fanno vitamine e minerali',
        '<p>La vitamina C contribuisce alla normale funzione del sistema immunitario e alla protezione delle cellule dallo stress ossidativo. La vitamina B12 contribuisce alla riduzione della stanchezza e dell’affaticamento. La vitamina D contribuisce al normale assorbimento e utilizzo di calcio e fosforo e la vitamina K al mantenimento di ossa normali. Il magnesio contribuisce alla normale funzione muscolare e al normale funzionamento del sistema nervoso.</p>',
      ],
      [
        'Come leggere i valori di riferimento',
        '<p>Accanto a ogni nutriente trovi la percentuale del VNR, il valore nutritivo di riferimento giornaliero per adulti fissato dal Reg. (UE) 1169/2011: indica quanta parte del riferimento giornaliero copre una dose.</p>',
      ],
    ],
    faq: [
      [
        'Cosa significa VNR sull’etichetta?',
        'È la percentuale del valore nutritivo di riferimento giornaliero per adulti (Reg. UE 1169/2011) coperta da una dose. Per esempio, una compressa di Vitamina C Nutrex Lab apporta 1000 mg di vitamina C, il 1250% del VNR.',
      ],
      [
        'Perché vitamina D3 e K2 nella stessa compressa?',
        'Per assumerle insieme con una sola compressa al giorno: 2000 UI di vitamina D3 (colecalciferolo) e 100 µg di vitamina K2 come menachinone-7. La vitamina D contribuisce al normale assorbimento e utilizzo di calcio e fosforo, la vitamina K al mantenimento di ossa normali.',
      ],
      [
        'Che cos’è il magnesio bisglicinato?',
        'È magnesio in forma chelata: ogni ione di magnesio è legato a due molecole di glicina, un amminoacido. Il Magnesio bisglicinato Nutrex Lab ne apporta 375 mg per dose, il 100% del valore di riferimento.',
      ],
      ['Che cos’è la metilcobalamina?', 'È una delle forme naturali della vitamina B12. La Vitamina B12 Nutrex Lab ne contiene 1000 µg per compressa, in un flacone da 450 compresse.'],
    ],
  },
  {
    slug: 'estratti-vegetali',
    name: 'Estratti vegetali',
    display: ['Estratti', 'vegetali'],
    eyebrow: 'Estratti titolati e formule complete',
    title: 'Integratori con Estratti Vegetali Titolati | Nutrex Lab',
    description:
      'Ashwagandha KSM-66, bromelina, diosmina con vite rossa, D-mannosio con cranberry e coenzima Q10 con biancospino: estratti titolati, prodotti in Italia.',
    lead: '<strong>Ashwagandha KSM-66®, bromelina, diosmina con vite rossa, D-mannosio con cranberry e coenzima Q10 con biancospino.</strong> Estratti titolati, con il titolo dichiarato in etichetta.',
    line: 'Ashwagandha, bromelina, diosmina, D-mannosio e coenzima Q10.',
    sections: [
      [
        'Che cosa significa estratto titolato',
        '<p>Un estratto titolato garantisce la quantità di un componente caratteristico della pianta. L’<a class="link" href="/prodotto/ashwagandha">ashwagandha KSM-66®</a> è titolata al 5% in withanolidi, l’estratto di semi di vite rossa della <a class="link" href="/prodotto/diosmina">diosmina ed esperidina</a> al 95% in proantocianidine, il cranberry del <a class="link" href="/prodotto/d-mannosio">D-mannosio Uro Care</a> al 30% in PAC, il biancospino del <a class="link" href="/prodotto/coenzima-q10">coenzima Q10 Cardio Premium</a> all’1% in flavonoidi. La <a class="link" href="/prodotto/bromelina">bromelina</a>, enzima dell’ananas, si misura invece in GDU, unità di attività enzimatica.</p>',
      ],
      [
        'Cosa dicono le etichette',
        '<p>L’ashwagandha svolge un’azione tonico-adattogena e favorisce il rilassamento e il benessere mentale. La vite rossa favorisce la funzionalità del microcircolo e contrasta la sensazione di pesantezza alle gambe. Il cranberry e l’uva ursina favoriscono la funzionalità delle vie urinarie e il drenaggio dei liquidi corporei. Il biancospino favorisce la regolare funzionalità dell’apparato cardiovascolare.</p>',
      ],
    ],
    faq: [
      [
        'Che cos’è l’ashwagandha KSM-66®?',
        'È un estratto secco di radice di ashwagandha (Withania somnifera), standardizzato al 5% in withanolidi. Ogni compressa di Ashwagandha KSM-66 Nutrex Lab ne contiene 600 mg, pari a 30 mg di withanolidi.',
      ],
      [
        'Cosa sono le GDU della bromelina?',
        'Sono unità di attività enzimatica. Ogni compressa di Bromelina alto dosaggio contiene 500 mg di bromelina, pari a 1875 GDU, con un rivestimento gastroresistente.',
      ],
      [
        'Che cosa contiene D-Mannosio Uro Care?',
        '2400 mg di D-mannosio per dose da tre compresse, con estratto di cranberry titolato al 30% in PAC, estratto di uva ursina, due ceppi di fermenti lattici vivi e vitamina C.',
      ],
      [
        'Quali sono vegani?',
        'Ashwagandha KSM-66, Diosmina ed Esperidina e Coenzima Q10 Cardio Premium sono prodotti vegani; diosmina e coenzima Q10 sono in capsule vegetali. Bromelina e D-Mannosio sono senza glutine e senza lattosio.',
      ],
    ],
  },
]

/* --------------------------------------------------------------------------
   Qualita' e garanzie (pagina prodotto, sotto "Caratteristiche"; simboli in src/shop/quality.js).
   LINE_QUALITY vale per tutta la linea (prodotta in Italia, standard GMP / ISO 9001, come nelle
   domande frequenti del negozio); il resto lo dice il campo quality di ogni prodotto.
   -------------------------------------------------------------------------- */
export const LINE_QUALITY = ['italia', 'gmp', 'iso']

export const QUALITY = {
  italia: { name: 'Made in Italy', note: 'Prodotto in Italia' },
  gmp: { name: 'GMP', note: 'Buone pratiche di produzione' },
  iso: { name: 'ISO 9001', note: 'Sistema di qualità certificato' },
  vegano: { name: 'Vegano', note: 'Nessun ingrediente di origine animale' },
  ogm: { name: 'Senza OGM', note: 'Nessun ingrediente geneticamente modificato' },
  glutine: { name: 'Senza glutine', note: 'Formula senza glutine' },
  lattosio: { name: 'Senza lattosio', note: 'Formula senza lattosio' },
  gastro: { name: 'Gastroprotetta', note: 'Compresse con rivestimento gastroresistente' },
  capsule: { name: 'Capsule vegetali', note: 'Involucro vegetale in cellulosa (HPMC)' },
  ksm66: { name: 'KSM-66®', note: 'Estratto di radice certificato' },
  neutro: { name: 'Gusto neutro', note: 'Non cambia il sapore delle bevande' },
  probiotici: { name: 'Con probiotici', note: 'Due ceppi di fermenti lattici vivi' },
}

/** Qualita' e garanzie di un prodotto: prima quelle della linea, poi le sue (prodotti nuovi: solo quelle della linea). */
export const qualityFor = (slug) => [...LINE_QUALITY, ...(productBySlug(slug)?.quality ?? [])].filter((k) => QUALITY[k])

/* --------------------------------------------------------------------------
   Pagina Integratori (tutti i prodotti) e domande frequenti sul negozio
   -------------------------------------------------------------------------- */
export const SHOP = {
  path: '/integratori',
  name: 'Integratori',
  title: 'Integratori Alimentari Online: Tutta la Linea | Nutrex Lab',
  description:
    'Acquista online gli integratori Nutrex Lab: collagene, vitamine e minerali, estratti vegetali titolati. 12 formule prodotte in Italia, spedite in 2-4 giorni.',
  // domande frequenti sotto la griglia della pagina Integratori (e nei dati strutturati, con lo stesso testo)
  faq: [
    [
      'Dove sono prodotti gli integratori Nutrex Lab?',
      'In Italia. Tutti gli integratori della linea sono prodotti in Italia secondo standard di qualità GMP / ISO 9001, e ogni confezione ha il sigillo di garanzia.',
    ],
    [
      'Quanto tempo impiega la spedizione?',
      'Gli ordini vengono preparati entro 48 ore lavorative dalla conferma del pagamento e arrivano di norma in 2-4 giorni lavorativi, in tutta Italia isole comprese. Il costo della spedizione si vede al pagamento, prima di confermare l’ordine.',
    ],
    ['Posso restituire un prodotto?', 'Sì, entro 14 giorni dal ricevimento, con il prodotto integro e il sigillo di garanzia non aperto. Tutti i dettagli sono nella pagina Spedizioni e resi.'],
    [
      'Ci sono sconti per più confezioni?',
      'Sì: 5% con 2 pezzi, 10% con 4 pezzi e 15% con 10 pezzi, anche di prodotti diversi. Lo sconto si applica nel carrello. Con un account Nutrex Lab hai anche il 5% sul primo ordine.',
    ],
    ['Quali metodi di pagamento accettate?', 'Mastercard, Visa, American Express, PayPal, Klarna, Apple Pay e Google Pay, nel checkout sicuro del negozio.'],
  ],
}

/* --------------------------------------------------------------------------
   Aiuti
   -------------------------------------------------------------------------- */
export const productBySlug = (slug) => PRODUCTS.find((p) => p.slug === slug) ?? null
export const categoryBySlug = (slug) => CATEGORIES.find((c) => c.slug === slug) ?? null
export const categoryOf = (slug) => categoryBySlug(productBySlug(slug)?.category)
export const productsIn = (category) => PRODUCTS.filter((p) => p.category === category)

export const categoryPath = (slug) => `/integratori/${slug}`
export const productPath = (slug) => `/prodotto/${encodeURIComponent(slug)}`
export const absolute = (path) => (/^https?:/i.test(path) ? path : `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`)

/*
  Prodotti nuovi creati in WooCommerce: non serve toccare questo file perche' siano in vendita sul sito
  (pagina prodotto, pagina Integratori, sitemap e dati per Google arrivano da WooCommerce). Per farli
  entrare anche in una categoria del sito basta metterli, in WooCommerce, in una sottocategoria di
  "Nutrex Lab" con lo slug della categoria: collagene, vitamine-e-minerali o estratti-vegetali.
*/

/** Categoria del sito di un prodotto: quella scritta qui sopra o la sottocategoria di WooCommerce con lo stesso slug. */
export function categoryFor(slug, wooCategories = []) {
  return categoryOf(slug) ?? CATEGORIES.find((c) => wooCategories.some((k) => k.slug === c.slug)) ?? null
}

/** Foto del barattolo nel sito (sfondo trasparente, 800 x 1000), la stessa caricata in WooCommerce. */
export const productImage = (slug) => (productBySlug(slug) ? `/images/prodotti/${slug}.webp` : null)

/**
 * La foto principale di WooCommerce e' ancora quella del sito? (stesso file: .../collagene.webp, anche
 * nelle misure ridotte di WordPress come collagene-300x375.webp). Se in WooCommerce la foto viene
 * cambiata, il file ha un altro nome e le schede mostrano quella nuova.
 */
export function isSitePhoto(src, slug) {
  if (!src || !productBySlug(slug)) return false
  const file = decodeURIComponent(String(src).split(/[?#]/)[0].split('/').pop() ?? '').toLowerCase()
  return file.replace(/-(\d+x\d+|scaled)(?=\.[a-z0-9]+$)/g, '') === `${slug}.webp`
}

/** Testo alternativo descrittivo per le foto di un prodotto (WooCommerce spesso ha solo il nome del file). */
export function productAlt(name, slug, index = 0) {
  const p = productBySlug(slug)
  if (index > 0) return `${name} Nutrex Lab, foto ${index + 1}`
  return p ? `${name} Nutrex Lab, ${p.pack}` : `${name} Nutrex Lab`
}

/** Breadcrumb di un prodotto (dati strutturati): Home / Integratori / Categoria / Prodotto. */
export function productTrail(slug, name, wooCategories = []) {
  const cat = categoryFor(slug, wooCategories)
  return [
    ['Home', '/'],
    [SHOP.name, SHOP.path],
    ...(cat ? [[cat.name, categoryPath(cat.slug)]] : []),
    [name, productPath(slug)],
  ]
}

/** Gli altri prodotti della stessa categoria (correlati per la pagina prodotto). */
export function siblings(slug, limit = 4, wooCategories = []) {
  const cat = categoryFor(slug, wooCategories)
  if (!cat) return []
  return PRODUCTS.filter((p) => p.category === cat.slug && p.slug !== slug).slice(0, limit)
}
