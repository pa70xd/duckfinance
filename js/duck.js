// El pato: cuenta cómo va el mes con la resolución de un cartucho pirata de NES ("999 in 1"):
// sprites de 16×16 con 3 colores + transparente, paleta del 2C02, 8 cuadros por segundo y cada pixel a 4px de pantalla.
(function (root) {
  const S = 4, FPS = 8;
  const PAL = { k: '#000000', y: '#F8B800', o: '#E45C10', w: '#FCFCFC', b: '#3CBCFC', g: '#BCBCBC', e: '#00A844', l: '#ACACAC' };

  const WALK = [
    '................',
    '.........kkkk...',
    '........kyyyyk..',
    '........kyyyyk..',
    '........kyyyyooo',
    '........kyyyyoo.',
    '.kk.....kyyyk...',
    '.kyk...kyyyyk...',
    '.kyykkkyyyyyyk..',
    '.kyyyyyyyyyyyk..',
    '.kyyyykkkkyyyk..',
    '..kyyyyyyyyyyk..',
    '...kyyyyyyyyk...',
    '....kkkkkkkk....',
    '.....o...o......',
    '....oo..oo......'];
  const patch = (base, rows) => base.map((r, i) => rows[i] !== undefined ? rows[i] : r);
  const SPR = {
    walk1: WALK,
    walk2: patch(WALK, { 10: '.kyyykkkkyyyyk..', 14: '......o.o.......', 15: '.....oo.oo......' }),
    jump: patch(WALK, { 8: '.kyykkkkkyyyyk..', 9: '.kyykyyykyyyyk..', 10: '.kyyykkkyyyyyk..', 14: '....oo..oo......', 15: '................' }),
    // sentado: sin patas, dos pixeles más abajo
    sit: ['................', '................', ...WALK.slice(0, 14)],
    drop: ['.b.', 'bbb', 'bwb', '.b.'],
    tear: ['b', 'b'],
    cloud: ['....kkkk......', '..kkggggkkk...', '.kggggggggkk..', 'kggggggggggggk', 'kggggggggggggk', '.kkkkkkkkkkkk.'],
    z: ['kkkk', '..k.', '.k..', 'kkkk'],
    spark: ['..y..', '..y..', 'yyoyy', '..y..', '..y..']
  };
  // Ojos por humor, en coordenadas del sprite mirando a la derecha (en "sit" van 2 filas abajo)
  const EYES = { normal: [[11, 3]], closed: [[10, 3], [11, 3]], wide: [[11, 2], [11, 3]], sad: [[10, 3], [11, 4]] };

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = { mood: null, msg: '', x: 6, dir: 1, t: 0, hop: 0, shake: 0, wake: 0, fx: [], W: 80, H: 24, canvas: null, ctx: null, say: null, raf: 0, last: 0, sayTimer: 0, sayText: '', sayUntil: 0 };
  const HOP = [-2, -4, -5, -5, -4, -2];

  function blit(ctx, spr, ox, oy, flip) {
    const w = spr[0].length;
    for (let y = 0; y < spr.length; y++) for (let x = 0; x < w; x++) {
      const c = spr[y][flip ? w - 1 - x : x];
      if (c === '.') continue;
      ctx.fillStyle = PAL[c]; ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }

  function ground(ctx) {
    const y = st.H - 1;
    ctx.fillStyle = PAL.l;
    for (let x = 0; x < st.W; x += 2) ctx.fillRect(x, y, 1, 1);
    ctx.fillStyle = PAL.e; // matas fijas, como fondo de nivel
    for (let x = 5; x < st.W; x += 23) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1); ctx.fillRect(x + 1, y - 2, 1, 1); }
  }

  function draw() {
    const ctx = st.ctx; if (!ctx) return;
    ctx.clearRect(0, 0, st.W, st.H);
    ground(ctx);
    const flip = st.dir < 0, m = st.mood;
    const sentado = m === 'mal' || (m === 'dormido' && st.wake <= 0);
    let spr, eyes, dy = 0;
    if (sentado) { spr = SPR.sit; eyes = m === 'mal' ? EYES.sad : EYES.closed; }
    else if (st.hop > 0) { spr = SPR.jump; eyes = EYES.normal; dy = HOP[HOP.length - st.hop]; }
    else {
      const paso = m === 'nervioso' ? st.t % 2 : Math.floor(st.t / 2) % 2;
      spr = paso ? SPR.walk2 : SPR.walk1;
      eyes = m === 'nervioso' ? EYES.wide : (st.t % 28 === 0 ? EYES.closed : EYES.normal);
    }
    const bx = st.x + (st.shake ? (st.t % 2 ? 1 : -1) : 0), by = st.H - 1 - 16 + dy;
    blit(ctx, spr, bx, by, flip);
    ctx.fillStyle = PAL.k;
    const off = spr === SPR.sit ? 2 : 0;
    for (const [ex, ey] of eyes) ctx.fillRect(bx + (flip ? 15 - ex : ex), by + ey + off, 1, 1);
    for (const f of st.fx) blit(ctx, SPR[f.s], Math.round(f.x), Math.round(f.y), false);
  }

  function spawn(s, x, y, vx, vy, life) { st.fx.push({ s, x, y, vx, vy, life }); }
  const headX = () => st.x + (st.dir > 0 ? 11 : 4);

  function step() {
    st.t++;
    const W = st.W, m = st.mood, min = 1, max = W - 17;
    if (st.wake > 0) st.wake--;
    if (st.shake > 0) st.shake--;
    if (st.hop > 0) st.hop--;
    if (m === 'feliz' || (m === 'dormido' && st.wake > 0)) {
      if (st.hop <= 0 && st.t % 2 === 0) st.x += st.dir;
      if (Math.random() < 1 / 60 && st.hop <= 0) { st.hop = HOP.length; spawn('spark', headX(), st.H - 22, 0, -0.5, 6); }
    } else if (m === 'nervioso') {
      if (st.shake <= 0) st.x += st.dir * 2;
      if (Math.random() < 1 / 40) st.shake = 6;
      if (st.t % 6 === 0) spawn('drop', st.x + (st.dir > 0 ? 6 : 7), st.H - 20, -st.dir * 0.3, -0.4, 4);
    } else if (m === 'mal') {
      const centro = Math.round(W / 2) - 8;
      if (st.x !== centro && st.t % 3 === 0) st.x += Math.sign(centro - st.x);
      if (st.t % 2 === 0) spawn('tear', st.x + 1 + Math.floor(Math.random() * 13), 6, 0, 1.5, 9);
      if (st.t % 14 === 0) spawn('tear', st.x + (st.dir > 0 ? 11 : 4), st.H - 12, 0, 1, 3);
    } else if (m === 'dormido') {
      if (st.t % 12 === 0) spawn('z', headX() + (st.dir > 0 ? 2 : -5), st.H - 16, 0.35 * st.dir, -0.5, 14);
    }
    if (st.x < min) { st.x = min; st.dir = 1; }
    if (st.x > max) { st.x = max; st.dir = -1; }
    st.fx = st.fx.filter(f => { f.x += f.vx; f.y += f.vy; return --f.life > 0 && f.y < st.H - 1; });
    if (m === 'mal') st.fx.unshift({ s: 'cloud', x: st.x + 1, y: 0, vx: 0, vy: 0, life: 1 });
  }

  function loop(now) {
    if (!st.canvas || !st.canvas.isConnected) { st.raf = 0; return; }
    if (now - st.last >= 1000 / FPS) { st.last = now; step(); draw(); placeSay(); }
    st.raf = requestAnimationFrame(loop);
  }

  function placeSay() {
    const b = st.say; if (!b || b.hidden) return;
    const w = b.offsetWidth, full = st.W * S;
    const derecha = st.x + 8 < st.W / 2;
    let left = derecha ? (st.x + 18) * S + 8 : (st.x - 1) * S - w - 8; // margen para el borde pixel de 4px
    left = Math.max(0, Math.min(full - w, left));
    b.style.left = left + 'px';
    b.classList.toggle('from-l', derecha);
  }

  function say(text, ms) {
    const b = st.say; if (!b) return;
    b.textContent = st.sayText = text;
    st.sayUntil = Date.now() + ms;
    b.hidden = false;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    placeSay();
    clearTimeout(st.sayTimer);
    st.sayTimer = setTimeout(() => { b.hidden = true; }, ms);
  }

  function poke() {
    if (st.mood === 'dormido') { st.wake = 24; say('EH? ' + st.msg, 2800); return; }
    if (st.mood === 'mal') { st.shake = 6; say(st.msg, 2800); return; }
    st.hop = HOP.length;
    spawn('spark', headX(), st.H - 22, 0, -0.5, 6);
    say(st.msg, 2800);
  }

  // stage: contenedor con <canvas> y <div class="duck-say">. announce: dice su mensaje al entrar.
  function mount(stage, mood, msg, announce) {
    const canvas = stage.querySelector('canvas');
    st.canvas = canvas; st.say = stage.querySelector('.duck-say');
    st.W = Math.max(40, Math.floor(stage.clientWidth / S));
    canvas.width = st.W; canvas.height = st.H;
    canvas.style.width = st.W * S + 'px'; canvas.style.height = st.H * S + 'px';
    st.ctx = canvas.getContext('2d');
    st.ctx.imageSmoothingEnabled = false;
    const cambio = mood !== st.mood;
    if (cambio) { st.mood = mood; st.fx = []; st.hop = 0; st.shake = 0; st.wake = 0; }
    st.msg = msg;
    canvas.setAttribute('aria-label', 'Pato: ' + msg);
    st.x = Math.max(1, Math.min(st.W - 17, st.x));
    canvas.onclick = poke;
    if (announce || cambio) setTimeout(() => say(msg, 3600), REDUCED ? 0 : 350);
    else if (st.sayUntil > Date.now()) { // la pantalla se redibujó (p. ej. al sincronizar): el globo sigue donde iba, sin volver a aparecer
      st.say.textContent = st.sayText; st.say.hidden = false;
      clearTimeout(st.sayTimer); st.sayTimer = setTimeout(() => { st.say.hidden = true; }, st.sayUntil - Date.now());
    }
    step(); draw();
    if (!REDUCED && !st.raf) st.raf = requestAnimationFrame(loop);
  }

  root.Duck = { mount, poke };
})(this);
