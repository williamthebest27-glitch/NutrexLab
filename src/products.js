import MODEL_VERSIONS from './model-versions.json' with { type: 'json' }

/*
  Linea prodotti: voci del menu della hero, modello 3D e tema colori di ognuno.

  Per aggiungere un prodotto:
  1. esporta il barattolo da Blender (barattolo_3d.py nella cartella del prodotto) e
     aggiungilo a scripts/sync-model.mjs: viene copiato in public/models da `npm run dev`/`build`
  2. aggiungi qui una voce con nome, modello e tema (colori ricavati dall'etichetta);
     heroScale (facoltativo) ingrandisce il barattolo nella hero se e' piu' piccolo degli altri.

  Il primo prodotto e' quello mostrato all'apertura del sito. I colori sono sRGB esadecimali:
  la struttura del sito resta identica, cambia solo la palette.
*/

const COLLAGENE = {
  swatch: '#9e2e65', // esagono nel menu
  // fondi della narrazione (scene chiare e scure) e accenti
  palette: {
    paper: '#f1f0f3',
    mist: '#e2e1e7',
    ink: '#0e0c11',
    plum: '#1e0b1c',
    night: '#0d0a0f',
    abyss: '#08060a',
    wine: '#3b0b27',
    berry: '#9e2e65',
    berryHi: '#d45c95',
  },
  // colori fissi della pagina (custom properties in base.css)
  css: {
    '--quot-dot': '#8c0f4a',
    '--rit-glass-a': 'rgba(222, 182, 200, 0.66)',
    '--rit-glass-b': 'rgba(196, 136, 163, 0.82)',
    '--down-shadow': 'rgba(70, 12, 40, 0.45)',
    '--curtain': '#2e081c',
    '--curtain-glow': 'rgba(120, 28, 72, 0.32)',
    '--curtain-ink': '#f6eef2',
    '--curtain-ink-soft': 'rgba(246, 232, 239, 0.72)',
    '--curtain-copy': 'rgba(246, 232, 239, 0.7)',
    '--curtain-title-a': '#fdf6f9',
    '--curtain-title-b': '#f4dfe9',
    '--curtain-title-c': '#d6a3bd',
  },
  // liquido dentro RITUALE: dal pelo dell'acqua al fondo
  liquid: ['#934a6d', '#621a42', '#480d2c', '#300719', '#1e030f'],
  // raso della hero (Silk.js)
  silk: { light: '#f4efed', shade: '#d5caca', tint: '#ebd1db', sheen: '#fffbfb', rim: '#080d0b' },
  // nastro, gocce e polvere della hero (HeroFX.js)
  ribbon: ['#f3c9da', '#dc94b6', '#b65c86'],
  ribbonSheen: '#ffd9ea',
  ribbonEmissive: '#1c0610',
  drop: '#dc86ac',
  dropSheen: '#ffe2ee',
  dropEmissive: '#22060f',
  powder: ['#d79ab3', '#e6b4c8', '#c9809f', '#efd2de', '#b9628a'],
  // tripla elica della sezione Scienza (Particles.js)
  helix: ['#e47cb2', '#b23c79', '#f7e8f0'],
  rung: '#9d95ae',
  dust: '#c45a90',
  // scena 3D (Stage.js): bordo della dissolvenza, luce di taglio, ombre
  edge: '#ff79b4',
  rim: '#ffd9ea',
  shadow: ['#1a0c18', '#120810'],
}

// giallo dell'etichetta (#f2b945), oro della parte bassa e ambra/miele per le scene scure
const BROMELINA = {
  swatch: '#f2b945',
  palette: {
    paper: '#f4f2ea',
    mist: '#e8e3d3',
    ink: '#100d07',
    plum: '#1f1605',
    night: '#0e0b05',
    abyss: '#080603',
    wine: '#3b2a06',
    berry: '#996a08',
    berryHi: '#f2b945',
  },
  css: {
    '--quot-dot': '#e0a126',
    '--rit-glass-a': 'rgba(240, 220, 160, 0.66)',
    '--rit-glass-b': 'rgba(222, 186, 104, 0.82)',
    '--down-shadow': 'rgba(80, 58, 12, 0.45)',
    '--curtain': '#2e2206',
    '--curtain-glow': 'rgba(176, 124, 20, 0.3)',
    '--curtain-ink': '#f8f3e4',
    '--curtain-ink-soft': 'rgba(248, 240, 218, 0.72)',
    '--curtain-copy': 'rgba(248, 240, 218, 0.7)',
    '--curtain-title-a': '#fffaf0',
    '--curtain-title-b': '#f6e6bd',
    '--curtain-title-c': '#e3b65c',
  },
  liquid: ['#d9a640', '#b07a12', '#8f5e08', '#6a4204', '#4a2c02'],
  silk: { light: '#f6f2e6', shade: '#dbccad', tint: '#f2dc9e', sheen: '#fffcf2', rim: '#050a12' },
  ribbon: ['#f8e2a0', '#efbf4c', '#c88a14'],
  ribbonSheen: '#fff0c4',
  ribbonEmissive: '#1c1304',
  drop: '#f0b53a',
  dropSheen: '#fff4d2',
  dropEmissive: '#221704',
  powder: ['#e6c06a', '#f0d28e', '#d9a944', '#f7e5b0', '#c58f22'],
  helix: ['#f2c14e', '#b98510', '#fbf3dc'],
  rung: '#b3a88c',
  dust: '#c99a2e',
  edge: '#ffc23a',
  rim: '#ffe7b0',
  shadow: ['#1a1407', '#120e05'],
}

