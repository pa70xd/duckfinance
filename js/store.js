// Base de datos: archivos JSON en un repo privado de GitHub, con copia local y cola de cambios.
// db/config.json            cuentas, categorías (límites), deudas, metas
// db/movimientos/AAAA-MM.json  un archivo por mes, un movimiento por línea
(function (root) {
  const K = { settings: 'cc.settings', cache: 'cc.cache', outbox: 'cc.outbox', lastSync: 'cc.lastSync' };
  const API = 'https://api.github.com';
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  let cache = load(K.cache, { config: null, months: {} }); // months[mes] = { sha, rows }
  let outbox = load(K.outbox, []);
  const listeners = new Set();
  const status = { syncing: false, error: null, lastSync: load(K.lastSync, null) };
  const emit = () => listeners.forEach(fn => fn());

  const settings = () => load(K.settings, null);
  const configured = () => { const s = settings(); return !!(s && s.owner && s.repo && s.token); };

  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

  async function gh(path, opts = {}) {
    const s = settings();
    let r;
    try {
      r = await fetch(`${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/${path}`, {
        ...opts, cache: 'no-store',
        headers: { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) }
      });
    } catch (e) { throw new ApiError(0, 'Sin conexión'); }
    if (r.ok) return r.json();
    if (r.status === 401) throw new ApiError(401, 'El token no es válido o ya venció.');
    if (r.status === 403) throw new ApiError(403, 'El token no tiene permiso de escritura sobre el repo de datos.');
    if (r.status === 404) throw new ApiError(404, 'No encontré el repo o el archivo.');
    throw new ApiError(r.status, 'GitHub respondió ' + r.status);
  }

  const toB64 = str => { const b = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
  const dumpRows = rows => '[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]\n';

  async function getFile(path) {
    try { const j = await gh(`contents/${path}`); return { sha: j.sha, data: JSON.parse(fromB64(j.content)) }; }
    catch (e) { if (e.status === 404) return null; throw e; }
  }
  async function listDir(path) {
    try { return await gh(`contents/${path}`); } catch (e) { if (e.status === 404) return []; throw e; }
  }
  const putFile = (path, text, sha, message) =>
    gh(`contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: toB64(text), ...(sha ? { sha } : {}) }) });

  // --- aplicar cambios pendientes (idempotentes) ---
  function applyToRows(rows, ops) {
    let out = rows.slice();
    for (const op of ops) {
      if (op.t === 'put') { out = out.filter(r => r.id !== op.row.id); out.push(op.row); }
      else if (op.t === 'del') out = out.filter(r => r.id !== op.rowId);
    }
    return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.creado || '').localeCompare(b.creado || ''));
  }
  function applyToConfig(cfg, ops) {
    const out = JSON.parse(JSON.stringify(cfg));
    for (const op of ops) if (op.t === 'limite') { const c = out.categorias.find(x => x.nombre === op.nombre); if (c) c.limite = op.limite; }
    return out;
  }
  const fileOf = op => op.t === 'limite' ? 'config' : op.mes;

  function data() {
    if (!cache.config) return null;
    const cfg = applyToConfig(cache.config.data, outbox.filter(o => fileOf(o) === 'config'));
    const meses = new Set([...Object.keys(cache.months), ...outbox.filter(o => o.mes).map(o => o.mes)]);
    const pend = new Set(outbox.filter(o => o.t === 'put').map(o => o.row.id));
    const mov = [];
    for (const mes of meses) {
      const base = cache.months[mes] ? cache.months[mes].rows : [];
      for (const r of applyToRows(base, outbox.filter(o => o.mes === mes))) mov.push(pend.has(r.id) ? { ...r, _pendiente: true } : r);
    }
    return { ...cfg, mov };
  }

  function enqueue(ops) {
    for (const op of ops) outbox.push({ ...op, opId: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) });
    save(K.outbox, outbox);
    emit();
    sync();
  }

  const newId = () => 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function saveMovement(row, previous) {
    const ops = [];
    if (previous && previous.fecha.slice(0, 7) !== row.fecha.slice(0, 7)) ops.push({ t: 'del', mes: previous.fecha.slice(0, 7), rowId: previous.id, label: previous, movedTo: row.fecha });
    const clean = Object.fromEntries(Object.entries(row).filter(([k, v]) => !k.startsWith('_') && v !== '' && v !== null && v !== undefined));
    ops.push({ t: 'put', mes: row.fecha.slice(0, 7), row: clean });
    enqueue(ops);
  }
  const deleteMovement = row => enqueue([{ t: 'del', mes: row.fecha.slice(0, 7), rowId: row.id, label: row }]);
  const setLimit = (nombre, limite) => enqueue([{ t: 'limite', nombre, limite }]);

  const money = n => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
  function commitMessage(ops) {
    if (ops.length === 1 && ops[0].t === 'limite') return `Límite: ${ops[0].nombre} → ${money(ops[0].limite)}`;
    const puts = ops.filter(o => o.t === 'put'), dels = ops.filter(o => o.t === 'del');
    if (puts.length === 1 && !dels.length) { const r = puts[0].row; return `${r.tipo}: ${money(r.monto)} ${r.categoria || r.destino || ''} (${r.fecha})`.trim(); }
    if (dels.length === 1 && !puts.length && dels[0].label) { const r = dels[0].label; return dels[0].movedTo ? `Movido: ${r.tipo} ${money(r.monto)} (${r.fecha} → ${dels[0].movedTo})` : `Borrado: ${r.tipo} ${money(r.monto)} (${r.fecha})`; }
    return `Cuentas Claras: ${puts.length} guardados, ${dels.length} borrados`;
  }

  // --- sincronización ---
  let running = null;
  function sync() {
    if (!configured()) return Promise.resolve();
    if (running) { running.again = true; return running.p; }
    const job = { again: false };
    job.p = (async () => {
      status.syncing = true; status.error = null; emit();
      try {
        do { job.again = false; await pull(); await push(); } while (job.again);
        status.lastSync = new Date().toISOString(); save(K.lastSync, status.lastSync);
      } catch (e) {
        status.error = e.status === 0 ? 'Sin conexión. Tus cambios se guardan aquí y se suben después.' : e.message;
      } finally { status.syncing = false; running = null; emit(); }
    })();
    running = job;
    return job.p;
  }

  async function pull() {
    const [db, movs] = await Promise.all([listDir('db'), listDir('db/movimientos')]);
    const cfgEntry = Array.isArray(db) && db.find(e => e.name === 'config.json');
    if (!cfgEntry) throw new ApiError(404, 'El repo de datos no tiene db/config.json.');
    if (!cache.config || cache.config.sha !== cfgEntry.sha) cache.config = await getFile('db/config.json');
    const remote = {};
    for (const e of movs) { const m = /^(\d{4}-\d{2})\.json$/.exec(e.name); if (m) remote[m[1]] = e.sha; }
    const stale = Object.keys(remote).filter(mes => !cache.months[mes] || cache.months[mes].sha !== remote[mes]);
    const files = await Promise.all(stale.map(mes => getFile(`db/movimientos/${mes}.json`)));
    stale.forEach((mes, i) => { if (files[i]) cache.months[mes] = { sha: files[i].sha, rows: files[i].data }; });
    for (const mes of Object.keys(cache.months)) if (!remote[mes]) delete cache.months[mes];
    save(K.cache, cache);
    emit();
  }

  async function push() {
    const groups = {};
    for (const op of outbox) (groups[fileOf(op)] = groups[fileOf(op)] || []).push(op);
    for (const [file, ops] of Object.entries(groups)) {
      const path = file === 'config' ? 'db/config.json' : `db/movimientos/${file}.json`;
      for (let intento = 0; ; intento++) {
        const base = file === 'config' ? cache.config : cache.months[file];
        const text = file === 'config'
          ? JSON.stringify(applyToConfig(base.data, ops), null, 1) + '\n'
          : dumpRows(applyToRows(base ? base.rows : [], ops));
        try {
          const res = await putFile(path, text, base && base.sha, commitMessage(ops));
          const parsed = JSON.parse(text);
          if (file === 'config') cache.config = { sha: res.content.sha, data: parsed };
          else cache.months[file] = { sha: res.content.sha, rows: parsed };
          const done = new Set(ops.map(o => o.opId));
          outbox = outbox.filter(o => !done.has(o.opId));
          save(K.cache, cache); save(K.outbox, outbox); emit();
          break;
        } catch (e) {
          if ((e.status === 409 || e.status === 422) && intento < 3) {
            const fresh = await getFile(path); // alguien más escribió: se reaplican los cambios sobre lo nuevo
            if (file === 'config') cache.config = fresh;
            else if (fresh) cache.months[file] = { sha: fresh.sha, rows: fresh.data };
            continue;
          }
          throw e;
        }
      }
    }
  }

  async function connect(s) {
    // Se prueba el token antes de guardarlo, para no dejar el teléfono con una conexión rota.
    let r;
    try {
      r = await fetch(`${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/db/config.json`, {
        cache: 'no-store', headers: { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
    } catch (e) { throw new Error('Sin conexión. Intenta cuando tengas señal.'); }
    if (r.status === 401) throw new Error('GitHub rechazó el token: revisa que lo copiaste completo y que no haya vencido.');
    if (r.status === 404 || r.status === 403) throw new Error('El token no ve el repo de datos. Revisa usuario, nombre del repo y que el token tenga acceso a ese repo.');
    if (!r.ok) throw new Error('GitHub respondió ' + r.status);
    save(K.settings, s);
    cache = { config: null, months: {} }; save(K.cache, cache);
    await sync();
    if (status.error) throw new Error(status.error);
  }
  function disconnect() {
    localStorage.removeItem(K.settings);
    emit();
  }

  function exportCsv() {
    const d = data(); if (!d) return '';
    const cols = ['fecha', 'concepto', 'monto', 'tipo', 'cuenta', 'destino', 'categoria', 'plan', 'nota', 'id'];
    const q = v => { const s = v === undefined || v === null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + cols.join(',') + '\n' + d.mov.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(r => cols.map(c => q(r[c])).join(',')).join('\n');
  }

  root.Store = {
    settings, configured, connect, disconnect, sync, data, status, newId, exportCsv,
    saveMovement, deleteMovement, setLimit,
    pending: () => outbox.length,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }
  };
})(this);
