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
      const pct = presup && c.limite > 0 ? mesG / c.limite : null;
      let estado = null;
      if (c.tipo === 'Mensual' && pct !== null) estado = pct > 1 ? 'mal' : pct >= 0.8 ? 'cerca' : 'bien';
      if (c.tipo === 'Fondo acumulable') estado = acumulado < 0 ? 'mal' : 'bien';
      return { ...c, gastado: r2(mesG), movs: n, restante: presup ? r2(c.limite - mesG) : null, pct, estado,
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
      mes, hoy, cuentas, cats, deudas, metas,
      movMes: enMes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || '')),
      resumen: { ingresos: r2(ingresos), gastoPropio: r2(gastoPropio), presupuesto: r2(presupuesto), gastadoPresup: r2(gastadoPresup),
        queda: r2(presupuesto - gastadoPresup), cuotasMes: r2(cuotasMes), comprasMsiMes,
        rojo: cats.filter(c => c.estado === 'mal').length, amarillo: cats.filter(c => c.estado === 'cerca').length,
        tienes: r2(tienes), deudaTarjetas: r2(deudaTarjetas), debes: r2(debes), neto: r2(tienes - debes),
        pendienteMsi: r2(deudas.filter(d => !d.auto).reduce((a, d) => a + d.pendiente, 0)),
        cuotaActiva: r2(deudas.filter(d => !d.auto && d.activa).reduce((a, d) => a + d.cuota, 0)) }
    };
  }

  const api = { computeAll, categoryEffect, monthKey, isoDate, addMonths, TIPOS, NEUTRAL };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Logic = api;
})(this);