// arancio zafferano dell'etichetta (#f3ac4b), terra bruciata per le scene scure
const ASHWAGANDHA = {
  swatch: '#f3a43f',
  palette: {
    paper: '#f5f1ea',
    mist: '#ebe2d4',
    ink: '#120d08',
    plum: '#22140a',
    night: '#100b07',
    abyss: '#090604',
    wine: '#41230c',
    berry: '#a85a0d',
    berryHi: '#f7a948',
  },
  css: {
    '--quot-dot': '#ec8f2c',
    '--rit-glass-a': 'rgba(246, 212, 164, 0.66)',
    '--rit-glass-b': 'rgba(234, 170, 96, 0.82)',
    '--down-shadow': 'rgba(90, 50, 15, 0.45)',
    '--curtain': '#2e1a09',
    '--curtain-glow': 'rgba(190, 100, 25, 0.3)',
    '--curtain-ink': '#fbf2e6',
    '--curtain-ink-soft': 'rgba(251, 238, 220, 0.72)',
    '--curtain-copy': 'rgba(251, 238, 220, 0.7)',
    '--curtain-title-a': '#fff8ef',
    '--curtain-title-b': '#f9dfbd',
    '--curtain-title-c': '#eba35a',
  },
  liquid: ['#e89a3c', '#c06e12', '#9a5208', '#6e3904', '#4a2502'],
  silk: { light: '#f7f1e8', shade: '#e0c9ae', tint: '#f5c992', sheen: '#fffaf2', rim: '#040b14' },
  ribbon: ['#fbd9a8', '#f3a54a', '#cf6f16'],
  ribbonSheen: '#ffe6c4',
  ribbonEmissive: '#1f0f04',
  drop: '#f39b3a',
  dropSheen: '#fff0dc',
  dropEmissive: '#241104',
  powder: ['#eab06a', '#f3c88f', '#de9442', '#f8ddb7', '#c9742a'],
  helix: ['#f6a94a', '#c26a14', '#fcefe0'],
  rung: '#b8a48e',
  dust: '#cf8432',
  edge: '#ffb04a',
  rim: '#ffdcb0',
  shadow: ['#1c1208', '#130c05'],
}

// rosso dell'etichetta (#db3b2d) con l'oro di "Cardio Premium"
const COENZIMA_Q10 = {
  swatch: '#d9302a',
  palette: {
    paper: '#f5f1f0',
    mist: '#e9e0de',
    ink: '#120a0a',
    plum: '#240a09',
    night: '#0f0707',
    abyss: '#090404',
    wine: '#470e0b',
    berry: '#b3241d',
    berryHi: '#ff6a5a',
  },
  css: {
    '--quot-dot': '#d4261f',
    '--rit-glass-a': 'rgba(246, 198, 192, 0.66)',
    '--rit-glass-b': 'rgba(226, 134, 122, 0.82)',
    '--down-shadow': 'rgba(90, 15, 12, 0.45)',
    '--curtain': '#2c0a08',
    '--curtain-glow': 'rgba(170, 30, 22, 0.32)',
    '--curtain-ink': '#fbf0ee',
    '--curtain-ink-soft': 'rgba(250, 234, 230, 0.72)',
    '--curtain-copy': 'rgba(250, 234, 230, 0.7)',
    '--curtain-title-a': '#fff6f2',
    '--curtain-title-b': '#f6dccd',
    '--curtain-title-c': '#e8b546',
  },
  liquid: ['#e0483a', '#b8241b', '#911812', '#650e0b', '#430705'],
  silk: { light: '#f7f0ef', shade: '#dcc6c3', tint: '#f2b3aa', sheen: '#fffafa', rim: '#040e0e' },
  ribbon: ['#f8c1b9', '#ee6457', '#c22b20'],
  ribbonSheen: '#ffdcd6',
  ribbonEmissive: '#1f0504',
  drop: '#ea4b3f',
  dropSheen: '#ffe3df',
  dropEmissive: '#260605',
  powder: ['#e88d83', '#f2b0a8', '#d9675c', '#f8d2cd', '#dcb123'],
  helix: ['#f05a4c', '#b3241d', '#fbecea'],
  rung: '#c9a76a',
  dust: '#d0483d',
  edge: '#ff6a55',
  rim: '#ffd2c8',
  shadow: ['#1c0908', '#140505'],
}

