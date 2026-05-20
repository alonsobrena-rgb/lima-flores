// Lima Flores — catálogo (datos)
window.LIMA = {
  info: {
    name: 'Lima Flores',
    tagline: 'Atelier botánico · desde 2017',
    whatsapp: '51999479855',
    phone: '999 479 855',
    phone2: '944 257 806',
    email: 'hola@limaflores.pe',
    instagram: 'lima_flores',
    facebook: 'limafloresperu',
    address: 'Calle Francia 823, Miraflores · Lima'
  },
  categories: [
    { id: 'arreglos', label: 'Arreglos', subtitle: 'Composiciones en caja o base', palette: ['#B6855E', '#ECE4D2'] },
    { id: 'ramos',    label: 'Ramos',    subtitle: 'Hechos a mano, papel artesanal', palette: ['#C99CA9', '#F4EFE5'] },
    { id: 'floreros', label: 'Floreros', subtitle: 'Cerámica y vidrio soplado',      palette: ['#4F5C3F', '#ECE4D2'] },
    { id: 'plantas',  label: 'Plantas',  subtitle: 'Orquídeas y suculentas',         palette: ['#A57F45', '#F4EFE5'] }
  ],
  products: [
    {
      id: 'orquideas-multicolor', name: 'Orquídeas Multicolor',
      category: 'plantas', categoryLabel: 'Plantas',
      price: 289, star: true, badge: 'La firma',
      image: 'assets/orquideas.jpg', palette: '#E8DDD0',
      shortDesc: 'Cuatro tallos Phalaenopsis en arco — amarillo, magenta, durazno y rosa pálido.',
      description: 'Cuatro tallos de Phalaenopsis seleccionados a mano y dispuestos en arco horizontal: amarillo mantequilla con corazón burdeos, magenta rayada blanca, durazno crema y rosa pálido. Duran entre ocho y doce semanas con riego mínimo. Llegan en maceta de cerámica blanca firmada.',
      details: [
        ['Especie', 'Phalaenopsis spp.'],
        ['Tallos', '4 — multicolor'],
        ['Altura', '60–70 cm'],
        ['Maceta', 'Cerámica blanca incluida'],
        ['Floración', '8 a 12 semanas'],
        ['Cuidado', 'Luz indirecta, riego semanal']
      ]
    },
    {
      id: 'jardin-frances', name: 'Jardín Francés',
      category: 'ramos', categoryLabel: 'Ramos',
      price: 165, image: 'assets/tulipanes.jpg', palette: '#D4A5B5',
      shortDesc: 'Peonías rosas, eustomas blancas y eucalipto. El ramo del mercado de los sábados.',
      description: 'Inspirado en los ramos de las floristas de Montmartre. Peonías rosa pálido, eustomas blancas, alstroemerias durazno y ramas de eucalipto baby. Envuelto en papel kraft natural con cinta de algodón musgo.',
      details: [
        ['Composición', '3 peonías, 5 eustomas, 4 alstroemerias, eucalipto'],
        ['Envoltorio', 'Papel kraft + cinta musgo'],
        ['Duración', '7 a 10 días']
      ]
    },
    {
      id: 'toscana', name: 'Toscana',
      category: 'arreglos', categoryLabel: 'Arreglos',
      price: 245, palette: '#C89B7E',
      shortDesc: 'Girasoles, rosas durazno y trigo seco en caja de madera. Cálido como una tarde de verano.',
      description: 'Tres girasoles abiertos, rosas durazno, mini gerberas y espigas de trigo dorado en caja de madera artesanal. Para regalar mucha luz.',
      details: [
        ['Composición', '3 girasoles, 6 rosas durazno, gerberas, trigo'],
        ['Base', 'Caja madera pino 25×25 cm'],
        ['Duración', '7 a 10 días']
      ]
    },
    {
      id: 'amalfi', name: 'Amalfi',
      category: 'floreros', categoryLabel: 'Floreros',
      price: 320, palette: '#5C6B4E', badge: 'Mesa principal',
      shortDesc: 'Hortensias azules y blancas en florero de vidrio soplado.',
      description: 'Hortensias azules y blancas, lisianthus y delphinium, en florero de vidrio soplado a mano transparente. Una pieza para mesa principal.',
      details: [
        ['Composición', 'Hortensias, lisianthus, delphinium'],
        ['Florero', 'Vidrio soplado a mano · 22 cm'],
        ['Duración', '6 a 8 días']
      ]
    },
    {
      id: 'bohemia', name: 'Bohemia',
      category: 'ramos', categoryLabel: 'Ramos',
      price: 135, palette: '#B8935A',
      shortDesc: 'Rosas blush, statice lila y ramas de olivo. Para una ocasión sin etiqueta.',
      description: 'Rosas blush, statice lila, craspedia amarillo y ramas frescas de olivo. Estilo silvestre, romántico, recogido a mano.',
      details: [
        ['Composición', '8 rosas blush, statice, craspedia, olivo'],
        ['Envoltorio', 'Papel artesanal beige + cordel'],
        ['Duración', '7 a 10 días']
      ]
    },
    {
      id: 'lisboa', name: 'Lisboa',
      category: 'arreglos', categoryLabel: 'Arreglos',
      price: 195, palette: '#D4A5B5',
      shortDesc: 'Claveles teñidos en tonos pastel, ranúnculos y verde plumoso.',
      description: 'Claveles dianthus en tonos pastel rosa y crema, ranúnculos blancos, gypsophila y verde plumoso, en jarro de cerámica artesanal con motivo azulejo.',
      details: [
        ['Composición', 'Claveles, ranúnculos, gypsophila'],
        ['Base', 'Jarro cerámica azulejo · 18 cm'],
        ['Duración', '7 a 9 días']
      ]
    },
    {
      id: 'paris', name: 'París',
      category: 'ramos', categoryLabel: 'Ramos',
      price: 185, palette: '#A8453C', badge: 'Clásico',
      shortDesc: '12 rosas rojas tallo largo en papel craft. El clásico que nunca falla.',
      description: 'Una docena de rosas rojas ecuatorianas de tallo largo, seleccionadas botón cerrado, envueltas en papel craft natural y cinta de seda burdeos.',
      details: [
        ['Composición', '12 rosas rojas tallo largo 60 cm'],
        ['Envoltorio', 'Papel craft + cinta seda burdeos'],
        ['Duración', '5 a 7 días']
      ]
    },
    {
      id: 'provence', name: 'Provence',
      category: 'floreros', categoryLabel: 'Floreros',
      price: 275, palette: '#5C6B4E',
      shortDesc: 'Lavanda fresca, romero y limonium. El sur de Francia en tu mesa.',
      description: 'Lavanda fresca, romero, limonium morado y ramas de olivo en florero de cerámica artesanal beige. Aromático, sobrio.',
      details: [
        ['Composición', 'Lavanda, romero, limonium, olivo'],
        ['Florero', 'Cerámica beige mate · 20 cm'],
        ['Duración', '10 a 14 días']
      ]
    },
    {
      id: 'suculentas-trio', name: 'Trío de Suculentas',
      category: 'plantas', categoryLabel: 'Plantas',
      price: 95, palette: '#5C6B4E',
      shortDesc: 'Tres suculentas en macetas de terracota. Para escritorios y manos olvidadizas.',
      description: 'Tres variedades de suculentas (echeveria, haworthia, sedum) en macetas individuales de terracota natural 8 cm. Riego cada 10–14 días.',
      details: [
        ['Especies', 'Echeveria, Haworthia, Sedum'],
        ['Macetas', '3 × terracota · 8 cm'],
        ['Cuidado', 'Luz directa, riego quincenal']
      ]
    },
    {
      id: 'mediterraneo', name: 'Mediterráneo',
      category: 'arreglos', categoryLabel: 'Arreglos',
      price: 215, palette: '#B8935A',
      shortDesc: 'Proteas, banksias y palmas. El aire seco de la costa española.',
      description: 'Proteas rosadas, banksias amarillas, hojas de palma y eucalipto plateado. Composición estructural, escultórica, de larga duración.',
      details: [
        ['Composición', '2 proteas, 2 banksias, palmas, eucalipto'],
        ['Base', 'Cerámica blanca cilíndrica'],
        ['Duración', '14 a 21 días']
      ]
    },
    {
      id: 'blanco-toscana', name: 'Blanco Toscana',
      category: 'ramos', categoryLabel: 'Ramos',
      price: 175, palette: '#E8DDD0',
      shortDesc: 'Rosas blancas, lisianthus crema y eucalipto. Monocromático y solemne.',
      description: 'Rosas blancas, lisianthus crema, hortensias blancas y eucalipto plateado. Envuelto en papel translúcido vellum y cinta blanca de algodón.',
      details: [
        ['Composición', 'Rosas blancas, lisianthus, hortensias, eucalipto'],
        ['Envoltorio', 'Papel vellum + cinta algodón'],
        ['Duración', '7 a 10 días']
      ]
    },
    {
      id: 'positano', name: 'Positano',
      category: 'floreros', categoryLabel: 'Floreros',
      price: 295, palette: '#D4A5B5',
      shortDesc: 'Buganvilias, geranios y limonios en jarro toscano.',
      description: 'Buganvilias rosa intenso, geranios coral y limonios morados en jarro toscano de cerámica con asas. Atrevido, mediterráneo.',
      details: [
        ['Composición', 'Buganvilias, geranios, limonios'],
        ['Florero', 'Cerámica toscana · 24 cm con asas'],
        ['Duración', '5 a 7 días']
      ]
    }
  ],
  // ─── Planes de suscripción ──────────────────────
  // Flores de estación, 2 entregas al mes. perMonth = total / months.
  plans: [
    {
      id: 'mensual', name: 'Mensual', months: 1, deliveries: 2,
      total: 190, perMonth: 190,
      blurb: 'Para probar, sin compromiso.',
      perks: [
        '2 entregas al mes · flores de estación',
        'Ramo armado a mano, siempre distinto',
        'Entrega a domicilio en Lima',
        'Pausa o cancela cuando quieras'
      ]
    },
    {
      id: 'trimestral', name: 'Trimestral', months: 3, deliveries: 6,
      total: 540, perMonth: 180,
      blurb: 'Tres meses de flores frescas.',
      perks: [
        'Todo lo del plan Mensual',
        '6 entregas · flores de estación',
        'Tarjeta escrita a mano en cada envío'
      ]
    },
    {
      id: 'semestral', name: 'Semestral', months: 6, deliveries: 12,
      total: 1020, perMonth: 170, featured: true, tag: 'Más popular',
      blurb: 'Seis meses, el ritmo ideal.',
      perks: [
        'Todo lo del plan Trimestral',
        '12 entregas · flores de estación',
        'Florero de cerámica de regalo',
        'Cambia tu día de entrega cuando quieras'
      ]
    },
    {
      id: 'anual', name: 'Anual', months: 12, deliveries: 24,
      total: 1920, perMonth: 160, tag: 'Mejor valor',
      blurb: 'Un año entero de estación.',
      perks: [
        'Todo lo del plan Semestral',
        '24 entregas · flores de estación',
        'Prioridad en San Valentín y Día de la Madre'
      ]
    }
  ]
};

