// Iconos pixel de DuckFinance: bloques de 3px sobre cadencia de 4px, como la navegación de Emerald
// (decisions/sistema-web-iconografia.md). Cada icono es un bitmap; se dibuja como SVG con bordes duros.
(function (root) {
  const BITMAPS = {
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
    limites: ['######', '......', '####..', '......', '##....', '......'],
    movs: ['.#..#.', '###.#.', '.#..#.', '.#..#.', '.#.###', '.#..#.'],
    cuentas: ['######', '#....#', '######', '#....#', '#....#', '######'],
    metas: ['######', '#....#', '#.##.#', '#.##.#', '#....#', '######'],
    ajustes: ['..#...', '######', '..#...', '....#.', '######', '....#.'],
    cerrar: ['#....#', '.#..#.', '..##..', '..##..', '.#..#.', '#....#'],
    izq: ['...#..', '..#...', '.#....', '.#....', '..#...', '...#..'],
    der: ['..#...', '...#..', '....#.', '....#.', '...#..', '..#...'],
    mas: ['..##..', '..##..', '######', '######', '..##..', '..##..'],
    menos: ['......', '......', '######', '######', '......', '......'],
    flecha: ['...#..', '....#.', '######', '######', '....#.', '...#..'],
    check: ['.....#', '....##', '#..##.', '####..', '.##...', '......'],
    sync: ['.####.', '#....#', '#.....', '.....#', '#....#', '.####.'],
    buscar: ['.###..', '#...#.', '#...#.', '.###..', '....##', '.....#'],
    descargar: ['..##..', '..##..', '######', '.####.', '..##..', '######'],
    borrar: ['.####.', '######', '.#..#.', '.#..#.', '.#..#.', '.####.'],
    editar: ['....##', '...##.', '..##..', '.##...', '##....', '#.....']
  };
  const cache = {};
  function icon(name, size) {
    const bm = BITMAPS[name];
    if (!bm) return '';
    const key = name + (size || '');
    if (cache[key]) return cache[key];
    const w = bm[0].length, h = bm.length;
    let r = '';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bm[y][x] === '#') r += `<rect x="${x * 4}" y="${y * 4}" width="3" height="3"/>`;
    const px = size || (w * 4 - 1);
    const svg = `<svg class="pi pi-${name}" viewBox="0 0 ${w * 4 - 1} ${h * 4 - 1}" width="${px}" height="${Math.round(px * (h * 4 - 1) / (w * 4 - 1))}" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">${r}</svg>`;
    return (cache[key] = svg);
  }
  root.Icons = { icon, BITMAPS };
})(this);