// tortora e cioccolato dell'etichetta (#cab8aa, #36190f)
const COLLAGENE_BOVINO = {
  swatch: '#6b4535',
  palette: {
    paper: '#f3f1ef',
    mist: '#e6e0db',
    ink: '#100d0c',
    plum: '#1e140f',
    night: '#0e0b0a',
    abyss: '#080605',
    wine: '#3a2017',
    berry: '#7a4b36',
    berryHi: '#d9bfae',
  },
  css: {
    '--quot-dot': '#5e3a2b',
    '--rit-glass-a': 'rgba(224, 210, 200, 0.66)',
    '--rit-glass-b': 'rgba(178, 154, 138, 0.82)',
    '--down-shadow': 'rgba(50, 32, 24, 0.45)',
    '--curtain': '#2a1c16',
    '--curtain-glow': 'rgba(130, 90, 68, 0.32)',
    '--curtain-ink': '#f7f2ee',
    '--curtain-ink-soft': 'rgba(244, 236, 230, 0.72)',
    '--curtain-copy': 'rgba(244, 236, 230, 0.7)',
    '--curtain-title-a': '#fbf8f5',
    '--curtain-title-b': '#eadfd6',
    '--curtain-title-c': '#bf9f8b',
  },
  liquid: ['#9c7a64', '#6f4c3b', '#55372a', '#3c251c', '#281812'],
  silk: { light: '#f5f2ef', shade: '#d7cdc6', tint: '#dccbbf', sheen: '#fffcfa', rim: '#0a0b0d' },
  ribbon: ['#e9ddd3', '#c0a490', '#8a6754'],
  ribbonSheen: '#f7ece4',
  ribbonEmissive: '#140c09',
  drop: '#b08c74',
  dropSheen: '#f6ebe2',
  dropEmissive: '#1a110c',
  powder: ['#c4ab99', '#d8c6b8', '#a98c78', '#ebe0d7', '#8c6e5b'],
  helix: ['#c9a68d', '#7a4b36', '#f6efe9'],
  rung: '#aaa29c',
  dust: '#9a7a65',
  edge: '#e8b48f',
  rim: '#f0dccd',
  shadow: ['#16100d', '#0f0b09'],
}

// viola profondo e magenta dell'etichetta (#691f63, #b3216b)
const COLLAGENE_MARINO_COMPRESSE = {
  swatch: '#7a2272',
  palette: {
    paper: '#f2f0f4',
    mist: '#e5e0ea',
    ink: '#0f0c12',
    plum: '#1c0a1e',
    night: '#0d0910',
    abyss: '#08050a',
    wine: '#3d0f40',
    berry: '#9b2479',
    berryHi: '#e070c8',
  },
  css: {
    '--quot-dot': '#7e1f74',
    '--rit-glass-a': 'rgba(222, 190, 222, 0.66)',
    '--rit-glass-b': 'rgba(186, 132, 192, 0.82)',
    '--down-shadow': 'rgba(60, 14, 64, 0.45)',
    '--curtain': '#2a0a30',
    '--curtain-glow': 'rgba(124, 30, 130, 0.32)',
    '--curtain-ink': '#f6eef7',
    '--curtain-ink-soft': 'rgba(242, 230, 245, 0.72)',
    '--curtain-copy': 'rgba(242, 230, 245, 0.7)',
    '--curtain-title-a': '#fcf6fd',
    '--curtain-title-b': '#efdcf1',
    '--curtain-title-c': '#cf96d6',
  },
  liquid: ['#8f4a96', '#661a70', '#4c0d55', '#33073a', '#200325'],
  silk: { light: '#f4eff5', shade: '#d5c8d9', tint: '#e3cde6', sheen: '#fdfbff', rim: '#0a0d08' },
  ribbon: ['#ecc8ee', '#cf8fd2', '#9e4fa6'],
  ribbonSheen: '#f8dcfa',
  ribbonEmissive: '#180519',
  drop: '#cc7ed2',
  dropSheen: '#fbe4fc',
  dropEmissive: '#1d0620',
  powder: ['#cf9ad4', '#e2b9e6', '#bb7ac1', '#f0d6f2', '#b3216b'],
  helix: ['#d97be0', '#9a2f9e', '#f8eaf9'],
  rung: '#a49bb0',
  dust: '#b459bb',
  edge: '#e98bff',
  rim: '#f2d6ff',
  shadow: ['#170a1a', '#100612'],
}

