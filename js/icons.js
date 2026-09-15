// Iconos pixel de DuckFinance, con los dos lenguajes que usa Emerald.dev:
//  - "bits": cuadros de 4px sobre cadencia de 5px (el menú y la navegación del sitio). Retícula 5×5 = 24px.
//  - "dots": matriz fina de puntos de 1.3px sobre cadencia 1.74px (la flecha de los botones), en caja de 16px.
// Se dibujan como SVG con bordes duros; heredan el color del texto.
(function (root) {
  const BITS = {
    duck: [
      '......####....',
      '.....######...',
      '.....##.###...',
      '.....#########',
      '.....#######..',
      '......#####...',
      '.#....#####...',
      '.##..######...',
      '.###########..',
      '..##########..',
      '...#########..',
      '....#######...'],
    limites: ['#####', '.....', '####.', '.....', '##...'],
    movs: ['.#..#.', '###.#.', '.#..#.', '.#..#.', '.#.###', '.#..#.'],
    cuentas: ['#####', '.....', '#####', '#...#', '#####'],
    metas: ['#####', '#...#', '#.#.#', '#...#', '#####'],
    ajustes: ['.#...', '#####', '.#...', '...#.', '#####'],
    menu: ['#####', '.....', '#####', '.....', '#####'],
    cerrar: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    izq: ['....#', '...#.', '..#..', '...#.', '....#'],
    der: ['#....', '.#...', '..#..', '.#...', '#....'],
    mas: ['..#..', '..#..', '#####', '..#..', '..#..'],
    menos: ['.....', '.....', '#####', '.....', '.....'],
    buscar: ['###..', '#.#..', '###..', '...#.', '....#'],
    sync: ['.###.', '#....', '#....', '#...#', '.###.'],
    check: ['....#', '...#.', '#.#..', '.#...', '.....'],
    descargar: ['..#..', '..#..', '#.#.#', '.###.', '#####'],
    borrar: ['#####', '.#.#.', '.#.#.', '.#.#.', '.###.'],
    flecha: ['..#..', '...#.', '#####', '...#.', '..#..'],
    voltear: ['.#...', '###..', '.#.#.', '..###', '...#.']
  };
  // Coordenadas en unidades de 1.74px (x) y 1.74px (y); las medias unidades reproducen la flecha del botón de Emerald.
  const DOTS = {
    flecha: [[0, 2.5], [1, 2.5], [2, 2.5], [3, 2.5], [4, 2.5], [5, 2.5], [6, 2.5], [7, 2.5], [4, 0], [5, 0.75], [6, 1.5], [6, 3.5], [5, 4.25], [4, 5]],
    check: [[0, 2.5], [1, 3.25], [2, 4], [3, 3.25], [4, 2.5], [5, 1.75], [6, 1], [7, 0.25]],
    cerrar: [0, 1, 2, 3, 4, 5, 6, 7].flatMap(i => [[i, i * 0.75], [i, 5.25 - i * 0.75]]),
    mas: [[0, 2.5], [1, 2.5], [2, 2.5], [3, 2.5], [4, 2.5], [5, 2.5], [6, 2.5], [7, 2.5], [3.5, 0], [3.5, 1], [3.5, 2], [3.5, 3], [3.5, 4], [3.5, 5]],
    menos: [[0, 2.5], [1, 2.5], [2, 2.5], [3, 2.5], [4, 2.5], [5, 2.5], [6, 2.5], [7, 2.5]]
  };
  const cache = {};
  function bits(name, size) {
    const bm = BITS[name];
    if (!bm) return '';
    const key = 'b' + name + (size || '');
    if (cache[key]) return cache[key];
    const w = bm[0].length, h = bm.length;
    let r = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bm[y][x] === '#') r += `<rect x="${x * 5}" y="${y * 5}" width="4" height="4"/>`;
    const vw = w * 5 - 1, vh = h * 5 - 1, px = size || vw;
    return (cache[key] = `<svg class="pi pi-${name}" viewBox="0 0 ${vw} ${vh}" width="${px}" height="${Math.round(px * vh / vw * 100) / 100}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${r}</svg>`);
  }
  function dots(name, size) {
    const d = DOTS[name];
    if (!d) return '';
    const key = 'd' + name + (size || '');
    if (cache[key]) return cache[key];
    const u = 1.74, s = 1.304, px = size || 16;
    const r = d.map(([x, y]) => `<rect x="${(x * u + 1.2).toFixed(2)}" y="${(y * u + 3.1).toFixed(2)}" width="${s}" height="${s}"/>`).join('');
    return (cache[key] = `<svg class="pi pd pd-${name}" viewBox="0 0 16 16" width="${px}" height="${px}" fill="currentColor" aria-hidden="true">${r}</svg>`);
  }
  root.Icons = { icon: bits, bits, dots, BITS, DOTS };
})(this);
