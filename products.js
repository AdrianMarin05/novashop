const CONFIG = {
  storeName: 'NovaShop',
  whatsapp: '573000000000',
  currency: 'COP'
};

const products = [
  {
    id: 1,
    name: 'Smartwatch Active X',
    category: 'Tecnología',
    price: 89900,
    oldPrice: 129900,
    rating: 4.8,
    reviews: 127,
    tag: '-31%',
    images: [
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Un smartwatch moderno para acompañarte durante el día. Consulta notificaciones, registra tu actividad y disfruta de una pantalla clara con un diseño ligero y cómodo.',
    features: ['Pantalla táctil a color', 'Monitoreo de actividad', 'Notificaciones del teléfono', 'Diseño ligero y cómodo'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 2,
    name: 'Auriculares Pulse Pro',
    category: 'Tecnología',
    price: 119900,
    oldPrice: 169900,
    rating: 4.9,
    reviews: 204,
    tag: 'OFERTA',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Auriculares inalámbricos pensados para disfrutar música, llamadas y contenido con una experiencia cómoda y práctica todos los días.',
    features: ['Conexión inalámbrica', 'Micrófono integrado', 'Estuche de carga', 'Diseño ergonómico'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 3,
    name: 'Mochila Urban Compact',
    category: 'Accesorios',
    price: 74900,
    oldPrice: null,
    rating: 4.7,
    reviews: 86,
    tag: 'NUEVO',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Mochila urbana compacta para estudio, trabajo o viajes cortos. Combina un formato práctico con compartimentos para organizar tus objetos.',
    features: ['Compartimento principal amplio', 'Bolsillo frontal', 'Diseño urbano', 'Correas ajustables'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 4,
    name: 'Lámpara LED Minimal',
    category: 'Hogar',
    price: 58900,
    oldPrice: 79900,
    rating: 4.6,
    reviews: 72,
    tag: '-26%',
    images: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Lámpara de diseño minimalista para escritorio o mesa auxiliar. Una forma sencilla de mejorar la iluminación y el ambiente de tu espacio.',
    features: ['Iluminación LED', 'Diseño minimalista', 'Ideal para escritorio', 'Bajo consumo'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 5,
    name: 'Botella Térmica Steel',
    category: 'Hogar',
    price: 49900,
    oldPrice: null,
    rating: 4.8,
    reviews: 119,
    tag: 'TOP',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1599360889420-da1afaba9edc?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Botella térmica reutilizable con acabado moderno, pensada para llevar tus bebidas contigo en el día a día.',
    features: ['Acabado resistente', 'Tapa de cierre', 'Diseño reutilizable', 'Formato portátil'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 6,
    name: 'Gafas Urban Sun',
    category: 'Moda',
    price: 63900,
    oldPrice: 89900,
    rating: 4.7,
    reviews: 64,
    tag: '-29%',
    images: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1577803645773-f96470509666?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1508296695146-257a814070b4?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Gafas de sol con una silueta urbana y fácil de combinar. Un accesorio pensado para looks casuales y modernos.',
    features: ['Montura ligera', 'Estilo urbano', 'Diseño unisex', 'Estuche protector'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 7,
    name: 'Sneakers Street One',
    category: 'Moda',
    price: 189900,
    oldPrice: 229900,
    rating: 4.9,
    reviews: 141,
    tag: 'HOT',
    images: [
      'https://images.unsplash.com/photo-1495555961986-6d4c1ecb7be3?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Sneakers de estilo urbano para complementar outfits casuales. Diseño cómodo para el uso diario y una estética fácil de combinar.',
    features: ['Diseño urbano', 'Suela flexible', 'Interior acolchado', 'Uso casual'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  },
  {
    id: 8,
    name: 'Organizador Smart Desk',
    category: 'Oficina',
    price: 44900,
    oldPrice: null,
    rating: 4.6,
    reviews: 51,
    tag: 'NUEVO',
    images: [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1100&q=85',
      'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=85',
      'https://images.unsplash.com/photo-1516383607781-913a19294fd1?auto=format&fit=crop&w=900&q=85'
    ],
    description: 'Organizador de escritorio para mantener cables, accesorios y pequeños objetos en orden mientras trabajas o estudias.',
    features: ['Formato compacto', 'Organización de accesorios', 'Diseño minimalista', 'Ideal para escritorio'],
    shipping: 'Envíos a todo Colombia. Confirma cobertura y tiempo de entrega por WhatsApp.'
  }
];

const categoryMeta = [
  {name:'Tecnología',count:'2 productos',image:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'},
  {name:'Moda',count:'2 productos',image:'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=900&q=80'},
  {name:'Hogar',count:'2 productos',image:'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'},
  {name:'Accesorios',count:'1 producto',image:'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=80'}
];