// blu royal dell'etichetta (#2c539e) e blu notte (#1f3362)
const MAGNESIO = {
  swatch: '#2c539e',
  palette: {
    paper: '#f1f2f5',
    mist: '#e0e4ec',
    ink: '#0b0d12',
    plum: '#0b1226',
    night: '#080a10',
    abyss: '#05060a',
    wine: '#13244f',
    berry: '#2c539e',
    berryHi: '#7fa6f0',
  },
  css: {
    '--quot-dot': '#2a4f9a',
    '--rit-glass-a': 'rgba(198, 212, 240, 0.66)',
    '--rit-glass-b': 'rgba(128, 158, 214, 0.82)',
    '--down-shadow': 'rgba(14, 28, 70, 0.45)',
    '--curtain': '#0d1a3a',
    '--curtain-glow': 'rgba(44, 83, 158, 0.34)',
    '--curtain-ink': '#eef2fa',
    '--curtain-ink-soft': 'rgba(228, 236, 250, 0.72)',
    '--curtain-copy': 'rgba(228, 236, 250, 0.7)',
    '--curtain-title-a': '#f7f9fe',
    '--curtain-title-b': '#d8e2f6',
    '--curtain-title-c': '#8eaee8',
  },
  liquid: ['#4a78d0', '#2c539e', '#1f3e80', '#14295a', '#0a1838'],
  silk: { light: '#f1f3f7', shade: '#c9d1e0', tint: '#c9d7f2', sheen: '#fbfcff', rim: '#0d0a04' },
  ribbon: ['#cfdcf7', '#7ea2e6', '#2f5cb8'],
  ribbonSheen: '#e2ebff',
  ribbonEmissive: '#040a1c',
  drop: '#5c86d8',
  dropSheen: '#e6eeff',
  dropEmissive: '#050c22',
  powder: ['#9db6e6', '#bccdf0', '#7e9cda', '#dfe7f8', '#3a64b8'],
  helix: ['#7fa6f0', '#2c539e', '#eef3ff'],
  rung: '#9aa3b6',
  dust: '#4a74c8',
  edge: '#6aa0ff',
  rim: '#d6e4ff',
  shadow: ['#0b0e18', '#070910'],
}

// terracotta/rame dell'etichetta (#a75339) e bordeaux scuro (#72241d)
const VITAMINA_B12 = {
  swatch: '#a75339',
  palette: {
    paper: '#f4f0ed',
    mist: '#e8dfd9',
    ink: '#110c0a',
    plum: '#220d09',
    night: '#0f0907',
    abyss: '#090504',
    wine: '#4a170f',
    berry: '#a24a31',
    berryHi: '#f0956f',
  },
  css: {
    '--quot-dot': '#9b412f',
    '--rit-glass-a': 'rgba(238, 208, 192, 0.66)',
    '--rit-glass-b': 'rgba(206, 148, 118, 0.82)',
    '--down-shadow': 'rgba(70, 30, 15, 0.45)',
    '--curtain': '#2e110b',
    '--curtain-glow': 'rgba(167, 83, 57, 0.34)',
    '--curtain-ink': '#faf1ec',
    '--curtain-ink-soft': 'rgba(248, 234, 226, 0.72)',
    '--curtain-copy': 'rgba(248, 234, 226, 0.7)',
    '--curtain-title-a': '#fff7f3',
    '--curtain-title-b': '#f3d9cc',
    '--curtain-title-c': '#d98b66',
  },
  liquid: ['#bf6a45', '#a24a31', '#7e3423', '#572215', '#36130b'],
  silk: { light: '#f6f1ee', shade: '#dac9c0', tint: '#eec2ad', sheen: '#fffbf9', rim: '#040c10' },
  ribbon: ['#f2cfbe', '#d6835c', '#a24a31'],
  ribbonSheen: '#ffe2d5',
  ribbonEmissive: '#1c0904',
  drop: '#cc6e48',
  dropSheen: '#ffe6da',
  dropEmissive: '#220b05',
  powder: ['#d9a084', '#e8bfa9', '#c67f5d', '#f3dccf', '#a75339'],
  helix: ['#e8845c', '#a24a31', '#fbefe9'],
  rung: '#b0a096',
  dust: '#bf6440',
  edge: '#ff9a6a',
  rim: '#ffd8c4',
  shadow: ['#1a0e09', '#120905'],
}

