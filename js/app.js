(function () {
  'use strict';
  const { computeAll, categoryEffect, isoDate, addMonths, TIPOS } = Logic;

  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const f2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (x, dec) => (dec ? f2 : f0).format(x || 0).replace('-', '−');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const mesLargo = k => { const [y, m] = k.split('-'); return MESES[+m - 1] + ' ' + y; };
  const fechaC = iso => { const [y, m, d] = iso.split('-'); return +d + ' ' + MES_C[+m - 1] + ' ' + y; };
  const pct = x => Math.round((x || 0) * 100) + '%';
  // Minecraft no dibuja mayúsculas acentuadas: el kicker las pierde al mostrarse (Editorial Syntax v1)
  const kicker = txt => '/' + txt.toUpperCase().replace(/[ÁÉÍÓÚ]/g, c => 'AEIOU'['ÁÉÍÓÚ'.indexOf(c)]) + '_';
  const hoy = () => isoDate(new Date());
  const ICON = {
    left: '<svg viewBox="0 0 16 16"><path d="M10 3 5 8l5 5"/></svg>',
    right: '<svg viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg>',
    gear: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/></svg>',
    close: '<svg viewBox="0 0 16 16"><path d="m3 3 10 10M13 3 3 13"/></svg>',
    limites: '<svg viewBox="0 0 18 18"><path d="M2 4h14M2 9h9M2 14h5"/><path d="M13 12v4M15 14h-4" /></svg>',
    movs: '<svg viewBox="0 0 18 18"><path d="M5 2v14M5 16l-3-3M5 16l3-3M13 16V2M13 2l-3 3M13 2l3 3"/></svg>',
    cuentas: '<svg viewBox="0 0 18 18"><rect x="2" y="4" width="14" height="10"/><path d="M2 7.5h14"/></svg>',
    metas: '<svg viewBox="0 0 18 18"><rect x="2" y="2" width="14" height="14"/><rect x="6" y="6" width="6" height="6"/></svg>'
  };

  // ---------- estado ----------
  const store = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const state = { vista: store('cc.vista', 'limites'), mes: hoy().slice(0, 7), filtroLim: 'todos', filtroMov: 'todos', q: '' };
  let D = null, R = null;
  const app = document.getElementById('app');

  function recompute() {
    D = Store.data();
    if (!D) { R = null; return; }
    R = computeAll(D, state.mes, hoy());
  }
  function mesesDisponibles() {
    const s = new Set(D ? D.mov.map(m => m.fecha.slice(0, 7)) : []);
    s.add(hoy().slice(0, 7));
    return [...s].sort();
  }

  // ---------- render principal ----------
  function render() {
    if (!Store.configured()) return renderSetup();
    recompute();
    if (!D) {
      app.innerHTML = `<div class="blk inv" style="min-height:100vh;padding-top:calc(40px + var(--safe-t))"><p class="kicker">${kicker('Cuentas claras')}</p>
        <h1 class="h-hero" style="margin-top:18px">Cargando tu base</h1><p class="sup" style="margin-top:12px">${esc(Store.status.error || 'Descargando tus datos de GitHub…')}</p>
        ${Store.status.error ? '<button class="btn sm" data-act="settings" style="margin-top:18px">Ajustes</button>' : ''}</div>`;
      return;
    }
    const scroll = window.scrollY;
    const prevMain = app.dataset.vista;
    const act = document.activeElement, focusQ = act && act.id === 'q', caret = focusQ ? act.selectionStart : 0;
    app.innerHTML = `${header()}<main>${VIEWS[state.vista]()}</main>${nav()}
      <div class="keys"><button class="key green" data-act="nuevo" data-tipo="Gasto" aria-label="Registrar gasto"><b>-</b><span>Gasto</span></button>
      <button class="key black" data-act="nuevo" data-tipo="Ingreso" aria-label="Registrar ingreso"><b>+</b><span>Ingreso</span></button></div>`;
    app.dataset.vista = state.vista;
    if (prevMain === state.vista) window.scrollTo(0, scroll);
    const q = $('#q'); if (q && focusQ) { q.focus(); q.setSelectionRange(caret, caret); }
  }

  function header() {
    const meses = mesesDisponibles(), i = meses.indexOf(state.mes);
    const st = Store.status, pend = Store.pending();
    let cls = '', txt = 'Al día';
    if (st.syncing) { cls = 'busy'; txt = pend ? `Subiendo ${pend}` : 'Sincronizando'; }
    else if (st.error) { cls = pend ? 'warn' : 'err'; txt = pend ? `${pend} sin subir` : 'Sin conexión'; }
    else if (pend) { cls = 'warn'; txt = `${pend} pendientes`; }
    const titulo = { limites: 'Cuentas claras', movs: 'Movimientos', cuentas: 'Cuentas', metas: 'Metas' }[state.vista];
    return `<header class="blk inv top">
      <div class="top-row"><p class="kicker">${kicker(titulo)}</p>
        <div style="display:flex;gap:10px;align-items:center"><button class="sync label ${cls}" data-act="sync" title="${esc(st.error || '')}"><i></i>${txt}</button>
        <button class="iconbtn" data-act="settings" aria-label="Ajustes">${ICON.gear}</button></div></div>
      ${state.vista === 'limites' || state.vista === 'movs' ? `<div class="month">
        <button class="iconbtn" data-act="mes" data-d="-1" ${i <= 0 ? 'disabled' : ''} aria-label="Mes anterior">${ICON.left}</button>
        <div class="h-case" aria-live="polite">${mesLargo(state.mes)}</div>
        <button class="iconbtn" data-act="mes" data-d="1" ${i >= meses.length - 1 ? 'disabled' : ''} aria-label="Mes siguiente">${ICON.right}</button></div>` : ''}
    </header>`;
  }

  function nav() {
    const b = (v, t) => `<button data-act="vista" data-v="${v}" ${state.vista === v ? 'aria-current="page"' : ''}>${ICON[v]}<span class="nav-t">${t}</span></button>`;
    return `<nav class="nav" aria-label="Secciones"><div class="in">${b('limites', 'Límites')}${b('movs', 'Movimientos')}${b('cuentas', 'Cuentas')}${b('metas', 'Metas')}</div></nav>`;
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
    let h = `<section class="blk inv hero">
      <div class="label">Te queda del presupuesto</div>
      <div class="hero-row"><div class="h-hero n ${s.queda < 0 ? 'neg' : ''}">${money(s.queda)}</div><div class="metric ${uso > 1 ? 'neg' : 'green-ink'}">${pct(uso)}</div></div>
      <div class="sup n">Llevas ${money(s.gastadoPresup)} de ${money(s.presupuesto)}${actual ? ' · faltan ' + diasRestantes() + ' días' : ''}</div>
      ${bar(uso)}
      <div class="badges">${s.rojo ? `<span class="badge mal">${s.rojo} pasad${s.rojo === 1 ? 'a' : 'as'}</span>` : ''}${s.amarillo ? `<span class="badge cerca">${s.amarillo} cerca</span>` : ''}${!s.rojo && !s.amarillo ? '<span class="badge bien">Todo en orden</span>' : ''}</div>
      ${s.comprasMsiMes.length ? `<div class="note bad"><b>Compra nueva a meses: ${money(s.comprasMsiMes.reduce((a, m) => a + m.monto, 0))}.</b> La regla es cero, salvo el seguro del auto en abril.</div>` : ''}
      ${antes ? `<div class="note">El plan arranca el ${fechaC(D.config.inicio)}. Este mes es solo referencia.</div>` : ''}
    </section>
    <section class="blk"><div class="stack">
      <p class="kicker">${kicker('Límites por categoría')}</p>
      <div class="tabs" role="group" aria-label="Filtro"><button data-act="flim" data-v="todos" aria-pressed="${state.filtroLim === 'todos'}">Todos</button><button data-act="flim" data-v="riesgo" aria-pressed="${state.filtroLim === 'riesgo'}">En riesgo</button></div>`;
    const grupos = [...new Set(R.cats.filter(c => c.presupuestada).map(c => c.grupo))];
    let alguno = false;
    for (const g of grupos) {
      let cs = R.cats.filter(c => c.grupo === g && c.presupuestada);
      if (state.filtroLim === 'riesgo') cs = cs.filter(c => c.estado === 'mal' || c.estado === 'cerca');
      if (!cs.length) continue;
      alguno = true;
      const tl = cs.reduce((a, c) => a + c.limite, 0), tg = cs.reduce((a, c) => a + c.gastado, 0);
      h += `<div class="group"><div class="group-h"><span class="label" style="color:var(--ink)">${esc(g)}</span><span class="label n">${money(tg)} / ${money(tl)}</span></div>`;
      h += cs.map(rowCat).join('') + `</div>`;
    }
    if (!alguno) h += `<div class="group"><div class="empty">Ninguna categoría está cerca de su límite.</div></div>`;
    const otras = R.cats.filter(c => !c.presupuestada && c.gastado !== 0 && c.tipo !== 'Ingreso');
    if (otras.length && state.filtroLim === 'todos') {
      h += `<div class="group"><div class="group-h"><span class="label" style="color:var(--ink)">Fuera del presupuesto</span><span class="label n">${money(otras.reduce((a, c) => a + c.gastado, 0))}</span></div>
        ${otras.map(c => `<button class="row" data-act="cat" data-n="${esc(c.nombre)}"><div class="row-t"><span class="name">${esc(c.nombre)}</span><span class="amt n">${money(c.gastado)}</span></div><div class="sup"><span>${esc(c.tipo)}</span><span>${c.movs} mov.</span></div></button>`).join('')}</div>`;
    }
    return h + `</div></section>`;
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
    let h = `<section class="blk inv" style="padding-top:4px"><div class="stats">
      <div><div class="label">Ingresos</div><div class="v n pos">${money(s.ingresos)}</div></div>
      <div><div class="label">Gastos</div><div class="v n">${money(s.gastoPropio)}</div></div>
      <div class="wide"><span class="label">Balance del mes</span><span class="metric ${balance < 0 ? 'neg' : 'green-ink'}" style="font-size:24px;line-height:28px">${money(balance).replace('−', '-')}</span></div>
    </div></section>
    <section class="blk"><div class="stack">
      <input id="q" class="search" type="search" placeholder="Buscar concepto, nota o monto" value="${esc(state.q)}" aria-label="Buscar" autocomplete="off">
      <div class="tabs" role="group" aria-label="Tipo">${[['todos', 'Todos'], ['gastos', 'Gastos'], ['ingresos', 'Ingresos'], ['otros', 'Otros']].map(([v, t]) => `<button data-act="fmov" data-v="${v}" aria-pressed="${f === v}">${t}</button>`).join('')}</div>`;
    if (!rows.length) return h + `<div class="group"><div class="empty">Sin movimientos con ese filtro en ${mesLargo(state.mes)}.</div></div></div></section>`;
    h += `<div class="group">`;
    let dia = null;
    for (const m of rows) {
      if (m.fecha !== dia) {
        dia = m.fecha;
        const d = new Date(dia + 'T00:00:00');
        const tot = rows.filter(x => x.fecha === dia).reduce((a, x) => a + categoryEffect(x), 0);
        h += `<div class="day-h" style="display:flex;justify-content:space-between"><span class="label" style="color:var(--ink)">${DIAS[d.getDay()]} ${fechaC(dia)}</span>${tot ? `<span class="label n">${money(tot, true)}</span>` : ''}</div>`;
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
      <div class="sup"><span>${esc(detalle)}</span><span>${m.tipo !== 'Gasto' ? `<span class="tag">${esc(m.tipo)}</span>` : ''}${m._pendiente ? '<span class="tag pend">Pendiente</span>' : ''}</span></div></button>`;
  }

  // ---------- CUENTAS ----------
  function vCuentas() {
    const s = R.resumen;
    let h = `<section class="blk inv" style="padding-top:4px"><div class="label">Patrimonio neto</div>
      <div class="h-hero n ${s.neto < 0 ? 'neg' : ''}" style="margin-top:10px">${money(s.neto)}</div>
      <div class="split"><div><div class="label">Tienes</div><div class="v n">${money(s.tienes)}</div></div>
      <div><div class="label">Tarjetas</div><div class="v n">${money(s.deudaTarjetas)}</div></div>
      <div><div class="label">Total deuda</div><div class="v n">${money(s.debes)}</div></div></div>
      <div class="sup" style="margin-top:10px">La deuda incluye el crédito del auto; el valor del coche no se cuenta.</div></section>
    <section class="blk"><div class="stack"><p class="kicker">${kicker('Saldos')}</p><div class="group">`;
    const ultima = {};
    for (const m of D.mov) for (const c of [m.cuenta, m.destino]) if (c && m.tipo !== 'Ajuste de saldo' && (!ultima[c] || m.fecha > ultima[c])) ultima[c] = m.fecha;
    for (const c of R.cuentas) {
      const cred = c.tipo === 'Crédito';
      h += `<div class="row"><div class="row-t"><span class="name"><b style="font-weight:600">${esc(c.nombre)}</b></span><span class="amt n">${money(c.saldo, true)}</span></div>
        ${cred && c.limite ? bar(c.saldo / c.limite, true) : ''}
        <div class="sup n"><span>${cred ? 'Debes' : esc(c.tipo)}${ultima[c.nombre] ? ' · último mov. ' + fechaC(ultima[c.nombre]) : ''}</span><span>${cred && c.limite ? 'Disponible ' + money(c.disponible) : ''}</span></div>
        ${cred && c.corte ? `<div class="sup"><span>Corte día ${c.corte} · pago ~día ${c.pago}</span></div>` : ''}</div>`;
    }
    h += `</div>`;
    const act = R.deudas.filter(d => d.activa && !d.auto).sort((a, b) => b.pendiente - a.pendiente);
    const liq = R.deudas.filter(d => !d.activa && !d.auto);
    const auto = R.deudas.find(d => d.auto);
    h += `<p class="kicker" style="margin-top:8px">${kicker('Compras a meses')}</p>
      <div class="group"><div class="group-h"><span class="label" style="color:var(--ink)">Te falta ${money(s.pendienteMsi)}</span><span class="label n">${money(s.cuotaActiva)}/mes · ${act.length} activas</span></div>
      ${act.map(d => `<div class="row"><div class="row-t"><span class="name">${esc(d.compra)}</span><span class="amt n">${money(d.pendiente)}</span></div>${bar(1 - d.pendiente / d.original, true)}
        <div class="sup n"><span>${esc(d.tarjeta)} · ${money(d.cuota)}/mes · faltan ${d.restantes}</span><span>${d.termina ? MES_C[+d.termina.slice(5, 7) - 1] + ' ' + d.termina.slice(0, 4) : ''}</span></div></div>`).join('')}
      ${liq.length ? `<details><summary>${liq.length} liquidadas</summary>${liq.map(d => `<div class="row"><div class="row-t"><span class="name">${esc(d.compra)}</span><span class="amt n">${money(d.original)}</span></div><div class="sup"><span>${esc(d.tarjeta)} · ${fechaC(d.fecha)}</span></div></div>`).join('')}</details>` : ''}</div>`;
    if (auto) h += `<div class="group"><div class="row"><div class="row-t"><span class="name"><b style="font-weight:600">Crédito del auto</b></span><span class="amt n">${money(auto.pendiente)}</span></div>${bar(1 - auto.pendiente / auto.original, true)}
      <div class="sup n"><span>${auto.cuotasRegistradas} de ${auto.plazo} pagos · ${money(auto.cuota)}/mes por nómina</span><span>${auto.termina ? MES_C[+auto.termina.slice(5, 7) - 1] + ' ' + auto.termina.slice(0, 4) : ''}</span></div></div></div>`;
    return h + `</div></section>`;
  }

  // ---------- METAS ----------
  function vMetas() {
    let h = `<section class="blk inv" style="padding-top:4px"><div class="label">Ahorro en GBM</div><div class="h-hero n" style="margin-top:10px">${money((R.cuentas.find(c => c.nombre === 'GBM') || {}).saldo)}</div>
      <div class="sup" style="margin-top:8px">Primero el fondo de emergencia; después todo va al enganche de la casa.</div></section><section class="blk"><div class="stack">`;
    for (const t of R.metas) {
      h += `<div class="group meta-card"><div class="pad"><div class="label">${esc(t.tipo)}</div><div class="h-case" style="margin-top:8px">${esc(t.meta)}</div>`;
      if (t.objetivo) {
        h += `<div class="row-t" style="margin-top:14px;align-items:flex-end"><span class="big-amt n">${money(t.actual)}</span><span class="metric">${pct(t.avance)}</span></div>${bar(t.avance)}
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
  function closeSheet() { sheetRoot.innerHTML = ''; document.body.style.overflow = ''; sheetCtx = null; }
  let sheetCtx = null;
  sheetRoot.addEventListener('click', e => { if (e.target.classList.contains('sheet')) closeSheet(); });
  const sheetHead = t => `<div class="blk inv sheet-h"><p class="kicker">${kicker(t)}</p><button class="iconbtn" data-act="close" aria-label="Cerrar">${ICON.close}</button></div>`;

  // ---------- captura: gasto, ingreso y demás ----------
  function capture(prefill, editing) {
    const cuentas = D.cuentas;
    const credito = cuentas.filter(c => c.tipo === 'Crédito').map(c => c.nombre);
    const noCred = cuentas.filter(c => c.tipo !== 'Crédito').map(c => c.nombre);
    const cats = D.categorias;
    const conteo = {};
    for (const m of D.mov) if (m.tipo === 'Gasto' && m.fecha >= addMonths(hoy(), -4)) conteo[m.categoria] = (conteo[m.categoria] || 0) + 1;
    const gastables = cats.filter(c => ['Mensual', 'Fondo acumulable', 'Tope anual', 'Sin presupuesto', 'Ahorro'].includes(c.tipo) && c.grupo !== 'Histórico');
    const favoritas = gastables.filter(c => c.tipo !== 'Sin presupuesto' || c.nombre === 'PC y tecnología').map(c => c.nombre).sort((a, b) => (conteo[b] || 0) - (conteo[a] || 0)).slice(0, 8);
    const ultimaCta = store('cc.cta', 'RappiCard');

    const f = Object.assign({ tipo: 'Gasto', monto: '', categoria: '', cuenta: '', destino: '', concepto: '', fecha: hoy(), nota: '' }, prefill || {});
    if (!f.cuenta) f.cuenta = f.tipo === 'Ingreso' ? 'BBVA débito' : (cuentas.some(c => c.nombre === ultimaCta) ? ultimaCta : cuentas[0].nombre);
    const principales = ['Gasto', 'Ingreso'];
    let mas = !principales.includes(f.tipo);

    const titulo = () => (editing ? 'Editar ' : 'Nuevo ') + f.tipo.toLowerCase();
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
      return { chips: favoritas, todas: gastables.map(c => c.nombre).sort((a, b) => a.localeCompare(b, 'es')) };
    }
    const chips = (name, list, val) => `<div class="chips" data-chips="${name}">${list.map(n => `<button type="button" class="chip" data-v="${esc(n)}" aria-pressed="${n === val}">${esc(n)}</button>`).join('')}</div>`;

    function paint() {
      $('#caph', el).innerHTML = sheetHead(titulo());
      const ctas = cuentasPara(f.tipo), cs = catsPara(f.tipo);
      if (!ctas.de.includes(f.cuenta)) f.cuenta = ctas.de[0];
      if (ctas.a && !ctas.a.includes(f.destino)) f.destino = ctas.a.find(n => n !== f.cuenta) || '';
      if (!ctas.a) f.destino = '';
      if (!cs) f.categoria = '';
      const verbo = { Gasto: 'Con qué pagaste', Ingreso: 'A dónde llegó', Reembolso: 'A dónde llegó', 'Pago de tarjeta': 'Desde', Transferencia: 'Desde' }[f.tipo] || 'Cuenta';
      $('#cap', el).innerHTML = `
        <div class="tabs" role="group" aria-label="Tipo">
          <button type="button" data-tipo="Gasto" aria-pressed="${f.tipo === 'Gasto'}">Gasto</button>
          <button type="button" data-tipo="Ingreso" aria-pressed="${f.tipo === 'Ingreso'}">Ingreso</button>
          <button type="button" data-tipo="mas" aria-pressed="${mas}">Otro</button></div>
        ${mas ? `<div class="field"><span class="label">Tipo de movimiento</span>${chips('tipo', TIPOS.filter(t => !principales.includes(t)), f.tipo)}</div>` : ''}
        <label class="field"><span class="label">Monto</span><span class="amount"><span>$</span><input id="monto" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(f.monto)}" aria-label="Monto"></span></label>
        ${cs ? `<div class="field"><span class="label">Categoría</span>${chips('categoria', [...new Set([...(f.categoria && !cs.chips.includes(f.categoria) ? [f.categoria] : []), ...cs.chips])], f.categoria)}
          ${cs.todas.length ? `<select class="select" id="catall" style="margin-top:8px" aria-label="Otra categoría"><option value="">Otra categoría…</option>${cs.todas.map(n => `<option ${n === f.categoria ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>` : ''}
          <div id="impact" style="margin-top:10px"></div></div>` : ''}
        <div class="field"><span class="label">${verbo}</span>${chips('cuenta', ctas.de, f.cuenta)}</div>
        ${ctas.a ? `<div class="field"><span class="label">Hacia</span>${chips('destino', ctas.a.filter(n => n !== f.cuenta), f.destino)}</div>` : ''}
        <div class="two"><label class="field"><span class="label">Qué fue</span><input class="input" id="concepto" maxlength="80" placeholder="Opcional" value="${esc(f.concepto)}"></label>
          <label class="field"><span class="label">Fecha</span><input class="input" id="fecha" type="date" value="${esc(f.fecha)}"></label></div>
        <label class="field"><span class="label">Nota</span><input class="input" id="nota" maxlength="140" placeholder="Opcional" value="${esc(f.nota)}"></label>
        <div class="err" id="err" role="alert"></div>
        <button class="btn primary block" type="submit">Guardar ${f.tipo === 'Gasto' || f.tipo === 'Ingreso' ? f.tipo.toLowerCase() : ''}</button>
        ${editing ? `<button class="btn danger block" type="button" data-del="1">Borrar movimiento</button>
          <p class="sup" style="margin:0">Origen: ${esc(editing.origen || 'app')}${editing.creado ? ' · capturado ' + esc(editing.creado.slice(0, 16).replace('T', ' ')) : ''}</p>` : ''}`;
      impact();
    }
    function read() {
      const g = id => $('#' + id, el);
      if (g('monto')) f.monto = g('monto').value;
      if (g('concepto')) f.concepto = g('concepto').value;
      if (g('fecha')) f.fecha = g('fecha').value;
      if (g('nota')) f.nota = g('nota').value;
    }
    const parseMonto = v => Math.round(parseFloat(String(v).replace(/[$,\s]/g, '')) * 100) / 100;
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
      if (e.target.id === 'monto' || e.target.id === 'fecha') impact();
      $('#err', el).textContent = '';
    });
    el.addEventListener('change', e => { if (e.target.id === 'catall' && e.target.value) { read(); f.categoria = e.target.value; paint(); } });
    el.addEventListener('click', e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.act === 'close') return closeSheet();
      if (t.dataset.tipo) {
        read();
        if (t.dataset.tipo === 'mas') { mas = true; if (principales.includes(f.tipo)) f.tipo = 'Reembolso'; }
        else { mas = false; if (f.tipo !== t.dataset.tipo) { f.tipo = t.dataset.tipo; f.categoria = ''; f.cuenta = f.tipo === 'Ingreso' ? 'BBVA débito' : ultimaCta; } }
        return paint();
      }
      const group = t.parentElement && t.parentElement.dataset.chips;
      if (group) { read(); f[group] = t.dataset.v; if (group === 'tipo') f.categoria = ''; return paint(); }
      if (t.dataset.del) {
        if (!confirm('¿Borrar este movimiento? Queda registrado en el historial del repo.')) return;
        Store.deleteMovement(editing); closeSheet(); toast('Borrado.'); return;
      }
    });
    el.addEventListener('submit', e => {
      e.preventDefault(); read();
      const monto = parseMonto(f.monto), err = $('#err', el);
      if (!(monto > 0)) { err.textContent = 'Escribe el monto.'; $('#monto', el).focus(); return; }
      if (catsPara(f.tipo) && !f.categoria) { err.textContent = 'Elige una categoría.'; return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) { err.textContent = 'Revisa la fecha.'; return; }
      if (cuentasPara(f.tipo).a && !f.destino) { err.textContent = 'Elige a qué cuenta va.'; return; }
      const row = Object.assign({}, editing || {}, {
        id: editing ? editing.id : Store.newId(), fecha: f.fecha, concepto: f.concepto.trim() || f.categoria || f.tipo, monto, tipo: f.tipo,
        cuenta: f.cuenta, destino: f.destino, categoria: f.categoria, nota: f.nota.trim(),
        origen: editing ? editing.origen : 'app', creado: editing ? editing.creado : new Date().toISOString()
      });
      if (!editing) try { localStorage.setItem('cc.cta', JSON.stringify(f.cuenta)); } catch (x) {}
      if (editing) row.editado = new Date().toISOString();
      Store.saveMovement(row, editing);
      closeSheet();
      const mesRow = row.fecha.slice(0, 7);
      if (mesRow !== state.mes) state.mes = mesRow;
      render();
      const c = R.cats.find(x => x.nombre === row.categoria);
      let msg = editing ? 'Cambios guardados.' : 'Guardado.';
      if (c && c.tipo === 'Mensual') msg += ` ${c.nombre}: ${c.restante < 0 ? 'te pasaste por ' + money(-c.restante) : 'te quedan ' + money(c.restante)} este mes.`;
      else if (c && c.tipo === 'Fondo acumulable') msg += ` Fondo de ${c.nombre}: ${money(c.acumulado)}.`;
      toast(msg);
    });
    paint();
    if (!editing) setTimeout(() => { const m = $('#monto', el); if (m) m.focus(); }, 60);
  }

  // ---------- detalle de categoría ----------
  function categorySheet(nombre) {
    const c = R.cats.find(x => x.nombre === nombre); if (!c) return;
    const movs = R.movMes.filter(m => m.categoria === nombre);
    const el = openSheet(`${sheetHead('Categoria')}<div class="blk stack" style="padding-bottom:calc(24px + var(--safe-b))">
      <div><div class="label">${esc(c.grupo)} · ${esc(c.tipo)}</div><h2 class="h-case" style="margin-top:8px">${esc(c.nombre)}</h2>${c.nota ? `<p class="sup" style="margin:8px 0 0">${esc(c.nota)}</p>` : ''}</div>
      ${c.presupuestada ? `<div class="group pad"><div class="row-t" style="align-items:flex-end"><span class="big-amt n ${(c.tipo === 'Fondo acumulable' ? c.acumulado : c.restante) < 0 ? 'neg' : ''}">${money(c.tipo === 'Fondo acumulable' ? c.acumulado : c.restante)}</span><span class="metric">${pct(c.pct)}</span></div>
        <div class="sup">${c.tipo === 'Fondo acumulable' ? 'Acumulado en el fondo' : 'Te queda en ' + mesLargo(state.mes)}</div>${bar(c.pct)}
        <div class="sup n" style="display:flex;justify-content:space-between;margin-top:10px"><span>Gastado ${money(c.gastado)} de ${money(c.limite)}</span><span>Prom. feb–jul ${money(c.promedio)}</span></div></div>
      <form class="group pad" id="limf" style="display:grid;gap:10px"><label class="field"><span class="label">${c.tipo === 'Fondo acumulable' ? 'Apartar al mes' : 'Límite mensual'}</span>
        <input class="input n" id="lim" inputmode="decimal" value="${c.limite}"></label><button class="btn sm" type="submit">Guardar límite</button><div class="err" id="limerr"></div></form>` : `<div class="group pad"><span class="big-amt n">${money(c.gastado)}</span><div class="sup">Gastado en ${mesLargo(state.mes)} · sin límite</div></div>`}
      <button class="btn primary block" data-act="nuevo-cat">Registrar aquí</button>
      <div class="group"><div class="group-h"><span class="label" style="color:var(--ink)">${movs.length} movimientos en ${mesLargo(state.mes)}</span></div>${movs.map(rowMov).join('') || '<div class="empty">Nada registrado este mes.</div>'}</div>
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
  const DEFAULTS = { owner: 'pa70xd', repo: 'cuentas-claras-datos' };
  function connectForm(s, inSheet) {
    return `<form id="conn" class="stack" autocomplete="off">
      <div class="two"><label class="field"><span class="label">Usuario de GitHub</span><input class="input" id="owner" value="${esc(s.owner)}" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span class="label">Repo de datos</span><input class="input" id="repo" value="${esc(s.repo)}" autocapitalize="off" spellcheck="false"></label></div>
      <label class="field"><span class="label">Token</span><input class="input" id="token" type="password" placeholder="github_pat_…" autocapitalize="off" spellcheck="false" ${inSheet ? '' : 'required'}></label>
      <div class="err" id="connerr" role="alert"></div>
      <button class="btn primary block" type="submit">${inSheet ? 'Cambiar conexión' : 'Conectar'}</button></form>`;
  }
  const tokenSteps = `<div class="steps">
      <div class="step"><b>1</b><p>Abre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → Fine-grained token</a>.</p></div>
      <div class="step"><b>2</b><p><b>Repository access:</b> Only select repositories → <b>cuentas-claras-datos</b>. <b>Permissions:</b> Contents → Read and write. Nada más.</p></div>
      <div class="step"><b>3</b><p>Copia el token y pégalo aquí. Se guarda solo en este teléfono.</p></div></div>`;
  function bindConnect(root) {
    $('#conn', root).addEventListener('submit', async e => {
      e.preventDefault();
      const prev = Store.settings() || {};
      const s = { owner: $('#owner', root).value.trim(), repo: $('#repo', root).value.trim(), token: $('#token', root).value.trim() || prev.token };
      const err = $('#connerr', root), btn = e.submitter || $('button[type=submit]', root);
      if (!s.owner || !s.repo || !s.token) { err.textContent = 'Llena usuario, repo y token.'; return; }
      btn.disabled = true; btn.textContent = 'Conectando…'; err.textContent = '';
      try { await Store.connect(s); closeSheet(); render(); toast('Conectado. Tus datos ya están en este teléfono.'); }
      catch (x) { err.textContent = x.message; btn.disabled = false; btn.textContent = 'Reintentar'; }
    });
  }
  function renderSetup() {
    app.innerHTML = `<div class="blk inv" style="min-height:100vh;padding-top:calc(32px + var(--safe-t));padding-bottom:40px">
      <p class="kicker">${kicker('Cuentas claras')}</p><h1 class="h-hero" style="margin-top:20px">Conecta tu base de datos</h1>
      <p class="body-l" style="color:var(--gray-60);margin:14px 0 0">Tus movimientos viven en tu repo privado de GitHub. Esta página es pública, tus datos no.</p>
      ${tokenSteps}${connectForm(Store.settings() || DEFAULTS, false)}</div>`;
    bindConnect(app);
  }
  function settingsSheet() {
    const s = Store.settings() || DEFAULTS, st = Store.status;
    const el = openSheet(`${sheetHead('Ajustes')}<div class="blk stack" style="padding-bottom:calc(24px + var(--safe-b))">
      <div class="group pad"><div class="label">Base de datos</div><div class="h-case" style="margin-top:8px;text-transform:none;font-size:18px">${esc(s.owner)}/${esc(s.repo)}</div>
        <div class="sup" style="margin-top:8px">${st.lastSync ? 'Última sincronización ' + esc(new Date(st.lastSync).toLocaleString('es-MX')) : 'Sin sincronizar'} · ${Store.pending()} cambios pendientes</div>
        ${st.error ? `<div class="note bad">${esc(st.error)}</div>` : ''}
        <div class="two" style="margin-top:14px"><button class="btn sm" data-act="sync-now">Sincronizar</button><a class="btn sm" target="_blank" rel="noopener" href="https://github.com/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/commits">Historial</a></div></div>
      <div class="group pad"><div class="label">Respaldo</div><p class="sup" style="margin:8px 0 12px">Descarga todos tus movimientos en CSV (abre en Excel).</p><button class="btn sm" data-act="csv">Exportar CSV</button></div>
      <div class="group pad"><div class="label" style="margin-bottom:12px">Conexión</div>${tokenSteps}${connectForm(s, true)}
        <p class="sup">Deja el token vacío para conservar el actual.</p>
        <button class="btn sm danger" data-act="logout" style="margin-top:6px">Desconectar este teléfono</button></div>
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
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 4800);
  }

  // ---------- eventos globales ----------
  app.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    const a = t.dataset.act;
    if (a === 'vista') { state.vista = t.dataset.v; try { localStorage.setItem('cc.vista', JSON.stringify(state.vista)); } catch (x) {} render(); window.scrollTo(0, 0); }
    else if (a === 'mes') { const ms = mesesDisponibles(); const i = ms.indexOf(state.mes) + (+t.dataset.d); if (ms[i]) { state.mes = ms[i]; render(); } }
    else if (a === 'flim') { state.filtroLim = t.dataset.v; render(); }
    else if (a === 'fmov') { state.filtroMov = t.dataset.v; render(); }
    else if (a === 'nuevo') capture({ tipo: t.dataset.tipo, fecha: state.mes === hoy().slice(0, 7) ? hoy() : state.mes + '-01' });
    else if (a === 'cat') categorySheet(t.dataset.n);
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
