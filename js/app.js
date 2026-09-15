(function () {
  'use strict';
  const { computeAll, categoryEffect, isoDate, addMonths, TIPOS } = Logic;

  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const f2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (x, dec) => (dec ? f2 : f0).format(x || 0); // guion ASCII: Minecraft no tiene el signo menos tipografico
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const mesLargo = k => { const [y, m] = k.split('-'); return MESES[+m - 1] + ' ' + y; };
  const fechaC = iso => { const [y, m, d] = iso.split('-'); return +d + ' ' + MES_C[+m - 1] + ' ' + y; };
  const pct = x => Math.round((x || 0) * 100) + '%';
  // Minecraft no dibuja mayúsculas acentuadas: el kicker las pierde al mostrarse (Editorial Syntax v1)
  const kicker = txt => '/' + txt.toUpperCase().replace(/[ÁÉÍÓÚ]/g, c => 'AEIOU'['ÁÉÍÓÚ'.indexOf(c)]) + '._';
  const BRAND = `<div class="brand"><span class="mark">${Icons.bits('duck', 19)}</span><span class="word">duckfinance</span></div>`;
  const hoy = () => isoDate(new Date());
  const I = (n, size) => Icons.bits(n, size);
  const Dot = (n, size) => Icons.dots(n, size);
  const REG = side => `<i class="reg ${side}" aria-hidden="true"></i>`;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- estado ----------
  const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const state = { vista: store('df.vista', 'limites'), mes: hoy().slice(0, 7), filtroLim: 'todos', filtroMov: 'todos', q: '' };
  let D = null, R = null, IDX = null;
  const app = document.getElementById('app');

  function recompute() {
    D = Store.data();
    if (!D) { R = null; return; }
    R = computeAll(D, state.mes, hoy());
    IDX = Classify.build(D.mov, D.categorias);
  }
  function mesesDisponibles() {
    const s = new Set(D ? D.mov.map(m => m.fecha.slice(0, 7)) : []);
    s.add(hoy().slice(0, 7));
    return [...s].sort();
  }

  // ---------- render principal ----------
  let enter = true, lastQueda = null;
  function render() {
    if (!Store.configured()) return renderSetup();
    recompute();
    if (!D) {
      const sk = (w, h) => `<div class="sk" style="width:${w};height:${h}px;margin-top:12px"></div>`;
      app.innerHTML = `<header class="blk top"><div class="top-row">${BRAND}</div></header><div class="blk hero" style="min-height:100vh">${REG('r')}
        <p class="kicker">${kicker('Cargando')}</p>${sk('80%', 40)}${sk('60%', 40)}<div style="margin-top:28px">${sk('55%', 48)}</div>${sk('100%', 8)}
        <p class="sup" style="margin-top:24px">${esc(Store.status.error || 'Descargando tu base de GitHub…')}</p>
        ${Store.status.error ? '<button class="btn secondary" data-act="settings" style="margin-top:12px">Ajustes</button>' : ''}</div>`;
      return;
    }
    const scroll = window.scrollY;
    const act = document.activeElement, focusQ = act && act.id === 'q', caret = focusQ ? act.selectionStart : 0;
    const firstKeys = !$('.keys');
    app.innerHTML = `${header()}<main class="${enter ? 'enter' : ''}">${VIEWS[state.vista]()}</main>${nav()}
      <div class="keys ${firstKeys ? 'in' : ''}"><button class="key black" data-act="nuevo" data-tipo="Ingreso" aria-label="Registrar ingreso">${I('mas', 20)}<span>Ingreso</span></button>
      <button class="key green" data-act="nuevo" data-tipo="Gasto" aria-label="Registrar gasto">${I('menos', 20)}<span>Gasto</span></button></div>`;
    if (!enter) window.scrollTo(0, scroll);
    const q = $('#q'); if (q && focusQ) { q.focus(); q.setSelectionRange(caret, caret); }
    if (enter && state.vista === 'limites') countUp($('#queda'), lastQueda, R.resumen.queda);
    lastQueda = R.resumen.queda;
    enter = false;
  }
  // Cambio de pantalla con entrada animada (sin View Transitions: en Chrome Android dejaban la pantalla congelada).
  function go(fn) { enter = true; fn(); render(); }
  function countUp(el, from, to) {
    if (!el || REDUCED) return;
    const t0 = performance.now(), dur = 550, ini = from === null ? 0 : from;
    const tick = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = money(ini + (to - ini) * e); if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  function header() {
    const meses = mesesDisponibles(), i = meses.indexOf(state.mes);
    const st = Store.status, pend = Store.pending();
    let cls = '', txt = 'Al día';
    if (st.syncing) { cls = 'busy'; txt = pend ? `Subiendo ${pend}` : 'Sincronizando'; }
    else if (st.error) { cls = pend ? 'warn' : 'err'; txt = pend ? `${pend} sin subir` : 'Sin conexión'; }
    else if (pend) { cls = 'warn'; txt = `${pend} pendientes`; }
    return `<header class="blk top">
      <div class="top-row">${BRAND}
        <div class="tools"><button class="sync label ${cls}" data-act="sync" title="${esc(st.error || '')}">${I('sync', 14)}${txt}</button>
        <button class="iconbtn" data-act="settings" aria-label="Ajustes">${I('menu', 20)}</button></div></div>
      ${state.vista === 'limites' || state.vista === 'movs' ? `<div class="month">
        <button class="iconbtn" data-act="mes" data-d="-1" ${i <= 0 ? 'disabled' : ''} aria-label="Mes anterior">${I('izq', 16)}</button>
        <div class="h-case" aria-live="polite">${mesLargo(state.mes)}</div>
        <button class="iconbtn" data-act="mes" data-d="1" ${i >= meses.length - 1 ? 'disabled' : ''} aria-label="Mes siguiente">${I('der', 16)}</button></div>` : ''}
    </header>`;
  }

  const VISTAS = ['limites', 'movs', 'cuentas', 'metas'];
  function nav() {
    const b = (v, t) => `<button data-act="vista" data-v="${v}" ${state.vista === v ? 'aria-current="page"' : ''}>${I(v, 22)}<span class="nav-t">${t}</span></button>`;
    return `<nav class="nav" aria-label="Secciones"><div class="in"><i class="ind" style="transform:translateX(${VISTAS.indexOf(state.vista) * 100}%)"></i>${b('limites', 'Límites')}${b('movs', 'Movimientos')}${b('cuentas', 'Cuentas')}${b('metas', 'Metas')}</div></nav>`;
  }
  function tabs(act, opts, cur, label, attr) {
    const i = Math.max(0, opts.findIndex(o => o[0] === cur));
    const a = attr ? v => `type="button" ${attr}="${v}"` : v => `data-act="${act}" data-v="${v}"`;
    return `<div class="tabs" role="group" aria-label="${label}"><i class="thumb" style="width:${100 / opts.length}%;transform:translateX(${i * 100}%)"></i>${opts.map(([v, t]) => `<button ${a(v)} aria-pressed="${cur === v}">${t}</button>`).join('')}</div>`;
  }

  function bar(p, sm) {
    const w = Math.max(0, Math.min(1, p || 0)) * 100;
    return `<div class="bar ${sm ? 'sm' : ''} ${p > 1 ? 'bad' : p >= 0.8 ? 'warn' : ''}"><i style="width:${w}%"></i></div>`;
  }
  const ESTADO = { bien: 'Bien', cerca: 'Cerca', mal: 'Pasado' };

  // ---------- LÍMITES (pantalla principal) ----------
  function vLimites() {
    const s = R.resumen, uso = s.presupuesto ? s.gastadoPresup / s.presupuesto : 0;
    const antes = state.mes < D.config.inicio.slice(0, 7);
    const actual = state.mes === hoy().slice(0, 7);
    const n = R.cats.filter(c => c.presupuestada).length;
    let h = `<section class="blk hero">${REG('r')}
      <p class="kicker">${kicker('Limites · ' + mesLargo(state.mes).split(' ')[0])}</p>
      <div class="big n ${s.queda < 0 ? 'neg' : ''}" id="queda">${money(s.queda)}</div>
      <div class="mlabel" style="margin-top:6px">${s.queda < 0 ? 'de mas sobre' : 'disponibles de'} ${money(s.presupuesto)}</div>
      ${bar(uso)}
      <div class="proof" style="margin-top:12px;font-size:14px;color:var(--muted)">${pct(uso)} gastado${s.sinClasificar ? ' · ' + money(s.sinClasificar) + ' por clasificar' : ''}${actual ? ' · faltan ' + diasRestantes() + ' dias' : ''}</div>
      <div class="badges">${s.rojo ? `<span class="badge mal">${s.rojo} pasad${s.rojo === 1 ? 'a' : 'as'}</span>` : ''}${s.amarillo ? `<span class="badge cerca">${s.amarillo} cerca</span>` : ''}${!s.rojo && !s.amarillo ? `<span class="badge bien">${n} en orden</span>` : ''}</div>
      ${actual ? pagosTarjeta().filter(t => t.dias <= 5 && !t.pagado).map(t => `<button class="note pay" data-act="pagar" data-card="${esc(t.nombre)}"><span><b>${esc(t.nombre)}:</b> ${t.dias === 0 ? 'hoy es el día límite de pago' : t.dias === 1 ? 'mañana es el día límite de pago' : `pago en ${t.dias} días (${fechaC(t.vence)})`}</span><span class="link">Registrar pago</span></button>`).join('') : ''}
      ${s.comprasMsiMes.length ? `<div class="note bad"><b>Compra nueva a meses: ${money(s.comprasMsiMes.reduce((a, m) => a + m.monto, 0))}.</b> La regla es cero, salvo el seguro del auto en abril.</div>` : ''}
    </section>
    <section class="blk">${REG('l')}<div class="stack">
      <p class="kicker">${kicker('Por categoria')}</p>
      ${tabs('flim', [['todos', 'Todos'], ['riesgo', 'En riesgo']], state.filtroLim, 'Filtro')}`;
    const grupos = [...new Set(R.cats.filter(c => c.presupuestada).map(c => c.grupo))];
    let alguno = false;
    if (R.porClasificar.length && state.filtroLim === 'todos') {
      const pc = R.porClasificar, tot = pc.reduce((a, m) => a + m.monto, 0);
      h += `<div class="group warnb"><div class="group-h"><span class="proof">Por clasificar</span><span class="label n">${pc.length} · ${money(tot)}</span></div>
        ${pc.slice(0, 4).map(m => `<button class="row" data-act="clasificar" data-id="${esc(m.id)}"><div class="row-t"><span class="name">${esc(m.concepto)}</span><span class="amt n">${money(m.monto, true)}</span></div><div class="sup"><span>${fechaC(m.fecha)} · ${esc(m.cuenta)}</span><span>Toca para clasificar</span></div></button>`).join('')}
        ${pc.length > 4 ? `<div class="empty">y ${pc.length - 4} más</div>` : ''}
        <div class="pad" style="padding-top:4px"><button class="btn primary block" data-act="clasificar">Clasificar ahora${Dot('flecha')}</button></div></div>`;
    }
    for (const g of grupos) {
      let cs = R.cats.filter(c => c.grupo === g && c.presupuestada);
      if (state.filtroLim === 'riesgo') cs = cs.filter(c => c.estado === 'mal' || c.estado === 'cerca');
      if (!cs.length) continue;
      alguno = true;
      const tl = cs.reduce((a, c) => a + c.limite, 0), tg = cs.reduce((a, c) => a + c.gastado, 0);
      h += `<div class="group"><div class="group-h"><span class="proof">${esc(g)}</span><span class="label n">${money(tg)} / ${money(tl)}</span></div>`;
      h += cs.map(rowCat).join('') + `</div>`;
    }
    if (!alguno) h += `<div class="group"><div class="empty">Ninguna categoría está cerca de su límite.</div></div>`;
    const otras = R.cats.filter(c => !c.presupuestada && c.gastado !== 0 && c.tipo !== 'Ingreso');
    if (otras.length && state.filtroLim === 'todos') {
      h += `<div class="group"><div class="group-h"><span class="proof">Fuera del presupuesto</span><span class="label n">${money(otras.reduce((a, c) => a + c.gastado, 0))}</span></div>
        ${otras.map(c => `<button class="row" data-act="cat" data-n="${esc(c.nombre)}"><div class="row-t"><span class="name">${esc(c.nombre)}</span><span class="amt n">${money(c.gastado)}</span></div><div class="sup"><span>${esc(c.tipo)}</span><span>${c.movs} mov.</span></div></button>`).join('')}</div>`;
    }
    return h + `</div></section>`;
  }
  // Próximo pago de cada tarjeta de crédito: día límite de este mes o del siguiente, y si ya hay un pago registrado para ese corte
  function pagosTarjeta() {
    const h = hoy(), out = [];
    for (const c of R.cuentas) {
      if (c.tipo !== 'Crédito' || !c.pago || !c.corte) continue;
      const [y, mo] = h.split('-').map(Number);
      let vence = `${y}-${String(mo).padStart(2, '0')}-${String(c.pago).padStart(2, '0')}`;
      if (vence < h) vence = addMonths(vence, 1);
      // el corte que se paga es el anterior al vencimiento (RappiCard: corte 15 → pago día 4 del mes siguiente)
      let corte = `${vence.slice(0, 8)}${String(c.corte).padStart(2, '0')}`;
      if (corte >= vence) corte = addMonths(corte, -1);
      const pagado = D.mov.filter(m => m.tipo === 'Pago de tarjeta' && m.destino === c.nombre && m.fecha > corte).reduce((a, m) => a + m.monto, 0);
      const dias = Math.round((new Date(vence + 'T00:00:00') - new Date(h + 'T00:00:00')) / 864e5);
      out.push({ nombre: c.nombre, vence, corte, dias, pagado, saldo: c.saldo });
    }
    return out;
  }
  function diasRestantes() {
    const d = new Date(), fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return fin.getDate() - d.getDate() + 1;
  }
  function rowCat(c) {
    const semanal = c.tipo === 'Mensual' && (c.grupo === 'Estilo de vida' || c.nombre === 'Despensa') && state.mes === hoy().slice(0, 7);
    if (c.tipo === 'Fondo acumulable') {
      return `<button class="row" data-act="cat" data-n="${esc(c.nombre)}"><div class="row-t"><span class="name">${esc(c.nombre)}</span><span class="amt n ${c.acumulado < 0 ? 'neg' : ''}">Fondo ${money(c.acumulado)}</span></div>
        <div class="sup n"><span>Este mes ${money(c.gastado)}</span><span>Aparta ${money(c.limite)}/mes</span></div></button>`;
    }
    return `<button class="row" data-act="cat" data-n="${esc(c.nombre)}"><div class="row-t"><span class="name">${esc(c.nombre)}</span><span class="amt n ${c.restante < 0 ? 'neg' : ''}">${c.restante < 0 ? 'Pasado ' + money(-c.restante) : 'Queda ' + money(c.restante)}</span></div>
      ${bar(c.pct, true)}
      <div class="sup n"><span>${money(c.gastado)} de ${money(c.limite)}</span><span>${semanal ? `Semana ${money(c.semana)} / ${money(c.limiteSemanal)}` : pct(c.pct)}</span></div></button>`;
  }

  // ---------- MOVIMIENTOS ----------
  function vMovs() {
    const s = R.resumen;
    const balance = s.ingresos - s.gastoPropio;
    const q = state.q.trim().toLowerCase();
    const f = state.filtroMov;
    const rows = R.movMes.filter(m => {
      if (f === 'gastos' && !['Gasto', 'Compra a meses', 'Cuota a meses'].includes(m.tipo)) return false;
      if (f === 'ingresos' && !['Ingreso', 'Reembolso'].includes(m.tipo)) return false;
      if (f === 'otros' && !['Pago de tarjeta', 'Transferencia', 'Ajuste de saldo'].includes(m.tipo)) return false;
      return !q || [m.concepto, m.nota, m.categoria, m.cuenta, String(m.monto)].join(' ').toLowerCase().includes(q);
    });
    let h = `<section class="blk inv">${REG('r')}
      <div class="mrow"><span class="metric n ${balance < 0 ? 'neg' : ''}">${money(balance)}</span><span class="mlabel">balance del mes</span></div>
      <div class="stats"><div><div class="label">Ingresos</div><div class="v n pos">${money(s.ingresos)}</div></div><div><div class="label">Gastos</div><div class="v n">${money(s.gastoPropio)}</div></div></div>
    </section>
    <section class="blk">${REG('l')}<div class="stack">
      <div class="search">${I('buscar', 16)}<input id="q" type="search" placeholder="Buscar concepto, nota o monto" value="${esc(state.q)}" aria-label="Buscar" autocomplete="off"></div>
      ${tabs('fmov', [['todos', 'Todos'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos'], ['otros', 'Otros']], f, 'Tipo')}`;
    if (!rows.length) return h + `<div class="group"><div class="empty">Sin movimientos con ese filtro en ${mesLargo(state.mes)}.</div></div></div></section>`;
    h += `<div class="group">`;
    let dia = null;
    for (const m of rows) {
      if (m.fecha !== dia) {
        dia = m.fecha;
        const d = new Date(dia + 'T00:00:00');
        const tot = rows.filter(x => x.fecha === dia).reduce((a, x) => a + categoryEffect(x), 0);
        h += `<div class="day-h"><span class="proof" style="font-size:14px">${DIAS[d.getDay()]} ${fechaC(dia)}</span>${tot ? `<span class="label n">${money(tot, true)}</span>` : ''}</div>`;
      }
      h += rowMov(m);
    }
    return h + `</div></div></section>`;
  }
  function rowMov(m) {
    const signo = ['Ingreso', 'Reembolso'].includes(m.tipo) ? '+' : ['Gasto', 'Compra a meses', 'Cuota a meses'].includes(m.tipo) ? '−' : '';
    const detalle = m.destino ? `${m.cuenta} → ${m.destino}` : [m.categoria, m.cuenta].filter(Boolean).join(' · ');
    return `<button class="row" data-act="edit" data-id="${esc(m.id)}"><div class="row-t"><span class="name">${esc(m.concepto || m.categoria || m.tipo)}</span>
      <span class="amt n ${signo === '+' ? 'pos' : ''}">${signo}${money(m.monto, true)}</span></div>
      <div class="sup"><span>${esc(detalle)}</span><span>${m.tipo !== 'Gasto' ? `<span class="tag">${esc(m.tipo)}</span>` : ''}${!m.categoria && m.tipo === 'Gasto' ? '<span class="tag pend">Por clasificar</span>' : ''}${m._pendiente ? '<span class="tag">Sin subir</span>' : ''}</span></div></button>`;
  }

  // ---------- CUENTAS ----------
  function vCuentas() {
    const s = R.resumen;
    let h = `<section class="blk inv">${REG('r')}<p class="kicker">${kicker('Patrimonio')}</p>
      <div class="mrow" style="margin-top:14px"><span class="metric n ${s.neto < 0 ? 'neg' : ''}">${money(s.neto)}</span><span class="mlabel">${s.neto < 0 ? 'patrimonio neto negativo' : 'patrimonio neto'}</span></div>
      <div class="split"><div><div class="label">Tienes</div><div class="v n">${money(s.tienes)}</div></div>
      <div><div class="label">Tarjetas</div><div class="v n">${money(s.deudaTarjetas)}</div></div>
      <div><div class="label">Total deuda</div><div class="v n">${money(s.debes)}</div></div></div>
      <p class="sup" style="margin:12px 0 0">La deuda incluye el crédito del auto; el valor del coche no se cuenta.</p></section>
    <section class="blk">${REG('l')}<div class="stack"><p class="kicker">${kicker('Saldos')}</p><div class="group">`;
    const ultima = {};
    for (const m of D.mov) for (const c of [m.cuenta, m.destino]) if (c && m.tipo !== 'Ajuste de saldo' && (!ultima[c] || m.fecha > ultima[c])) ultima[c] = m.fecha;
    for (const c of R.cuentas) {
      const cred = c.tipo === 'Crédito';
      h += `<div class="row"><div class="row-t"><span class="name"><b style="font-weight:600">${esc(c.nombre)}</b></span><span class="amt n">${money(c.saldo, true)}</span></div>
        ${cred && c.limite ? bar(c.saldo / c.limite, true) : ''}
        <div class="sup n"><span>${cred ? 'Debes' : esc(c.tipo)}${ultima[c.nombre] ? ' · último mov. ' + fechaC(ultima[c.nombre]) : ''}</span><span>${cred && c.limite ? 'Disponible ' + money(c.disponible) : ''}</span></div>
        ${cred && c.corte ? (() => { const t = pagosTarjeta().find(x => x.nombre === c.nombre); return `<div class="sup"><span>Corte día ${c.corte} · límite de pago ${t ? fechaC(t.vence) : '~día ' + c.pago}${t && t.pagado ? ` · pagado ${money(t.pagado)}` : ''}</span></div>
          <div style="margin-top:10px"><button class="btn ${t && !t.pagado && t.dias <= 5 ? 'primary' : 'secondary'}" data-act="pagar" data-card="${esc(c.nombre)}">Pagar ${esc(c.nombre)}${Dot('flecha')}</button></div>`; })() : ''}</div>`;
    }
    h += `</div>`;
    const act = R.deudas.filter(d => d.activa && !d.auto).sort((a, b) => b.pendiente - a.pendiente);
    const liq = R.deudas.filter(d => !d.activa && !d.auto);
    const auto = R.deudas.find(d => d.auto);
    h += `<p class="kicker" style="margin-top:8px">${kicker('Compras a meses')}</p>
      <div class="group"><div class="group-h"><span class="label" style="color:var(--ink)">Te falta ${money(s.pendienteMsi)}</span><span class="label n">${money(s.cuotaActiva)}/mes · ${act.length} activas</span></div>
      ${act.map(d => `<div class="row"><div class="row-t"><span class="name">${esc(d.compra)}</span><span class="amt n">${money(d.pendiente)}</span></div>${bar(1 - d.pendiente / d.original, true)}
        <div class="sup n"><span>${esc(d.tarjeta)} · ${money(d.cuota)}/mes · faltan ${d.restantes}</span><span>${d.termina ? MES_C[+d.termina.slice(5, 7) - 1] + ' ' + d.termina.slice(0, 4) : ''}</span></div></div>`).join('')}
      ${liq.length ? `<details><summary><span>${liq.length} liquidadas</span>${I('der', 12)}</summary>${liq.map(d => `<div class="row"><div class="row-t"><span class="name">${esc(d.compra)}</span><span class="amt n">${money(d.original)}</span></div><div class="sup"><span>${esc(d.tarjeta)} · ${fechaC(d.fecha)}</span></div></div>`).join('')}</details>` : ''}</div>`;
    if (auto) h += `<div class="group"><div class="row"><div class="row-t"><span class="name"><b style="font-weight:600">Crédito del auto</b></span><span class="amt n">${money(auto.pendiente)}</span></div>${bar(1 - auto.pendiente / auto.original, true)}
      <div class="sup n"><span>${auto.cuotasRegistradas} de ${auto.plazo} pagos · ${money(auto.cuota)}/mes por nómina</span><span>${auto.termina ? MES_C[+auto.termina.slice(5, 7) - 1] + ' ' + auto.termina.slice(0, 4) : ''}</span></div></div></div>`;
    return h + `</div></section>`;
  }

  // ---------- METAS ----------
  function vMetas() {
    let h = `<section class="blk inv">${REG('r')}<p class="kicker">${kicker('Metas')}</p>
      <div class="mrow" style="margin-top:14px"><span class="metric n">${money((R.cuentas.find(c => c.nombre === 'GBM') || {}).saldo)}</span><span class="mlabel">ahorrados en GBM</span></div>
      <p class="body-l" style="margin:16px 0 0;color:var(--gray-60)">Primero el fondo de emergencia; después todo va al enganche de la casa.</p></section><section class="blk">${REG('l')}<div class="stack">`;
    for (const t of R.metas) {
      h += `<div class="group meta-card"><div class="pad"><div class="label">${esc(t.tipo)}</div><div class="h-case" style="margin-top:8px">${esc(t.meta)}</div>`;
      if (t.objetivo) {
        h += `<div class="mrow" style="margin-top:14px"><span class="big-amt n">${money(t.actual)}</span><span class="mlabel" style="color:var(--badge-green)">${pct(t.avance)} logrado</span></div>${bar(t.avance)}
          <div class="sup n" style="display:flex;justify-content:space-between;margin-top:8px"><span>Falta ${money(t.falta)} de ${money(t.objetivo)}</span><span>${t.fecha ? 'Listo ~' + mesLargo(t.fecha.slice(0, 7)) : ''}</span></div>`;
      } else h += `<div class="row-t" style="margin-top:14px"><span class="big-amt n">${money(t.actual)}</span><span class="sup">Objetivo por definir</span></div>`;
      h += `${t.nota ? `<p class="sup" style="margin:12px 0 0">${esc(t.nota)}</p>` : ''}</div></div>`;
    }
    return h + `</div></section>`;
  }

  const VIEWS = { limites: vLimites, movs: vMovs, cuentas: vCuentas, metas: vMetas };

  // ---------- hojas ----------
  const sheetRoot = document.createElement('div');
  document.body.appendChild(sheetRoot);
  function openSheet(html, full) {
    sheetRoot.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-in ${full ? 'full' : ''}">${html}</div></div>`;
    document.body.style.overflow = 'hidden';
    return $('.sheet-in', sheetRoot);
  }
  function closeSheet() {
    const sh = $('.sheet', sheetRoot);
    sheetCtx = null; document.body.style.overflow = '';
    if (!sh) return;
    if (REDUCED) { sh.remove(); return; }
    sh.classList.add('out'); sh.style.pointerEvents = 'none';
    setTimeout(() => sh.remove(), 200);
  }
  let sheetCtx = null;
  sheetRoot.addEventListener('click', e => { if (e.target.classList.contains('sheet')) closeSheet(); });
  const sheetHead = t => `<div class="blk sheet-h"><p class="kicker">${kicker(t)}</p><button class="iconbtn" data-act="close" aria-label="Cerrar">${I('cerrar', 18)}</button></div>`;

  // ---------- captura: gasto, ingreso y demás ----------
  function favoritasGasto() {
    const conteo = {};
    for (const m of D.mov) if (m.tipo === 'Gasto' && m.categoria && m.fecha >= addMonths(hoy(), -4)) conteo[m.categoria] = (conteo[m.categoria] || 0) + 1;
    return gastables().filter(c => c.tipo !== 'Sin presupuesto' || c.nombre === 'PC y tecnología').map(c => c.nombre).sort((a, b) => (conteo[b] || 0) - (conteo[a] || 0)).slice(0, 8);
  }
  const gastables = () => D.categorias.filter(c => ['Mensual', 'Fondo acumulable', 'Tope anual', 'Sin presupuesto', 'Ahorro'].includes(c.tipo) && c.grupo !== 'Histórico');

  // Captura rápida: monto + qué fue. La categoría y la cuenta las propone el historial; si no reconoce nada,
  // el gasto se guarda "por clasificar" y se resuelve después desde Límites.
  function capture(prefill, editing) {
    const cuentas = D.cuentas;
    const credito = cuentas.filter(c => c.tipo === 'Crédito').map(c => c.nombre);
    const noCred = cuentas.filter(c => c.tipo !== 'Crédito').map(c => c.nombre);
    const cats = D.categorias, favoritas = favoritasGasto();
    const ultimaCta = 'RappiCard'; // la tarjeta de casi todo; fija para que una compra con BBVA no arrastre a las siguientes
    const principales = ['Gasto', 'Ingreso'];

    const f = Object.assign({ tipo: 'Gasto', monto: '', categoria: '', cuenta: '', destino: '', concepto: '', fecha: hoy(), nota: '' }, prefill || {});
    if (!f.cuenta) f.cuenta = f.tipo === 'Ingreso' ? 'BBVA débito' : (cuentas.some(c => c.nombre === ultimaCta) ? ultimaCta : cuentas[0].nombre);
    let manualCat = !!(prefill && prefill.categoria), manualCta = !!(prefill && prefill.cuenta);
    let mas = !principales.includes(f.tipo), elegir = !!editing, detalles = !!editing;

    const titulo = () => f.tipo === 'Pago de tarjeta' ? (editing ? 'Editar pago' : 'Pagar tarjeta') : (editing ? 'Editar ' : 'Nuevo ') + f.tipo.toLowerCase();
    const el = openSheet(`<div id="caph"></div><form class="blk form" id="cap" novalidate></form>`, true);
    sheetCtx = { type: 'capture' };

    function cuentasPara(tipo) {
      if (tipo === 'Pago de tarjeta') return { de: noCred, a: credito };
      if (tipo === 'Transferencia') return { de: noCred, a: noCred };
      if (tipo === 'Ingreso' || tipo === 'Ajuste de saldo') return { de: noCred };
      const orden = [ultimaCta, ...cuentas.filter(c => c.tipo !== 'Inversión').map(c => c.nombre)];
      return { de: [...new Set(orden)].filter(n => cuentas.some(c => c.nombre === n)) };
    }
    function catsPara(tipo) {
      if (tipo === 'Ingreso') return { chips: cats.filter(c => c.tipo === 'Ingreso').map(c => c.nombre), todas: [] };
      if (['Pago de tarjeta', 'Transferencia', 'Ajuste de saldo'].includes(tipo)) return null;
      return { chips: favoritas, todas: gastables().map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es')) };
    }
    const chips = (name, list, val) => `<div class="chips" data-chips="${name}">${list.map(n => `<button type="button" class="chip" data-v="${esc(n)}" aria-pressed="${n === val}">${esc(n)}</button>`).join('')}</div>`;
    const parseMonto = v => Math.round(parseFloat(String(v).replace(/[$,\s]/g, '')) * 100) / 100;

    // Propuesta del historial para el texto actual (solo gastos, solo mientras el usuario no elija a mano)
    function proponer() {
      if (f.tipo !== 'Gasto') return [];
      const sugs = f.concepto.trim() ? Classify.suggest(IDX, f.concepto, 3) : [];
      if (!manualCat) f.categoria = sugs[0] ? sugs[0].categoria : '';
      if (!manualCta && sugs[0] && sugs[0].cuenta) f.cuenta = sugs[0].cuenta;
      return sugs;
    }
    function paintSug() {
      const box = $('#sug', el); if (!box) return;
      const sugs = proponer();
      if (elegir) { box.innerHTML = ''; }
      else if (sugs.length) {
        box.innerHTML = `<div class="label" style="margin-bottom:8px">Categoría propuesta</div>${chips('categoria', [...new Set([...sugs.map(x => x.categoria), ...(f.categoria && !sugs.some(x => x.categoria === f.categoria) ? [f.categoria] : [])])], f.categoria)}<button type="button" class="link" data-act="elegir">Otra categoría</button>`;
      } else {
        box.innerHTML = f.concepto.trim()
          ? `<div class="hint">No reconozco <b>${esc(f.concepto.trim())}</b>. Se guarda <b>por clasificar</b> y lo resuelves después, o <button type="button" class="link" data-act="elegir">elige la categoría</button>.</div>`
          : `<div class="hint">Escribe qué fue y la app propone la categoría. Si lo dejas vacío, queda <b>por clasificar</b>. <button type="button" class="link" data-act="elegir">Elegir categoría</button></div>`;
      }
      const cl = $('#ctaline', el);
      if (cl) cl.innerHTML = `<div class="label" style="margin-bottom:8px">Con qué pagaste</div>${chips('cuenta', cuentasPara('Gasto').de, f.cuenta)}`;
      impact();
    }

    function paint() {
      $('#caph', el).innerHTML = sheetHead(titulo());
      const ctas = cuentasPara(f.tipo), cs = catsPara(f.tipo);
      if (!ctas.de.includes(f.cuenta)) f.cuenta = ctas.de[0];
      if (ctas.a && !ctas.a.includes(f.destino)) f.destino = ctas.a.find(n => n !== f.cuenta) || '';
      if (!ctas.a) f.destino = '';
      if (!cs) f.categoria = '';
      const rapido = f.tipo === 'Gasto';
      const verbo = { Gasto: 'Con qué pagaste', Ingreso: 'A dónde llegó', Reembolso: 'A dónde llegó', 'Pago de tarjeta': 'Desde', Transferencia: 'Desde' }[f.tipo] || 'Cuenta';
      $('#cap', el).innerHTML = `
        ${tabs('tipo', [['Gasto', 'Gasto'], ['Ingreso', 'Ingreso'], ['mas', 'Otro']], mas ? 'mas' : f.tipo, 'Tipo', 'data-tipo')}
        ${mas ? `<div class="field"><span class="label">Tipo de movimiento</span>${chips('tipo', TIPOS.filter(t => !principales.includes(t)), f.tipo)}</div>` : ''}
        <label class="field"><span class="label">Monto</span><span class="amount"><span>$</span><input id="monto" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(f.monto)}" aria-label="Monto"></span></label>
        ${rapido ? `<label class="field"><span class="label">Qué fue</span><input class="input" id="concepto" maxlength="80" placeholder="Oxxo, tacos, gasolina…" autocomplete="off" value="${esc(f.concepto)}"></label>
          <div id="sug"></div>
          ${elegir ? `<div class="field"><span class="label">Categoría</span>${chips('categoria', [...new Set([...(f.categoria ? [f.categoria] : []), ...cs.chips])], f.categoria)}
            <select class="select" id="catall" style="margin-top:8px" aria-label="Otra categoría"><option value="">Otra categoría…</option>${cs.todas.map(n => `<option ${n === f.categoria ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>` : ''}
          <div id="impact"></div>
          <div id="ctaline"></div>` : ''}
        ${!rapido && cs ? `<div class="field"><span class="label">Categoría</span>${chips('categoria', [...new Set([...(f.categoria && !cs.chips.includes(f.categoria) ? [f.categoria] : []), ...cs.chips])], f.categoria)}
          ${cs.todas.length ? `<select class="select" id="catall" style="margin-top:8px" aria-label="Otra categoría"><option value="">Otra categoría…</option>${cs.todas.map(n => `<option ${n === f.categoria ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
          <div id="impact" style="margin-top:10px"></div></div>` : ''}
        ${!rapido ? `<div class="field"><span class="label">${verbo}</span>${chips('cuenta', ctas.de, f.cuenta)}</div>` : ''}
        ${ctas.a ? `<div class="field"><span class="label">Hacia</span>${chips('destino', ctas.a.filter(n => n !== f.cuenta), f.destino)}</div>` : ''}
        ${rapido && !detalles ? `<button type="button" class="link" data-act="detalles">Fecha, nota…</button>` : `
        <div class="two">${rapido ? '' : `<label class="field"><span class="label">Qué fue</span><input class="input" id="concepto" maxlength="80" placeholder="Opcional" value="${esc(f.concepto)}"></label>`}
          <label class="field"><span class="label">Fecha</span><input class="input" id="fecha" type="date" value="${esc(f.fecha)}"></label></div>
        <label class="field"><span class="label">Nota</span><input class="input" id="nota" maxlength="140" placeholder="Opcional" value="${esc(f.nota)}"></label>`}
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary xl block" type="submit">Guardar ${f.tipo === 'Gasto' || f.tipo === 'Ingreso' ? f.tipo.toLowerCase() : ''}${Dot('flecha')}</button>
        ${editing ? `<button class="btn danger block" type="button" data-del="1">Borrar movimiento${Dot('cerrar')}</button>
          <p class="sup" style="margin:0">Origen: ${esc(editing.origen || 'app')}${editing.creado ? ' · capturado ' + esc(editing.creado.slice(0, 16).replace('T', ' ')) : ''}</p>` : ''}`;
      if (rapido) paintSug(); else impact();
    }
    function read() {
      const g = id => $('#' + id, el);
      if (g('monto')) f.monto = g('monto').value;
      if (g('concepto')) f.concepto = g('concepto').value;
      if (g('fecha')) f.fecha = g('fecha').value;
      if (g('nota')) f.nota = g('nota').value;
    }
    function impact() {
      const box = $('#impact', el); if (!box) return;
      const c = f.categoria && R && computeAll(D, (f.fecha || hoy()).slice(0, 7), hoy()).cats.find(x => x.nombre === f.categoria);
      if (!c || !c.presupuestada) { box.innerHTML = ''; return; }
      let monto = parseMonto(f.monto) || 0;
      if (f.tipo === 'Reembolso') monto = -monto;
      if (editing && editing.categoria === f.categoria && editing.fecha.slice(0, 7) === (f.fecha || '').slice(0, 7)) monto -= categoryEffect(editing);
      if (c.tipo === 'Fondo acumulable') {
        const despues = c.acumulado - monto;
        box.innerHTML = `<div class="impact ${despues < 0 ? 'bad' : ''} n">Fondo de ${esc(c.nombre)}: ${money(c.acumulado)}${monto ? ` → <b>${money(despues)}</b>` : ''}</div>`;
        return;
      }
      const despues = c.restante - monto, p = (c.gastado + monto) / c.limite;
      box.innerHTML = `<div class="impact ${despues < 0 ? 'bad' : p >= 0.8 ? 'warn' : ''} n">${esc(c.nombre)}: te quedan ${money(c.restante)}${monto ? ` → <b>${despues < 0 ? 'te pasas por ' + money(-despues) : 'quedarían ' + money(despues)}</b>` : ` de ${money(c.limite)}`}</div>`;
    }

    el.addEventListener('input', e => {
      read();
      $('#err', el).textContent = '';
      if (e.target.id === 'concepto') { manualCat = false; paintSug(); }
      else if (e.target.id === 'monto' || e.target.id === 'fecha') impact();
    });
    el.addEventListener('change', e => { if (e.target.id === 'catall' && e.target.value) { read(); f.categoria = e.target.value; manualCat = true; paint(); } });
    el.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'close') return closeSheet();
      if (t.dataset.act === 'elegir') { read(); elegir = true; manualCat = !!f.categoria; return paint(); }
      if (t.dataset.act === 'detalles') { read(); detalles = true; return paint(); }
      if (t.dataset.tipo) {
        read();
        if (t.dataset.tipo === 'mas') { mas = true; if (principales.includes(f.tipo)) f.tipo = 'Reembolso'; }
        else { mas = false; if (f.tipo !== t.dataset.tipo) { f.tipo = t.dataset.tipo; f.categoria = ''; manualCat = false; f.cuenta = f.tipo === 'Ingreso' ? 'BBVA débito' : ultimaCta; } }
        return paint();
      }
      const group = t.parentElement && t.parentElement.dataset.chips;
      if (group) {
        read(); f[group] = t.dataset.v;
        if (group === 'tipo') f.categoria = '';
        if (group === 'categoria') manualCat = true;
        if (group === 'cuenta') manualCta = true;
        if (f.tipo === 'Gasto' && (group === 'categoria' || group === 'cuenta') && !elegir) return paintSug();
        return paint();
      }
      if (t.dataset.del) {
        if (!confirm('¿Borrar este movimiento? Queda registrado en el historial del repo.')) return;
        Store.deleteMovement(editing); closeSheet(); toast('Borrado.'); return;
      }
    });
    el.addEventListener('submit', e => {
      e.preventDefault(); read(); proponer();
      const monto = parseMonto(f.monto), err = $('#err', el);
      if (!(monto > 0)) { err.textContent = 'Escribe el monto.'; $('#monto', el).focus(); return; }
      if (catsPara(f.tipo) && f.tipo !== 'Gasto' && !f.categoria) { err.textContent = 'Elige una categoría.'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) { err.textContent = 'Revisa la fecha.'; return; }
      if (cuentasPara(f.tipo).a && !f.destino) { err.textContent = 'Elige a qué cuenta va.'; return; }
      const row = Object.assign({}, editing || {}, {
        id: editing ? editing.id : Store.newId(), fecha: f.fecha, concepto: f.concepto.trim() || f.categoria || f.tipo, monto, tipo: f.tipo,
        cuenta: f.cuenta, destino: f.destino, categoria: f.categoria, nota: f.nota.trim(),
        origen: editing ? editing.origen : 'app', creado: editing ? editing.creado : new Date().toISOString()
      });
      if (editing) row.editado = new Date().toISOString();
      Store.saveMovement(row, editing);
      closeSheet();
      const mesRow = row.fecha.slice(0, 7);
      if (mesRow !== state.mes) { state.mes = mesRow; enter = true; }
      render();
      const c = R.cats.find(x => x.nombre === row.categoria);
      let msg = editing ? 'Cambios guardados.' : 'Guardado.';
      if (c && c.tipo === 'Mensual') msg += ` ${c.nombre}: ${c.restante < 0 ? 'te pasaste por ' + money(-c.restante) : 'te quedan ' + money(c.restante)} este mes.`;
      else if (c && c.tipo === 'Fondo acumulable') msg += ` Fondo de ${c.nombre}: ${money(c.acumulado)}.`;
      else if (!row.categoria && row.tipo === 'Gasto') msg += ` Queda por clasificar (${R.porClasificar.length}).`;
      else if (row.tipo === 'Pago de tarjeta') { const cc = R.cuentas.find(x => x.nombre === row.destino); if (cc) msg += ` ${cc.nombre}: ahora debes ${money(cc.saldo)}.`; }
      toast(msg);
    });
    paint();
    if (!editing) setTimeout(() => { const m = $('#monto', el); if (m) m.focus(); }, 60);
  }

  // Clasificar lo pendiente, uno por uno: propuestas del historial + favoritas; un toque guarda y pasa al siguiente.
  function classifySheet(startId) {
    const pend = R.porClasificar;
    if (!pend.length) { closeSheet(); toast('Nada por clasificar.'); return; }
    let i = Math.max(0, pend.findIndex(m => m.id === startId));
    const m = pend[i];
    const sugs = Classify.suggest(IDX, m.concepto, 3).map(x => x.categoria);
    const lista = [...new Set([...sugs, ...favoritasGasto()])].slice(0, 10);
    const todas = gastables().map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es'));
    const el = openSheet(`${sheetHead('Por clasificar')}<div class="blk stack" style="padding-bottom:calc(24px + var(--safe-b))">
      <div><div class="label">${i + 1} de ${pend.length} · ${fechaC(m.fecha)} · ${esc(m.cuenta)}</div><h2 class="h-2" style="margin-top:10px">${esc(m.concepto)}</h2>
        <div class="mrow" style="margin-top:12px"><span class="metric sm n">${money(m.monto, true)}</span>${sugs.length ? `<span class="mlabel" style="color:var(--badge-green)">parece ${esc(sugs[0])}</span>` : ''}</div></div>
      <div><div class="label" style="margin-bottom:8px">${sugs.length ? 'Propuestas y frecuentes' : 'Frecuentes'}</div><div class="chips" data-chips="cat">${lista.map(n => `<button type="button" class="chip" data-v="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <select class="select" id="catall" style="margin-top:8px" aria-label="Otra categoría"><option value="">Otra categoría…</option>${todas.map(n => `<option>${esc(n)}</option>`).join('')}</select></div>
      <div class="two"><button class="btn secondary" data-act="editar">Editar${Dot('flecha')}</button><button class="btn secondary" data-act="saltar" ${pend.length < 2 ? 'disabled' : ''}>Saltar${Dot('flecha')}</button></div>
    </div>`, true);
    sheetCtx = { type: 'clasificar' };
    const guardar = cat => {
      Store.saveMovement({ ...m, categoria: cat, editado: new Date().toISOString() }, m);
      recompute();
      const c = R.cats.find(x => x.nombre === cat);
      toast(`${esc(m.concepto)} → ${cat}` + (c && c.tipo === 'Mensual' ? ` · quedan ${money(c.restante)}` : ''));
      if (R.porClasificar.length) classifySheet(); else { closeSheet(); render(); }
    };
    el.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'close') closeSheet();
      else if (t.dataset.act === 'saltar') classifySheet(pend[(i + 1) % pend.length].id);
      else if (t.dataset.act === 'editar') { closeSheet(); capture({ ...m, monto: String(m.monto) }, m); }
      else if (t.parentElement && t.parentElement.dataset.chips === 'cat') guardar(t.dataset.v);
    });
    $('#catall', el).addEventListener('change', e => { if (e.target.value) guardar(e.target.value); });
  }

  // ---------- detalle de categoría ----------
  function categorySheet(nombre) {
    const c = R.cats.find(x => x.nombre === nombre); if (!c) return;
    const movs = R.movMes.filter(m => m.categoria === nombre);
    const el = openSheet(`${sheetHead('Categoria')}<div class="blk stack" style="padding-bottom:calc(24px + var(--safe-b))">
      <div><div class="label">${esc(c.grupo)} · ${esc(c.tipo)}</div><h2 class="h-2" style="margin-top:10px">${esc(c.nombre)}</h2>${c.nota ? `<p class="sup" style="margin:8px 0 0">${esc(c.nota)}</p>` : ''}</div>
      ${c.presupuestada ? `<div class="group pad"><div class="mrow"><span class="big-amt n ${(c.tipo === 'Fondo acumulable' ? c.acumulado : c.restante) < 0 ? 'neg' : ''}">${money(c.tipo === 'Fondo acumulable' ? c.acumulado : c.restante)}</span><span class="mlabel" style="color:var(--badge-green)">${c.tipo === 'Fondo acumulable' ? 'en el fondo' : 'te quedan · ' + pct(c.pct) + ' usado'}</span></div>${bar(c.pct)}
        <div class="sup n" style="display:flex;justify-content:space-between;margin-top:10px"><span>Gastado ${money(c.gastado)} de ${money(c.limite)}</span><span>Prom. feb–jul ${money(c.promedio)}</span></div></div>
      <form class="group pad" id="limf" style="display:grid;gap:10px"><label class="field"><span class="label">${c.tipo === 'Fondo acumulable' ? 'Apartar al mes' : 'Límite mensual'}</span>
        <input class="input n" id="lim" inputmode="decimal" value="${c.limite}"></label><button class="btn secondary" type="submit">Guardar límite${Dot('check')}</button><div class="err" id="limerr"></div></form>` : `<div class="group pad"><span class="big-amt n">${money(c.gastado)}</span><div class="sup">Gastado en ${mesLargo(state.mes)} · sin límite</div></div>`}
      <button class="btn primary block" data-act="nuevo-cat">Registrar aquí${Dot('mas')}</button>
      <div class="group"><div class="group-h"><span class="proof" style="font-size:14px">${movs.length} movimientos en ${mesLargo(state.mes)}</span></div>${movs.map(rowMov).join('') || '<div class="empty">Nada registrado este mes.</div>'}</div>
    </div>`, true);
    sheetCtx = { type: 'cat', nombre };
    el.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'close') closeSheet();
      if (t.dataset.act === 'nuevo-cat') { closeSheet(); capture({ tipo: c.tipo === 'Ingreso' ? 'Ingreso' : 'Gasto', categoria: nombre }); }
      if (t.dataset.act === 'edit') { const m = D.mov.find(x => x.id === t.dataset.id); closeSheet(); if (m) capture({ ...m, monto: String(m.monto) }, m); }
    });
    const lf = $('#limf', el);
    if (lf) lf.addEventListener('submit', e => {
      e.preventDefault();
      const v = Math.round(parseFloat($('#lim', el).value.replace(/[$,\s]/g, '')) * 100) / 100;
      if (!(v >= 0)) { $('#limerr', el).textContent = 'Escribe un número.'; return; }
      Store.setLimit(nombre, v); closeSheet(); toast(`Límite de ${nombre}: ${money(v)}.`);
    });
  }

  // ---------- ajustes y conexión ----------
  const DEFAULTS = { owner: 'pa70xd', repo: 'duckfinance-datos' };
  function connectForm(s, inSheet) {
    return `<form id="conn" class="stack" autocomplete="off">
      <div class="two"><label class="field"><span class="label">Usuario de GitHub</span><input class="input" id="owner" value="${esc(s.owner)}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span class="label">Repo de datos</span><input class="input" id="repo" value="${esc(s.repo)}" autocapitalize="off" spellcheck="false"></label></div>
      <label class="field"><span class="label">Token</span><input class="input" id="token" type="password" placeholder="github_pat_…" autocapitalize="off" spellcheck="false" ${inSheet ? '' : 'required'}></label>
      <div class="err" id="connerr" role="alert"></div>
      <button class="btn primary ${inSheet ? '' : 'xl'} block" type="submit">${inSheet ? 'Cambiar conexión' : 'Conectar'}${Dot('flecha')}</button></form>`;
  }
  const tokenSteps = `<div class="steps">
      <div class="step"><b>1</b><p>Abre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained token</a>.</p></div>
      <div class="step"><b>2</b><p><b>Repository access:</b> Only select repositories → <b>duckfinance-datos</b>. <b>Permissions:</b> Contents → Read and write. Nada más.</p></div>
      <div class="step"><b>3</b><p>Copia el token y pégalo aquí. Se guarda solo en este teléfono.</p></div></div>`;
  function bindConnect(root) {
    $('#conn', root).addEventListener('submit', async e => {
      e.preventDefault();
      const prev = Store.settings() || {};
      const s = { owner: $('#owner', root).value.trim(), repo: $('#repo', root).value.trim(), token: $('#token', root).value.trim() || prev.token };
      const err = $('#connerr', root), btn = e.submitter || $('button[type=submit]', root);
      if (!s.owner || !s.repo || !s.token) { err.textContent = 'Llena usuario, repo y token.'; return; }
      btn.classList.add('busy'); btn.innerHTML = 'Conectando…' + I('sync', 14); err.textContent = '';
      try { await Store.connect(s); closeSheet(); render(); toast('Conectado. Tu base ya está en este teléfono.'); }
      catch (x) { err.textContent = x.message; btn.classList.remove('busy'); btn.innerHTML = 'Reintentar' + Dot('flecha'); }
    });
  }
  function renderSetup() {
    app.innerHTML = `<header class="blk top"><div class="top-row">${BRAND}</div></header><div class="blk hero" style="min-height:100vh;padding-bottom:40px">${REG('r')}
      <p class="kicker">${kicker('Empezar')}</p><h1 class="h-hero">Conecta tu base de datos.</h1>
      <p class="body-l" style="margin:16px 0 0">Tus movimientos viven en tu repo privado de GitHub. Esta página es pública; tus datos no.</p>
      ${tokenSteps}${connectForm(Store.settings() || DEFAULTS, false)}</div>`;
    bindConnect(app);
  }
  function settingsSheet() {
    const s = Store.settings() || DEFAULTS, st = Store.status;
    const el = openSheet(`${sheetHead('Ajustes')}<div class="blk stack" style="padding-bottom:calc(24px + var(--safe-b))">
      <div class="group pad"><div class="label">Base de datos</div><div class="proof" style="margin-top:8px;text-transform:none">${esc(s.owner)}/${esc(s.repo)}</div>
        <div class="sup" style="margin-top:8px">${st.lastSync ? 'Última sincronización ' + esc(new Date(st.lastSync).toLocaleString('es-MX')) : 'Sin sincronizar'} · ${Store.pending()} cambios pendientes</div>
        ${st.error ? `<div class="note bad">${esc(st.error)}</div>` : ''}
        <div class="two" style="margin-top:14px"><button class="btn secondary" data-act="sync-now">Sincronizar${I('sync', 12)}</button><a class="btn secondary" target="_blank" rel="noopener" href="https://github.com/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/commits">Historial</a></div></div>
      <div class="group pad"><div class="label">Respaldo</div><p class="sup" style="margin:8px 0 12px">Descarga todos tus movimientos en CSV (abre en Excel).</p><button class="btn secondary" data-act="csv">Exportar CSV${I('descargar', 12)}</button></div>
      <div class="group pad"><div class="label" style="margin-bottom:12px">Conexión</div>${tokenSteps}${connectForm(s, true)}
        <p class="sup">Deja el token vacío para conservar el actual.</p>
        <button class="btn danger" data-act="logout" style="margin-top:6px">Desconectar este teléfono${Dot('cerrar')}</button></div>
    </div>`, true);
    sheetCtx = { type: 'settings' };
    bindConnect(el);
    el.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'close') closeSheet();
      if (t.dataset.act === 'sync-now') { Store.sync().then(() => toast(Store.status.error || 'Sincronizado.')); }
      if (t.dataset.act === 'csv') {
        const blob = new Blob([Store.exportCsv()], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cuentas-claras-${hoy()}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
      if (t.dataset.act === 'logout') {
        if (Store.pending() && !confirm(`Hay ${Store.pending()} cambios sin subir. Si desconectas se quedan aquí hasta que vuelvas a conectar. ¿Seguir?`)) return;
        Store.disconnect(); closeSheet(); render();
      }
    });
  }

  function toast(msg) {
    const old = $('.toast'); if (old) old.remove();
    const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status');
    t.innerHTML = Dot('check') + '<span></span>'; t.lastChild.textContent = msg;
    document.body.appendChild(t);
    clearTimeout(toast.h);
    toast.h = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4200);
  }

  // ---------- eventos globales ----------
  app.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'vista') { if (t.dataset.v === state.vista) return; go(() => { state.vista = t.dataset.v; try { localStorage.setItem('df.vista', JSON.stringify(state.vista)); } catch (x) {} window.scrollTo(0, 0); }); }
    else if (a === 'mes') { const ms = mesesDisponibles(); const i = ms.indexOf(state.mes) + (+t.dataset.d); if (ms[i]) go(() => { state.mes = ms[i]; }); }
    else if (a === 'flim') go(() => { state.filtroLim = t.dataset.v; });
    else if (a === 'fmov') go(() => { state.filtroMov = t.dataset.v; });
    else if (a === 'nuevo') capture({ tipo: t.dataset.tipo, fecha: state.mes === hoy().slice(0, 7) ? hoy() : state.mes + '-01' });
    else if (a === 'cat') categorySheet(t.dataset.n);
    else if (a === 'clasificar') classifySheet(t.dataset.id);
    else if (a === 'pagar') capture({ tipo: 'Pago de tarjeta', cuenta: 'BBVA débito', destino: t.dataset.card, concepto: 'Pago ' + t.dataset.card });
    else if (a === 'edit') { const m = D.mov.find(x => x.id === t.dataset.id); if (m) capture({ ...m, monto: String(m.monto) }, m); }
    else if (a === 'settings') settingsSheet();
    else if (a === 'sync') Store.sync();
  });
  app.addEventListener('input', e => { if (e.target.id === 'q') { state.q = e.target.value; render(); } });

  Store.subscribe(() => { if (Store.configured()) render(); });
  window.addEventListener('online', () => Store.sync());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') Store.sync(); });

  let atajo = new URLSearchParams(location.search).get('nuevo');
  if (atajo) {
    history.replaceState(null, '', location.pathname);
    const abrir = () => { if (D && atajo) { const t = atajo; atajo = null; capture({ tipo: t === 'Ingreso' ? 'Ingreso' : 'Gasto' }); } };
    Store.subscribe(abrir);
    setTimeout(abrir, 0);
  }
  render();
  Store.sync();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