// arancio vivo dell'etichetta (#fb7e06), piu' rosso e acceso dello zafferano dell'Ashwagandha
const VITAMINA_C = {
  swatch: '#fb7e06',
  palette: {
    paper: '#f6f1ec',
    mist: '#eee1d5',
    ink: '#120c07',
    plum: '#271006',
    night: '#110905',
    abyss: '#0a0503',
    wine: '#4e1d04',
    berry: '#c4510a',
    berryHi: '#ff8f2e',
  },
  css: {
    '--quot-dot': '#f26a0a',
    '--rit-glass-a': 'rgba(250, 208, 170, 0.66)',
    '--rit-glass-b': 'rgba(246, 150, 76, 0.82)',
    '--down-shadow': 'rgba(100, 40, 8, 0.45)',
    '--curtain': '#321405',
    '--curtain-glow': 'rgba(240, 100, 10, 0.3)',
    '--curtain-ink': '#fff4ea',
    '--curtain-ink-soft': 'rgba(255, 238, 224, 0.72)',
    '--curtain-copy': 'rgba(255, 238, 224, 0.7)',
    '--curtain-title-a': '#fffaf3',
    '--curtain-title-b': '#ffdcc0',
    '--curtain-title-c': '#fb8f3a',
  },
  liquid: ['#fb8a26', '#e0600a', '#b44805', '#7c3003', '#4f1d02'],
  silk: { light: '#f8f2ec', shade: '#e3c8b1', tint: '#f9c08c', sheen: '#fffaf4', rim: '#020a14' },
  ribbon: ['#fdd3ad', '#fb8a2e', '#e05a08'],
  ribbonSheen: '#ffe2c6',
  ribbonEmissive: '#220c02',
  drop: '#fb7e14',
  dropSheen: '#fff0e0',
  dropEmissive: '#260d03',
  powder: ['#f8a45a', '#fbc08a', '#f58a30', '#fde0c4', '#e0600a'],
  helix: ['#ff8f2e', '#d2560c', '#fff1e4'],
  rung: '#bba08a',
  dust: '#e06a1c',
  edge: '#ffa040',
  rim: '#ffdcb8',
  shadow: ['#1e0f06', '#150a04'],
}

// i barattoli "pilloliera" (stesso flacone della Bromelina) sono piu' stretti del collagene in polvere:
// nella hero si mostrano piu' grandi per pesare quanto lui
// D-Mannosio Uro Care: rosa acceso dell'etichetta con l'accento verde acqua di "URO CARE"
const D_MANNOSIO = {
  swatch: '#e0559b',
  palette: {
    paper: '#f6f0f3',
    mist: '#ece0e6',
    ink: '#120a0e',
    plum: '#260a19',
    night: '#10070c',
    abyss: '#0a0408',
    wine: '#4a0d2c',
    berry: '#c22d78',
    berryHi: '#ff7cbc',
  },
  css: {
    '--quot-dot': '#e0479a',
    '--rit-glass-a': 'rgba(248, 200, 222, 0.66)',
    '--rit-glass-b': 'rgba(236, 136, 182, 0.82)',
    '--down-shadow': 'rgba(96, 16, 56, 0.45)',
    '--curtain': '#2e0a1c',
    '--curtain-glow': 'rgba(210, 50, 130, 0.3)',
    '--curtain-ink': '#fdf0f6',
    '--curtain-ink-soft': 'rgba(252, 232, 242, 0.72)',
    '--curtain-copy': 'rgba(252, 232, 242, 0.7)',
    '--curtain-title-a': '#fff6fa',
    '--curtain-title-b': '#f9d6e7',
    '--curtain-title-c': '#5fd6ae',
  },
  liquid: ['#ec6aa8', '#d23d86', '#a82266', '#741546', '#480b2b'],
  silk: { light: '#f8f0f4', shade: '#e1c5d3', tint: '#f6b3d2', sheen: '#fffafc', rim: '#03100c' },
  ribbon: ['#fac7de', '#ee6eaa', '#c9307b'],
  ribbonSheen: '#ffdcec',
  ribbonEmissive: '#200512',
  drop: '#ec5ea2',
  dropSheen: '#ffe6f1',
  dropEmissive: '#260615',
  powder: ['#f190bf', '#f7b6d5', '#e3609e', '#fbd7e8', '#2fb58c'],
  helix: ['#f06aac', '#bf2c76', '#fdeef5'],
  rung: '#6cc9a8',
  dust: '#d84a90',
  edge: '#ff74b8',
  rim: '#ffd0e6',
  shadow: ['#1d0812', '#14050c'],
}

