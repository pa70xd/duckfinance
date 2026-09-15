// Cálculos de Cuentas Claras. Sin DOM: se prueba en Node con los mismos datos.
(function (root) {
  const monthKey = iso => iso.slice(0, 7);
  function monthsBetween(aIso, bIso) {
    const a = new Date(aIso + 'T00:00:00'), b = new Date(bIso + 'T00:00:00');
    let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m -= 1;
    return m;
  }
  const pad = n => String(n).padStart(2, '0');
  const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  function addMonths(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setMonth(d.getMonth() + n);
    return isoDate(d);
  }
  function weekStart(iso) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return isoDate(d);
  }
  const r2 = x => Math.round(x * 100) / 100;

  const TIPOS = ['Gasto', 'Ingreso', 'Reembolso', 'Pago de tarjeta', 'Transferencia', 'Compra a meses', 'Cuota a meses', 'Ajuste de saldo'];
  const NEUTRAL = new Set(['Compras para otras personas', 'GMM (reembolsado por Emerald)']);

  function categoryEffect(m) {
    if (m.tipo === 'Gasto' || m.tipo === 'Compra a meses') return m.monto;
    if (m.tipo === 'Reembolso') return -m.monto;
    return 0;
  }

  function computeAll(D, mes, hoy) {
    const mov = D.mov;

    const cuentas = D.cuentas.map(c => {
      let s = c.saldo_inicial;
      for (const m of mov) {
        if (m.cuenta === c.nombre) {
          if (c.tipo === 'Crédito') {
            if (m.tipo === 'Gasto' || m.tipo === 'Compra a meses') s += m.monto;
            else if (m.tipo === 'Reembolso' || m.tipo === 'Ingreso') s -= m.monto;
          } else {
            if (['Ingreso', 'Reembolso', 'Ajuste de saldo'].includes(m.tipo)) s += m.monto;
            else if (['Gasto', 'Compra a meses', 'Pago de tarjeta', 'Transferencia'].includes(m.tipo)) s -= m.monto;
          }
        }
        if (m.destino === c.nombre) s += (c.tipo === 'Crédito' ? -m.monto : m.monto);
      }
      return { ...c, saldo: r2(s), disponible: c.tipo === 'Crédito' && c.limite ? r2(c.limite - s) : null };
    });
    const byName = Object.fromEntries(cuentas.map(c => [c.nombre, c]));

    const ws = weekStart(hoy);
    const cats = D.categorias.map(c => {
      let mesG = 0, semana = 0, desdeInicio = 0, hist = 0, n = 0;
      for (const m of mov) {
        if (m.categoria !== c.nombre) continue;
        const e = categoryEffect(m);
        if (!e) continue;
        if (monthKey(m.fecha) === mes) { mesG += e; n++; }
        if (m.fecha >= ws && m.fecha <= hoy) semana += e;
        if (m.fecha >= D.config.inicio) desdeInicio += e;
        if (m.fecha >= '2026-02-01' && m.fecha <= '2026-07-31') hist += e;
      }
      const presup = c.tipo === 'Mensual' || c.tipo === 'Fondo acumulable';
      let acumulado = null;
      if (c.tipo === 'Fondo acumulable') {
        acumulado = hoy < D.config.inicio ? 0 : c.limite * (monthsBetween(D.config.inicio, hoy) + 1) - desdeInicio;
      }
      // Un fijo con meses de cobro (luz bimestral) tiene de límite lo que se cobra ese mes: $800 o $0
      const limMes = c.tipo === 'Mensual' && esFijo(c) && c.meses ? limiteEnDias(c, diasDelMes(mes)).limite : c.limite;
      const pct = presup ? (limMes > 0 ? mesG / limMes : mesG > 0 ? Infinity : 0) : null;
      let estado = null;
      if (c.tipo === 'Mensual' && pct !== null) estado = pct > 1 ? 'mal' : pct >= 0.8 ? 'cerca' : 'bien';
      if (c.tipo === 'Fondo acumulable') estado = acumulado < 0 ? 'mal' : 'bien';
      return { ...c, limiteMes: limMes, gastado: r2(mesG), movs: n, restante: presup ? r2(limMes - mesG) : null, pct, estado,
        semana: r2(semana), limiteSemanal: c.tipo === 'Mensual' ? c.limite * 12 / 52 : null,
        acumulado: acumulado === null ? null : r2(acumulado), promedio: r2(hist / 6), presupuestada: presup };
    });

    const deudas = D.deudas.map(d => {
      let pagado = 0, n = 0, ultimo = null;
      if (!d.auto) {
        for (const m of mov) if (m.plan === d.id && m.tipo === 'Cuota a meses') { pagado += m.monto; n++; if (!ultimo || m.fecha > ultimo) ultimo = m.fecha; }
      }
      let previo = d.previo;
      if (d.auto) { n = Math.max(0, Math.min(d.plazo, monthsBetween(d.fecha, hoy) + 1)); previo = d.cuota * n; ultimo = addMonths(d.fecha, n - 1); }
      const pendiente = Math.max(0, r2(d.original - previo - pagado));
      const restantes = pendiente === 0 ? 0 : Math.ceil(pendiente / d.cuota - 1e-9);
      const termina = pendiente === 0 ? null : (ultimo ? addMonths(ultimo, restantes) : addMonths(d.fecha, d.plazo));
      return { ...d, pagadoRegistrado: r2(pagado), cuotasRegistradas: n, pendiente, restantes, termina, activa: pendiente > 0 };
    });

    const enMes = mov.filter(m => monthKey(m.fecha) === mes);
    // Gastos capturados sin categoría: cuentan contra el presupuesto hasta que se clasifiquen
    const sinCat = m => (m.tipo === 'Gasto' || m.tipo === 'Compra a meses') && !m.categoria;
    const porClasificar = mov.filter(sinCat).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || ''));
    const sinClasificarMes = enMes.filter(sinCat).reduce((a, m) => a + m.monto, 0);
    const ingresos = enMes.filter(m => m.tipo === 'Ingreso').reduce((a, m) => a + m.monto, 0);
    const gastoPropio = enMes.filter(m => !NEUTRAL.has(m.categoria)).reduce((a, m) => a + categoryEffect(m), 0);
    const presupuesto = cats.filter(c => c.presupuestada).reduce((a, c) => a + c.limite, 0);
    const gastadoPresup = cats.filter(c => c.presupuestada).reduce((a, c) => a + c.gastado, 0);
    const cuotasMes = enMes.filter(m => m.tipo === 'Cuota a meses').reduce((a, m) => a + m.monto, 0);
    const comprasMsiMes = enMes.filter(m => m.tipo === 'Compra a meses');

    const gbm = byName['GBM'] ? byName['GBM'].saldo : 0;
    const metas = D.metas.map(t => {
      let actual = t.actual;
      if (t.tipo === 'Emergencia') actual = Math.min(gbm, t.objetivo);
      if (t.tipo === 'Casa') { const em = D.metas.find(x => x.tipo === 'Emergencia'); actual = Math.max(0, gbm - (em ? em.objetivo : 0)); }
      const falta = t.objetivo ? Math.max(0, t.objetivo - actual) : null;
      const meses = t.objetivo && t.aport ? Math.ceil(falta / t.aport) : null;
      return { ...t, actual: r2(actual), avance: t.objetivo ? actual / t.objetivo : null, falta, meses,
        fecha: meses !== null ? addMonths(hoy.slice(0, 8) + '01', meses) : null };
    });

    const tienes = cuentas.filter(c => c.tipo !== 'Crédito').reduce((a, c) => a + c.saldo, 0);
    const deudaTarjetas = cuentas.filter(c => c.tipo === 'Crédito').reduce((a, c) => a + c.saldo, 0);
    const auto = deudas.find(d => d.auto);
    const debes = deudaTarjetas + (auto ? auto.pendiente : 0);

    return {
      mes, hoy, cuentas, cats, deudas, metas, porClasificar,
      movMes: enMes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || '')),
      resumen: { ingresos: r2(ingresos), gastoPropio: r2(gastoPropio), presupuesto: r2(presupuesto), gastadoPresup: r2(gastadoPresup),
        queda: r2(presupuesto - gastadoPresup - sinClasificarMes), sinClasificar: r2(sinClasificarMes), cuotasMes: r2(cuotasMes), comprasMsiMes,
        rojo: cats.filter(c => c.estado === 'mal').length, amarillo: cats.filter(c => c.estado === 'cerca').length,
        tienes: r2(tienes), deudaTarjetas: r2(deudaTarjetas), debes: r2(debes), neto: r2(tienes - debes),
        pendienteMsi: r2(deudas.filter(d => !d.auto).reduce((a, d) => a + d.pendiente, 0)),
        cuotaActiva: r2(deudas.filter(d => !d.auto && d.activa).reduce((a, d) => a + d.cuota, 0)) }
    };
  }

  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
  const daysInMonth = iso => new Date(+iso.slice(0, 4), +iso.slice(5, 7), 0).getDate();
  // Mes al que pertenece una semana (lunes a domingo): el de su jueves, como en ISO 8601
  const mesDeSemana = ws => addDays(ws, 3).slice(0, 7);

  const esFijo = c => !!(c.dias && c.dias.length);
  const diasDelMes = mes => Array.from({ length: daysInMonth(mes + '-01') }, (_, i) => mes + '-' + pad(i + 1));

  // Límite de una categoría en un rango de días. Los cargos fijos (c.dias = días del mes en que se cobran;
  // c.meses = meses en que hay cobro, p. ej. la luz bimestral) cuentan completos en su día: el recibo
  // vale lo de todo su periodo (luz $400/mes cada 2 meses = $800). Lo variable se reparte por día.
  function limiteEnDias(c, dias) {
    let l = 0;
    const cobros = [];
    for (const d of dias) {
      const dim = daysInMonth(d), dd = +d.slice(8, 10);
      if (esFijo(c)) {
        if (c.meses && c.meses.length && !c.meses.includes(+d.slice(5, 7))) continue;
        const porCobro = c.limite * (c.meses && c.meses.length ? 12 / c.meses.length : 1) / c.dias.length;
        for (const x of c.dias) if (Math.min(x, dim) === dd) { l += porCobro; cobros.push(d); }
      } else l += c.limite / dim;
    }
    return { limite: r2(l), cobros };
  }

  // Lo que un fijo cobró de más sobre lo apartado en su mes (p. ej. Claude Max con el dólar arriba), contado en los
  // días desde..hasta en que se pasó. Eso sí sale de lo libre.
  function excesoFijo(D, c, desde, hasta) {
    let total = 0;
    const meses = [...new Set(D.mov.filter(m => m.categoria === c.nombre && m.fecha >= desde && m.fecha <= hasta && categoryEffect(m)).map(m => monthKey(m.fecha)))];
    for (const mes of meses) {
      const apartado = limiteEnDias(c, diasDelMes(mes)).limite;
      let antes = 0, hastaFin = 0;
      for (const m of D.mov) {
        if (m.categoria !== c.nombre || monthKey(m.fecha) !== mes || m.fecha > hasta) continue;
        const e = categoryEffect(m);
        hastaFin += e; if (m.fecha < desde) antes += e;
      }
      total += Math.max(0, hastaFin - apartado) - Math.max(0, antes - apartado);
    }
    return Math.max(0, r2(total));
  }

  // Semana (lunes a domingo).
  const computeSemana = (D, ws, hoy) => computePeriodo(D, [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i)), hoy);
  const computeMes = (D, mes, hoy) => computePeriodo(D, diasDelMes(mes), hoy);

  // Límites de un periodo: categorías mensuales variables (lo libre), fijos (apartado, no cuenta como libre)
  // y fondos acumulables (van aparte).
  function computePeriodo(D, dias, hoy) {
    const ws = dias[0], we = dias[dias.length - 1];
    const enSem = D.mov.filter(m => m.fecha >= ws && m.fecha <= we);
    const mensuales = D.categorias.filter(c => c.tipo === 'Mensual').map(c => {
      const { limite, cobros } = limiteEnDias(c, dias);
      let gastado = 0, movs = 0, ultimo = null;
      for (const m of enSem) if (m.categoria === c.nombre) { const e = categoryEffect(m); if (e) { gastado += e; movs++; if (!ultimo || m.fecha > ultimo) ultimo = m.fecha; } }
      gastado = r2(gastado);
      const pct = limite > 0 ? gastado / limite : gastado > 0 ? Infinity : 0;
      const estado = pct > 1 ? 'mal' : pct >= 0.8 ? 'cerca' : 'bien';
      return { ...c, limiteMes: c.limite, limite, gastado, movs, ultimo, restante: r2(limite - gastado), pct, estado, cobros, fijo: esFijo(c) };
    });
    const cats = mensuales.filter(c => !c.fijo);
    // El exceso de un fijo se mide contra lo apartado en su mes y se carga al periodo donde se pagó
    // Un cobro está pagado si en su mes ya hay tantos pagos como cobros hasta él (el banco puede cobrar un día antes o después)
    const fijos = mensuales.filter(c => c.fijo).map(c => {
      const pagosDe = mes => D.mov.filter(m => m.categoria === c.nombre && monthKey(m.fecha) === mes && categoryEffect(m) > 0).map(m => m.fecha).sort();
      const pendientes = c.cobros.filter(d => {
        const delMes = limiteEnDias(c, diasDelMes(monthKey(d))).cobros;
        return pagosDe(monthKey(d)).length <= delMes.indexOf(d);
      });
      const pagos = [...new Set(c.cobros.map(monthKey))].flatMap(pagosDe);
      const ultimo = [c.ultimo, ...pagos].filter(Boolean).sort().pop() || null;
      return { ...c, exceso: excesoFijo(D, { ...c, limite: c.limiteMes }, ws, we), pendientes, ultimo,
        pagado: c.cobros.length ? !pendientes.length : c.gastado > 0 };
    }).filter(c => c.limite > 0 || c.gastado !== 0);
    const fondos = D.categorias.filter(c => c.tipo === 'Fondo acumulable').map(c => ({
      nombre: c.nombre, gastado: r2(enSem.filter(m => m.categoria === c.nombre).reduce((a, m) => a + categoryEffect(m), 0))
    }));
    const presupuestadas = new Set(D.categorias.filter(c => c.tipo === 'Mensual' || c.tipo === 'Fondo acumulable').map(c => c.nombre));
    const otrasMap = {};
    for (const m of enSem) {
      if (!m.categoria || presupuestadas.has(m.categoria)) continue;
      const e = categoryEffect(m); if (!e) continue;
      const c = D.categorias.find(x => x.nombre === m.categoria);
      if (c && c.tipo === 'Ingreso') continue;
      const o = otrasMap[m.categoria] = otrasMap[m.categoria] || { nombre: m.categoria, tipo: c ? c.tipo : '', gastado: 0, movs: 0 };
      o.gastado = r2(o.gastado + e); o.movs++;
    }
    const sinClasificar = r2(enSem.filter(m => (m.tipo === 'Gasto' || m.tipo === 'Compra a meses') && !m.categoria).reduce((a, m) => a + m.monto, 0));
    const presupuesto = r2(cats.reduce((a, c) => a + c.limite, 0));
    const gastado = r2(cats.reduce((a, c) => a + c.gastado, 0));
    const apartado = r2(fijos.reduce((a, c) => a + c.limite, 0));
    const exceso = r2(fijos.reduce((a, c) => a + c.exceso, 0));
    const diasRestantes = hoy < ws ? dias.length : hoy > we ? 0 : Math.round((new Date(we + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 864e5) + 1;
    return { ws, we, dias, cats, fijos, fondos, otras: Object.values(otrasMap),
      resumen: { presupuesto, gastado, sinClasificar, apartado, exceso, queda: r2(presupuesto - gastado - sinClasificar - exceso), diasRestantes } };
  }

  const api = { computeAll, computeSemana, computeMes, computePeriodo, limiteEnDias, excesoFijo,categoryEffect, monthKey, isoDate, addMonths, addDays, weekStart, daysInMonth, mesDeSemana, TIPOS, NEUTRAL };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Logic = api;
})(this);