// Genera un placeholder SVG elegante para productos sin foto
window.placeholderSVG = function(product) {
  const palette = product.palette || '#C89B7E';
  const name = product.name || '';
  const cat = (product.categoryLabel || '').toUpperCase();
  // Compose subtle striped warm background + botanical glyph
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return `
  <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${name}">
    <defs>
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${palette}" stop-opacity="0.32"/>
      </linearGradient>
      <pattern id="lines-${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="${palette}" stroke-opacity="0.10" stroke-width="1"/>
      </pattern>
      <radialGradient id="rg-${id}" cx="50%" cy="42%" r="50%">
        <stop offset="0%" stop-color="${palette}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${palette}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="500" fill="#FBF8F1"/>
    <rect width="400" height="500" fill="url(#bg-${id})"/>
    <rect width="400" height="500" fill="url(#lines-${id})"/>
    <rect width="400" height="500" fill="url(#rg-${id})"/>
    <g stroke="${palette}" stroke-opacity="0.55" fill="none" stroke-width="1.4" stroke-linecap="round">
      <path d="M200 380 C 200 320, 200 260, 200 200" />
      <path d="M200 270 C 175 245, 160 230, 145 215" />
      <path d="M200 240 C 225 215, 240 200, 255 185" />
      <path d="M200 210 C 178 195, 168 180, 158 165" />
      <ellipse cx="200" cy="190" rx="14" ry="22" fill="${palette}" fill-opacity="0.35"/>
      <ellipse cx="148" cy="218" rx="11" ry="18" fill="${palette}" fill-opacity="0.28" transform="rotate(-22 148 218)"/>
      <ellipse cx="258" cy="188" rx="11" ry="18" fill="${palette}" fill-opacity="0.32" transform="rotate(22 258 188)"/>
      <ellipse cx="155" cy="162" rx="9" ry="15" fill="${palette}" fill-opacity="0.3" transform="rotate(-30 155 162)"/>
      <ellipse cx="200" cy="160" rx="9" ry="14" fill="${palette}" fill-opacity="0.4"/>
    </g>
    <text x="32" y="32" font-family="Inter, sans-serif" font-size="10" letter-spacing="2.4" fill="#5E5A52">${cat}</text>
    <text x="32" y="468" font-family="'Cormorant Garamond', serif" font-style="italic" font-size="26" fill="#1B1A17">${name}</text>
  </svg>`;
};

window.formatSoles = (n) => 'S/ ' + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '');