// Diosmina ed Esperidina: rosso piu' freddo del Coenzima Q10, con l'argento dell'onda in etichetta
const DIOSMINA = {
  swatch: '#cf2e3b',
  palette: {
    paper: '#f4f1f2',
    mist: '#e6e0e2',
    ink: '#110a0c',
    plum: '#230a0f',
    night: '#0e0709',
    abyss: '#080405',
    wine: '#440c16',
    berry: '#b51f30',
    berryHi: '#ff6574',
  },
  css: {
    '--quot-dot': '#d22a3a',
    '--rit-glass-a': 'rgba(244, 196, 202, 0.66)',
    '--rit-glass-b': 'rgba(222, 126, 138, 0.82)',
    '--down-shadow': 'rgba(86, 14, 24, 0.45)',
    '--curtain': '#2a0a10',
    '--curtain-glow': 'rgba(176, 28, 44, 0.32)',
    '--curtain-ink': '#fbf0f1',
    '--curtain-ink-soft': 'rgba(248, 232, 234, 0.72)',
    '--curtain-copy': 'rgba(248, 232, 234, 0.7)',
    '--curtain-title-a': '#fff7f8',
    '--curtain-title-b': '#efd9dc',
    '--curtain-title-c': '#c4c9d1',
  },
  liquid: ['#e2465a', '#bd2235', '#951626', '#680d19', '#43070f'],
  silk: { light: '#f6f0f1', shade: '#d9c7ca', tint: '#efb3bb', sheen: '#fdfbfc', rim: '#060c10' },
  ribbon: ['#f6c3ca', '#e65d6f', '#bd2235'],
  ribbonSheen: '#ffdde1',
  ribbonEmissive: '#1e0408',
  drop: '#e04a5d',
  dropSheen: '#ffe3e7',
  dropEmissive: '#250509',
  powder: ['#e98b98', '#f2b1ba', '#d9606f', '#f7d3d8', '#b9c0c9'],
  helix: ['#ef5a6c', '#b51f30', '#f9ecee'],
  rung: '#b3b9c2',
  dust: '#cf4152',
  edge: '#ff6b7d',
  rim: '#ffd3d9',
  shadow: ['#1b080b', '#130507'],
}

// Vitamina D3 + K2: verde dell'etichetta con l'onda lime
const VITAMINA_D3_K2 = {
  swatch: '#2c9e3a',
  palette: {
    paper: '#f1f4ef',
    mist: '#e2e9df',
    ink: '#0b100a',
    plum: '#0d1f0d',
    night: '#080e08',
    abyss: '#040804',
    wine: '#123e14',
    berry: '#24862f',
    berryHi: '#7ddc6a',
  },
  css: {
    '--quot-dot': '#2ea43b',
    '--rit-glass-a': 'rgba(198, 232, 188, 0.66)',
    '--rit-glass-b': 'rgba(128, 196, 112, 0.82)',
    '--down-shadow': 'rgba(18, 70, 22, 0.45)',
    '--curtain': '#0b250f',
    '--curtain-glow': 'rgba(60, 170, 60, 0.28)',
    '--curtain-ink': '#f2faf0',
    '--curtain-ink-soft': 'rgba(232, 246, 228, 0.72)',
    '--curtain-copy': 'rgba(232, 246, 228, 0.7)',
    '--curtain-title-a': '#f8fff4',
    '--curtain-title-b': '#dcf2d2',
    '--curtain-title-c': '#bfe04a',
  },
  liquid: ['#5cc04a', '#34a03a', '#1f7d2a', '#13561c', '#0a3611'],
  silk: { light: '#f1f6ef', shade: '#c9dac3', tint: '#bfe6b0', sheen: '#fbfff9', rim: '#100410' },
  ribbon: ['#cdedbf', '#72c858', '#2b9a36'],
  ribbonSheen: '#e4f8dc',
  ribbonEmissive: '#061a07',
  drop: '#4cb848',
  dropSheen: '#e8fbe2',
  dropEmissive: '#071f08',
  powder: ['#8fd27a', '#b7e3a6', '#5fbf52', '#dcf2d2', '#c8e04a'],
  helix: ['#62cc55', '#24862f', '#eef9ea'],
  rung: '#c7d77a',
  dust: '#3faa42',
  edge: '#7de06a',
  rim: '#d6f5c8',
  shadow: ['#0b1a0b', '#071107'],
}

