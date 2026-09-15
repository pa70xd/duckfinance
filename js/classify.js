// Clasificador por historial: aprende de los movimientos ya categorizados (concepto → categoría y cuenta)
// y propone categoría para un texto nuevo. Sin red, sin modelos: conteos por concepto exacto y por palabra.
(function (root) {
  const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'en', 'del', 'con', 'por', 'para', 'mx', 'mex', 'mexico', 'com', 'sa', 'cv', 'sapi', 'rl', 'inc', 'ltd', 'www', 'http', 'https', 'pago', 'compra', 'cargo', 'gpo', 'grupo', 'the', 'and', 'of', 'to', 'a', 'un', 'una', 'tienda', 'sucursal', 'suc', 'leon', 'gto', 'guanajuato', 'ciudad', 'cd']);
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function tokens(t) {
    return norm(t).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w) && !/^\d+$/.test(w) && (w.length > 2 || /^\d/.test(w)));
  }
  const CLAVE = t => tokens(t).join(' ');
  // Palabras que el usuario escribiría a mano y que el estado de cuenta nunca trae tal cual
  const SEED = {
    'Restaurantes y antojos': 'tacos taco restaurante restaurant comida cena desayuno cafe coffee starbucks pizza pizzas sushi hamburguesa hamburguesas burger carls mcdonalds kfc subway dominos ramen torta tortas antojo postre helado nieve caffenio dq boneless alitas birria pastel panaderia lonche pozole gorditas',
    'Gasolina': 'gasolina gas pemex gasolinera mirador bp shell g500 mobil repsol',
    'Despensa': 'super supermercado despensa abastos soriana chedraui heb fruta verdura carne tortillas mercado tiendita abarrotes oxxo',
    'Uber': 'uber didi taxi indrive viaje',
    'Farmacia y salud': 'farmacia doctor medico consulta medicina medicinas dentista similares benavides laboratorio analisis vitaminas',
    'Psicólogo': 'psicologo psicologa terapia cita',
    'Gym': 'gym gimnasio proteina creatina',
    'Megacable': 'megacable internet cable',
    'Luz CFE': 'cfe luz',
    'Agua SAPAL': 'sapal agua',
    'Telcel': 'telcel recarga saldo',
    'Hogar y ferretería': 'ferreteria home depot hogar truper foco focos tornillos pintura herramienta',
    'Salidas y entretenimiento': 'cine cinepolis cinemex bar cerveza chelas antro boliche concierto boletos salida billar karaoke peda',
    'Compras en línea': 'amazon mercadolibre meli aliexpress temu ebay envio shein',
    'Ropa': 'ropa zara bershka tenis zapatos playera pantalon camisa sudadera calcetines',
    'Videojuegos': 'steam juego videojuego playstation psn nintendo xbox epic gamepass',
    'Regalos': 'regalo regalos cumple cumpleanos detalle',
    'Servicio del auto': 'servicio taller llantas aceite afinacion frenos verificacion lavado autolavado bateria',
    'Refrendo': 'refrendo tenencia placas',
    'Escuela de Lucía': 'escuela colegiatura lucia ingles curso utiles',
    'Apoyo familiar': 'familia mama papa matilde hermana apoyo',
    'Efectivo de bolsillo': 'efectivo propina estacionamiento parquimetro cambio',
    'Fiestas y temporada': 'navidad posada reyes fiestas',
    'Seguro del auto': 'seguro poliza',
    'PC y tecnología': 'pc gpu teclado mouse monitor ssd ram computadora',
    'Claude Max': 'claude anthropic', 'Google One': 'google', 'YouTube Premium': 'youtube', 'Microsoft': 'microsoft office', 'Amazon Prime': 'prime', 'Disney+ (Mercado Libre)': 'disney'
  };
  const SEED_IDX = new Map();
  for (const [cat, words] of Object.entries(SEED)) for (const w of words.split(' ')) SEED_IDX.set(w, cat);

  function build(mov, categorias) {
    const conceptos = new Map(), palabras = new Map(), cuentas = new Map();
    const valid = new Set((categorias || []).map(c => c.nombre));
    const add = (map, k, cat, w) => { if (!k) return; let m = map.get(k); if (!m) map.set(k, m = new Map()); m.set(cat, (m.get(cat) || 0) + w); };
    for (const m of mov) {
      if (!(m.tipo === 'Gasto' || m.tipo === 'Compra a meses') || !m.categoria || (valid.size && !valid.has(m.categoria))) continue;
      const w = m.origen === 'app' ? 3 : 1; // lo que el usuario escribió a mano pesa más que el estado de cuenta
      const k = CLAVE(m.concepto);
      add(conceptos, k, m.categoria, w);
      for (const t of new Set(tokens(m.concepto))) add(palabras, t, m.categoria, w);
      if (m.cuenta) add(cuentas, k, m.cuenta, w);
    }
    return { conceptos, palabras, cuentas, valid };
  }

  const top = m => { let best = null, n = 0, total = 0; for (const [k, v] of m) { total += v; if (v > n) { n = v; best = k; } } return { best, n, total }; };

  // Devuelve [{categoria, score, cuenta}] ordenado; score en (0,1]. Lista vacía si no reconoce nada.
  function suggest(idx, text, limit) {
    const k = CLAVE(text);
    if (!k) return [];
    const scores = new Map();
    const exact = idx.conceptos.get(k);
    if (exact) for (const [cat, n] of exact) scores.set(cat, (scores.get(cat) || 0) + 2 * n / top(exact).total + 1);
    for (const t of new Set(tokens(text))) {
      const m = idx.palabras.get(t); if (!m) continue;
      const { total } = top(m);
      const peso = Math.log(1 + total);
      for (const [cat, n] of m) scores.set(cat, (scores.get(cat) || 0) + (n / total) * peso);
    }
    for (const t of new Set(tokens(text))) { const cat = SEED_IDX.get(t); if (cat && (!idx.valid.size || idx.valid.has(cat))) scores.set(cat, (scores.get(cat) || 0) + 1.5); }
    if (!scores.size) return [];
    const max = Math.max(...scores.values());
    const cta = idx.cuentas.get(k);
    return [...scores].sort((a, b) => b[1] - a[1]).slice(0, limit || 3)
      .map(([categoria, s]) => ({ categoria, score: Math.round(100 * s / (max + 0.5)) / 100, cuenta: cta ? top(cta).best : null }));
  }

  root.Classify = { build, suggest, tokens };
  if (typeof module !== 'undefined') module.exports = root.Classify;
})(this);