const PILL_BOTTLE = 1.28

/*
  Geometria per i dettagli agganciati al barattolo e le inquadrature dell'etichetta (choreography.js).
  Misure in metri dalla base, dai barattolo_3d.py dei prodotti (jarH = altezza del modello).
  L'etichetta avvolge `span` radianti con il centro sul fronte; dose, gmp e table sono punti della
  grafica in coordinate 0..1 (u da sinistra, v dall'alto) misurati sull'etichetta_hd.png di ogni
  prodotto: dose e gmp sono i due dettagli della scena 5b (testi in content.js, pins).
*/
// pilloliera con tappo a strappo (Bromelina e stesso flacone): etichetta 195 x 75 mm
const STRAPPO = {
  jarH: 0.12245,
  span: 5.787,
  labelBottom: 0.0088,
  labelHeight: 0.075,
  labelR: 0.0338,
  cap: { deg: 84, r: 0.0246, y: 0.11545 }, // aletta di apertura della calotta
  band: { deg: 62, r: 0.0227, y: 0.1077 }, // anello di garanzia (resta sul flacone), sotto la fascetta
}
// pilloliera con tappo a vite e fascetta (s = scala del flacone, etichetta in mm reali)
const vite = (s, span, labelBottom, labelHeight) => ({
  jarH: 0.12135 * s,
  span,
  labelBottom,
  labelHeight,
  labelR: 0.0339 * s,
  cap: { deg: 50, r: 0.0236 * s, y: 0.1145 * s },
  band: { deg: 62, r: 0.0226 * s, y: 0.1048 * s },
})
// pilloliera piccola da 100 ml (Vitamina D3-K2): misure reali, etichetta 140 x 44 mm
const PICCOLA = {
  jarH: 0.0785,
  span: 5.903,
  labelBottom: 0.0046,
  labelHeight: 0.044,
  labelR: 0.0237,
  cap: { deg: 50, r: 0.0175, y: 0.0716 }, // zigrinatura del tappo
  band: { deg: 62, r: 0.0176, y: 0.059 }, // anello di garanzia
}

// /models/<id>.glb?v=<hash del file>: versioni scritte da scripts/sync-model.mjs
const glb = (id) => `/models/${id}.glb?v=${MODEL_VERSIONS[id] ?? 0}`

/*
  form: animazione della sezione del bicchiere (powder, capsule, tablet); shape: 'oval' per la
  compressa ovale con la linea di frattura (le altre sono rotonde); perDay: capsule o compresse al
  giorno dell'etichetta (le stesse di daily in src/content.js): nella macro se ne vede una, alla fine
  si posano tutte accanto al bicchiere; maintenance: dose di mantenimento, posata a parte accanto
  alle altre con la sua etichetta (il secondo dato di daily.facts).
*/
export const PRODUCTS = [
  {
    id: 'collagene',
    form: 'powder',
    name: 'Collagene marino',
    note: 'In polvere',
    model: glb('collagene'),
    // tabella nutrizionale e dettagli della narrazione sono tarati su questa etichetta
    labelAnchors: true,
    theme: COLLAGENE,
  },
  {
    id: 'collagene-marino-compresse',
    form: 'tablet',
    perDay: 3,
    name: 'Collagene marino',
    note: 'Compresse',
    model: glb('collagene-marino-compresse'),
    geo: { ...STRAPPO, dose: { u: 0.58, v: 0.41 }, gmp: { u: 0.76, v: 0.13 }, table: 0.175 },
    heroScale: PILL_BOTTLE,
    theme: COLLAGENE_MARINO_COMPRESSE,
  },
  {
    id: 'collagene-bovino',
    form: 'tablet',
    perDay: 3,
    name: 'Collagene bovino',
    note: 'Compresse',
    model: glb('collagene-bovino'),
    geo: { ...STRAPPO, dose: { u: 0.6, v: 0.285 }, gmp: { u: 0.777, v: 0.138 }, table: 0.17 },
    heroScale: PILL_BOTTLE,
    theme: COLLAGENE_BOVINO,
  },
  {
    id: 'bromelina',
    form: 'tablet',
    perDay: 2, // la prima settimana
    maintenance: 1, // poi una al giorno
    name: 'Bromelina',
    note: 'Alto dosaggio',
    model: glb('bromelina'),
    geo: { ...STRAPPO, dose: { u: 0.57, v: 0.355 }, gmp: { u: 0.757, v: 0.13 }, table: 0.175 },
    heroScale: PILL_BOTTLE,
    theme: BROMELINA,
  },
  {
    id: 'ashwagandha',
    form: 'tablet',
    perDay: 1,
    name: 'Ashwagandha',
    note: 'Certificata KSM-66',
    model: glb('ashwagandha'),
    geo: { ...STRAPPO, dose: { u: 0.57, v: 0.33 }, gmp: { u: 0.716, v: 0.088 }, table: 0.15 },
    heroScale: PILL_BOTTLE,
    theme: ASHWAGANDHA,
  },
  {
    id: 'coenzima-q10',
    form: 'capsule',
    perDay: 2,
    name: 'Coenzima Q10',
    note: 'Cardio Premium',
    model: glb('coenzima-q10'),
    geo: { ...STRAPPO, dose: { u: 0.59, v: 0.34 }, gmp: { u: 0.716, v: 0.09 }, table: 0.15 },
    heroScale: PILL_BOTTLE,
    theme: COENZIMA_Q10,
  },
  {
    id: 'd-mannosio',
    form: 'tablet',
    perDay: 3,
    name: 'D-Mannosio',
    note: 'Uro Care',
    model: glb('d-mannosio'),
    geo: { ...STRAPPO, dose: { u: 0.575, v: 0.36 }, gmp: { u: 0.716, v: 0.088 }, table: 0.149 },
    heroScale: PILL_BOTTLE,
    theme: D_MANNOSIO,
  },
  {
    id: 'diosmina',
    form: 'capsule',
    perDay: 2,
    name: 'Diosmina',
    note: 'Ed esperidina 1200',
    model: glb('diosmina'),
    geo: { ...STRAPPO, dose: { u: 0.58, v: 0.365 }, gmp: { u: 0.716, v: 0.088 }, table: 0.149 },
    heroScale: PILL_BOTTLE,
    theme: DIOSMINA,
  },
  {
    id: 'magnesio',
    form: 'tablet',
    shape: 'oval',
    perDay: 2,
    name: 'Magnesio bisglicinato',
    note: 'Con vitamine B1, B6, B12',
    model: glb('magnesio'),
    geo: { ...vite(1, 5.644, 0.0063, 0.08), dose: { u: 0.43, v: 0.4 }, gmp: { u: 0.334, v: 0.646 }, table: 0.165 },
    heroScale: PILL_BOTTLE,
    theme: MAGNESIO,
  },
  {
    id: 'vitamina-b12',
    form: 'tablet',
    perDay: 1,
    name: 'Vitamina B12',
    note: 'Metilcobalamina',
    // flacone piu' piccolo (etichetta 130 x 50 mm): l'inquadratura lo porta alla stessa altezza degli altri
    model: glb('vitamina-b12'),
    geo: { ...vite(0.6667, 5.8, 0.00587, 0.05), dose: { u: 0.43, v: 0.38 }, gmp: { u: 0.333, v: 0.72 }, table: 0.14 },
    heroScale: PILL_BOTTLE,
    theme: VITAMINA_B12,
  },
  {
    id: 'vitamina-c',
    form: 'tablet',
    shape: 'oval',
    perDay: 1,
    name: 'Vitamina C',
    note: 'Con rosa canina',
    model: glb('vitamina-c'),
    geo: { ...vite(1, 5.783, 0.0088, 0.075), dose: { u: 0.45, v: 0.39 }, gmp: { u: 0.333, v: 0.66 }, table: 0.15 },
    heroScale: PILL_BOTTLE,
    theme: VITAMINA_C,
  },
  {
    id: 'vitamina-d3-k2',
    form: 'tablet',
    perDay: 1,
    name: 'Vitamina D3 + K2',
    note: 'MK-7, 2000 UI',
    // flacone piccolo da 100 ml: l'inquadratura lo porta alla stessa altezza degli altri
    model: glb('vitamina-d3-k2'),
    geo: { ...PICCOLA, dose: { u: 0.53, v: 0.36 }, gmp: { u: 0.3625, v: 0.707 }, table: 0.128 },
    heroScale: PILL_BOTTLE,
    theme: VITAMINA_D3_K2,
  },
]

export const productById = (id) => PRODUCTS.find((p) => p.id === id)
