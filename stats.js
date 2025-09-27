import { pb } from '../lib/pb';

// YYYY-MM-DD local
export function getLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Rango UTC del día (para filtrar si `day` es datetime)
function getUtcDayRange(dateKey) {
  const start = new Date(`${dateKey}T00:00:00Z`).toISOString();
  const end = new Date(`${dateKey}T23:59:59Z`).toISOString();
  return { start, end };
}

// Lee registro del día: prueba TEXT exacto y, si no, rango DATETIME
export async function getDailyStatRecord({ dateKey }) {
  try {
    return await pb.collection('daily_stats').getFirstListItem(`day="${dateKey}"`);
  } catch (e1) {
    if (e1?.status !== 400 && e1?.status !== 404) throw e1;
    const { start, end } = getUtcDayRange(dateKey);
    try {
      return await pb
        .collection('daily_stats')
        .getFirstListItem(`day >= "${start}" && day <= "${end}"`);
    } catch (e2) {
      if (e2?.status === 404 || e2?.status === 400) return null;
      throw e2;
    }
  }
}

// --- helpers JSON ---

// --- helpers ---
function mergeItemsCount(prevMap = {}, items = []) {
  const out = { ...(prevMap || {}) };
  for (const it of items) {
    const key = it?.productId ?? it?.name;
    if (!key) continue;
    const add = Number(it?.qty ?? 1) || 1;
    out[key] = (Number(out[key]) || 0) + add;
  }
  return out;
}

// Normaliza por las dudas si PB devolviera null en el json
function toJsonMap(val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) return { ...val };
  return {};
}

// Crea doc del día (prueba TEXT y luego DATETIME)
async function createDailyStatsDoc({ dateKey, revenue, itemsMap, ordersCount }) {
  // intento TEXT
  try {
    return await pb.collection('daily_stats').create({
      day: dateKey,
      revenue: Number(revenue || 0),
      itemsCount: itemsMap ?? {}, // JSON
      ordersCount: Number(ordersCount || 0),
    });
  } catch (e1) {
    const isDayValidation = e1?.status === 400 && e1?.data && e1.data.day;
    if (!isDayValidation) throw e1;

    // reintento DATETIME (inicio del día)
    const startOfDayIso = new Date(`${dateKey}T00:00:00Z`).toISOString();
    return await pb.collection('daily_stats').create({
      day: startOfDayIso,
      revenue: Number(revenue || 0),
      itemsCount: itemsMap ?? {}, // JSON
      ordersCount: Number(ordersCount || 0),
    });
  }
}

/**
 * Upsert que suma:
 *  - ordersCount: +addOrders (default 1)
 *  - revenue: +addRevenue
 *  - itemsCount: merge JSON con items de la orden
 *
 * @param {object} p
 * @param {string} p.dateKey YYYY-MM-DD
 * @param {number} p.addRevenue
 * @param {Array}  p.items array de items de la orden [{productId|name, qty}, ...]
 * @param {number} p.addOrders default 1
 */
export async function upsertDailyStatsJson({ dateKey, addRevenue, items = [], addOrders = 1 }) {
  const existing = await getDailyStatRecord({ dateKey });

  const deltaMap = mergeItemsCount({}, items);

  if (existing) {
    const prevRevenue = Number(existing.revenue || 0);
    const prevOrders = Number(existing.ordersCount || 0);
    const prevMap = toJsonMap(existing.itemsCount);

    const mergedMap = mergeItemsCount(prevMap, items);

    return await pb.collection('daily_stats').update(existing.id, {
      revenue: prevRevenue + Number(addRevenue || 0),
      ordersCount: prevOrders + Number(addOrders || 1),
      itemsCount: mergedMap, // JSON
    });
  }

  // No existe: crear nuevo
  try {
    return await createDailyStatsDoc({
      dateKey,
      revenue: Number(addRevenue || 0),
      itemsMap: deltaMap, // JSON
      ordersCount: Number(addOrders || 1),
    });
  } catch (e) {
    // Si otro lo creó (unique), releer y actualizar
    const again = await getDailyStatRecord({ dateKey });
    if (!again) throw e;

    const prevRevenue = Number(again.revenue || 0);
    const prevOrders = Number(again.ordersCount || 0);
    const prevMap = toJsonMap(again.itemsCount);
    const mergedMap = mergeItemsCount(prevMap, items);

    return await pb.collection('daily_stats').update(again.id, {
      revenue: prevRevenue + Number(addRevenue || 0),
      ordersCount: prevOrders + Number(addOrders || 1),
      itemsCount: mergedMap,
    });
  }
}

// ✅ DEFINICIÓN FALTANTE
export async function getDailyStatRecordSmart({ dateKey }) {
  try {
    return await pb.collection('daily_stats').getFirstListItem(`day="${dateKey}"`);
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

export async function createDailyStatsDocSmart({
  date = new Date(),
  revenue,
  itemsCount,
  ordersCount,
  extra = {},
}) {
  const coll = pb.collection('daily_stats');

  // YYYY-MM-DD siempre
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dayKey = `${yyyy}-${mm}-${dd}`;

  return await coll.create({
    day: dayKey, // 👈 siempre YYYY-MM-DD
    revenue: Number(revenue || 0),
    itemsCount: itemsCount ?? {},
    ordersCount: Number(ordersCount || 0),
    ...extra,
  });
}

export function formatLocalYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Devuelve la "fecha de negocio" (Date) desplazada por el corte.
 * Ej: cutoffHour=3 => el tramo 00:00–02:59 cuenta para el día anterior.
 */
export function getBusinessDate(date = new Date(), cutoffHour = 3) {
  const ms = date.getTime() - cutoffHour * 60 * 60 * 1000;
  return new Date(ms); // sigue en hora local del sistema
}

/** Si solo querés la clave YYYY-MM-DD del día de negocio */
export function getBusinessDayKey(date = new Date(), cutoffHour = 3) {
  const d = new Date(date);
  if (d.getHours() < cutoffHour) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`; // "YYYY-MM-DD"
}

export async function rebuildDailyStatsFromOrders(day) {
  const orders = await pb.collection('orders').getFullList({
    filter: `businessDate = "${day}" && status = "active"`, // usá un "status" en vez de borrar duro, si podés
    perPage: 200,
  });

  let revenue = 0,
    ordersCount = 0;
  const itemsCount = {},
    revenueByMethod = {};

  for (const o of orders) {
    ordersCount += 1;
    revenue += Number(o.total || 0);

    for (const p of o.payments || []) {
      const k = p.method;
      revenueByMethod[k] = (revenueByMethod[k] || 0) + Number(p.revenueAmount || 0);
    }

    for (const it of o.items || []) {
      const key = it.sku || it.id || it.name;
      const qty = Number(it.qty ?? it.quantity ?? 1);
      itemsCount[key] = (itemsCount[key] || 0) + qty;
    }
  }

  const coll = pb.collection('daily_stats');
  let doc;
  try {
    doc = await coll.getFirstListItem(`day = "${day}"`);
  } catch {
    doc = await coll.create({
      day,
      revenue: 0,
      ordersCount: 0,
      itemsCount: {},
      revenueByMethod: {},
    });
  }

  await coll.update(doc.id, { revenue, ordersCount, itemsCount, revenueByMethod });
}

export const computeBusinessDate = (d = new Date(), cutoffHour = 3) => {
  const dt = new Date(d);
  if (dt.getHours() < cutoffHour) dt.setDate(dt.getDate() - 1);
  dt.setHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
};

export function itemsCountFrom(items = []) {
  const acc = {};

  const pretty = (it) => {
    // Base: nombre del producto
    let label = String(it?.name || 'Producto').trim();

    // Si es paleta y tiene sabor único, lo agregamos como sufijo
    if (Array.isArray(it?.sabores) && it.sabores.length > 0) {
      // si hay varios sabores (helado por kg), los unimos con " + "
      const sabores = it.sabores.join(' + ');
      label = `${label} - ${sabores}`;
    }

    // Si viniera solo el sku/id con formato base__slug, lo convertimos
    // (fallback por si en algún flujo no llegó "sabores")
    else if (typeof it?.sku === 'string' && it.sku.includes('__')) {
      const [slug] = it.sku.split('__');
      const nice = slug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      label = `${label} - ${nice}`;
    }

    return label;
  };

  for (const it of items) {
    const key = pretty(it);
    const qty = Number(it?.quantity || 1);
    acc[key] = (acc[key] || 0) + qty;
  }

  return acc;
}

const FIELD_DELIVERY_BY_ADDRESS = 'deliveryByAddress';

export async function upsertDailyStatsJsonSmart({
  day,
  addRevenue = 0,
  addOrders = 0,
  addItems = {},
  paidAmount = {},
  method,
  mode,
  address,
  sign = +1,
  pruneZero = true, // <- borra claves cuyo valor quede 0
  deleteIfEmpty = false, // <- borra el doc del día si queda todo vacío
  epsilon = 0.00001, // <- tolerancia por redondeos
}) {
  const coll = pb.collection('daily_stats');
  const dayStr = typeof day === 'string' ? day : toDayString(day);

  // 1) Traer doc (o no) y abortar restas si no existe
  let doc = null;
  try {
    doc = await coll.getFirstListItem(`day="${dayStr}"`);
  } catch (e) {
    if (e?.status !== 404) throw e;
  }
  if (!doc && sign < 0) return null;

  // 2) Previos con defaults
  const prev = {
    revenue: safeNumber(doc?.revenue),
    ordersCount: safeNumber(doc?.ordersCount),
    itemsCount: safeJson(doc?.itemsCount),
    paidByMethod: safeJson(doc?.paidByMethod),
    revenueByMethod: safeJson(doc?.revenueByMethod),
    ordersByMethod: safeJson(doc?.ordersByMethod),
    ordersByMode: safeJson(doc?.ordersByMode),
    deliveryByAddress: safeJson(doc?.[FIELD_DELIVERY_BY_ADDRESS]),
  };

  const m = normalizeMethod(method);
  const paidMap = safeJson(paidAmount);
  const paidKeys = Object.keys(paidMap);
  const addrKey = mode === 'delivery' && address ? normalizeAddress(address) : null;

  // 3) Calcular siguiente estado
  let next = {
    revenue: clamp0(prev.revenue + sign * safeNumber(addRevenue)),
    ordersCount: clamp0(prev.ordersCount + sign * safeNumber(addOrders)),
    itemsCount: mergeCounts(prev.itemsCount, addItems, sign),
    paidByMethod: mergeCounts(prev.paidByMethod, paidAmount, sign),
    // Si vino desglose (paidAmount), distribuimos revenue y contamos la orden en cada método;
    // si no, usamos el método único como antes.
    revenueByMethod: mergeCounts(
      prev.revenueByMethod,
      paidKeys.length ? paidMap : m ? { [m]: safeNumber(addRevenue) } : {},
      sign
    ),
    ordersByMethod: mergeCounts(
      prev.ordersByMethod,
      paidKeys.length
        ? Object.fromEntries(paidKeys.map((k) => [k, Math.abs(addOrders || 1)]))
        : m
          ? { [m]: Math.abs(addOrders || 1) }
          : {},
      sign
    ),
    ordersByMode: mergeCounts(
      prev.ordersByMode,
      mode ? { [mode]: Math.abs(addOrders || 1) } : {},
      sign
    ),
    deliveryByAddress: (() => {
      if (!addrKey) return { ...prev.deliveryByAddress };
      return mergeCounts(prev.deliveryByAddress, { [addrKey]: Math.abs(addOrders || 1) }, sign);
    })(),
  };

  // 4) Clamp a >= 0 y PRUNE de claves en 0
  next.itemsCount = clampCounts(next.itemsCount, epsilon);
  next.paidByMethod = clampCounts(next.paidByMethod, epsilon);
  next.revenueByMethod = clampCounts(next.revenueByMethod, epsilon);
  next.ordersByMethod = clampCounts(next.ordersByMethod, epsilon);
  next.ordersByMode = clampCounts(next.ordersByMode, epsilon);
  next.deliveryByAddress = clampCounts(next.deliveryByAddress, epsilon);

  if (pruneZero) {
    next.itemsCount = pruneZeroKeys(next.itemsCount, epsilon);
    next.paidByMethod = pruneZeroKeys(next.paidByMethod, epsilon); // si no querés podés omitirlo
    next.revenueByMethod = pruneZeroKeys(next.revenueByMethod, epsilon);
    next.ordersByMethod = pruneZeroKeys(next.ordersByMethod, epsilon);
    next.ordersByMode = pruneZeroKeys(next.ordersByMode, epsilon);
    next.deliveryByAddress = pruneZeroKeys(next.deliveryByAddress, epsilon);
  }

  // 5) (Opcional) si quedó todo vacío, borrar el doc
  if (deleteIfEmpty && isDailyEmpty(next)) {
    if (doc) await coll.delete(doc.id);
    return null;
  }

  // 6) Persistir
  const payload = {
    day: dayStr,
    revenue: next.revenue,
    ordersCount: next.ordersCount,
    itemsCount: next.itemsCount,
    paidByMethod: next.paidByMethod,
    revenueByMethod: next.revenueByMethod,
    ordersByMethod: next.ordersByMethod,
    ordersByMode: next.ordersByMode,
  };
  payload[FIELD_DELIVERY_BY_ADDRESS] = next.deliveryByAddress;

  if (!doc) return await coll.create(payload);
  return await coll.update(doc.id, payload);
}

/* ====== helpers ====== */
function toDayString(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function safeNumber(n, def = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : def;
}
function safeJson(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : {};
}
function mergeCounts(base = {}, delta = {}, sign = +1) {
  const out = { ...safeJson(base) };
  for (const k of Object.keys(delta || {})) {
    out[k] = safeNumber(out[k]) + sign * safeNumber(delta[k]);
  }
  return out;
}
function clamp0(n) {
  return n < 0 ? 0 : n;
}
function clampCounts(obj = {}, eps = 0) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = v < eps ? 0 : v;
  return out;
}
function pruneZeroKeys(obj = {}, eps = 0) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (Math.abs(Number(v) || 0) > eps) out[k] = v;
  return out;
}
function isEmptyMap(obj) {
  return !obj || Object.keys(obj).length === 0;
}
function isDailyEmpty(n) {
  return (
    safeNumber(n.revenue) === 0 &&
    safeNumber(n.ordersCount) === 0 &&
    isEmptyMap(n.itemsCount) &&
    isEmptyMap(n.paidByMethod) &&
    isEmptyMap(n.revenueByMethod) &&
    isEmptyMap(n.ordersByMethod) &&
    isEmptyMap(n.ordersByMode) &&
    isEmptyMap(n.deliveryByAddress)
  );
}
function normalizeMethod(m) {
  if (!m) return null;
  const s = String(m).toLowerCase();
  if (s.startsWith('efec')) return 'efectivo';
  if (s.startsWith('trans')) return 'transferencia';
  return 'otro';
}
function normalizeAddress(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}
//CUSTOMERS
const CUSTOMERS_COLL = 'customers';
export async function upsertCustomerFromOrder({
  address,
  phone,
  name,
  total = 0,
  businessDate,
  sign = +1,
}) {
  const addrRaw = String(address || '').trim();
  if (!addrRaw) {
    console.warn('[customers] address vacío, no upsert');
    return null;
  }

  const addressNorm = normalizeAddress(addrRaw);
  const coll = pb.collection(CUSTOMERS_COLL);

  let c = null;
  try {
    // IMPORTANTE: asegurá que el campo addressNorm exista en la colección
    c = await coll.getFirstListItem(`addressNorm = "${addressNorm}"`);
  } catch (e) {
    if (e?.status !== 404) {
      console.error('[customers] getFirstListItem error:', e?.status, e?.data || e);
      throw e; // que se vea en consola
    }
  }

  try {
    if (!c && sign < 0) {
      console.warn('[customers] restar cliente inexistente, noop:', addressNorm);
      return null;
    }

    if (!c) {
      const payload = {
        name: name || null,
        phone: phone || null,
        address: addrRaw, // guardo tal cual lo escribió el usuario
        addressNorm, // normalizado (TEXT, UNIQUE)
        ordersCount: 1,
        totalSpent: safeNumber(total),
        firstOrderDate: businessDate,
        lastOrderDate: businessDate,
      };
      const created = await coll.create(payload, { $autoCancel: false });
      console.log('[customers] creado:', created?.id, payload);
      return created;
    } else {
      const payload = {
        name: c.name ?? name ?? null,
        phone: c.phone ?? phone ?? null,
        address: addrRaw, // última address usada
        ordersCount: clamp0(safeNumber(c.ordersCount) + 1 * sign),
        totalSpent: clamp0(safeNumber(c.totalSpent) + safeNumber(total) * sign),
        lastOrderDate: businessDate,
      };
      const updated = await coll.update(c.id, payload, { $autoCancel: false });
      console.log('[customers] actualizado:', c.id, payload);
      return updated;
    }
  } catch (e) {
    console.error('[customers] create/update error:', e?.status, e?.data || e);
    throw e;
  }
}

export function detectFulfillment(direccion, checkFlag = null) {
  // Si ya traés el flag desde tu UI:
  if (checkFlag === true) return { mode: 'retiro', address: null };
  if (checkFlag === false) {
    const addr = extractAddress(direccion);
    return { mode: addr ? 'delivery' : 'retiro', address: addr };
  }

  // Objeto de dirección (ej: {calle, numero, piso, dpto, barrio})
  if (direccion && typeof direccion === 'object') {
    const addr = buildAddressFromObj(direccion);
    return { mode: addr ? 'delivery' : 'retiro', address: addr };
  }

  // String
  const raw = String(direccion ?? '').trim();
  const s = raw.toLowerCase();

  const pickupKeywords = [
    'retiro',
    'retira',
    'retirar',
    'pickup',
    'pick up',
    'take away',
    'takeaway',
    'local',
    'en local',
    'mostrador',
    'paso',
    'pasa',
    'voy',
  ];
  const isPickup = pickupKeywords.some((k) => s === k || s.startsWith(k));

  if (!raw || isPickup) return { mode: 'retiro', address: null };
  return { mode: 'delivery', address: raw };
}

/** Construye una dirección legible desde objeto */
function buildAddressFromObj(o = {}) {
  if (!o || typeof o !== 'object') return '';
  const parts = [
    o.calle ?? o.street ?? '',
    o.numero ?? o.number ?? '',
    o.piso ? `Piso ${o.piso}` : '',
    o.dpto ?? o.depto ?? o.departamento ?? '',
    o.barrio ?? '',
    o.localidad ?? o.ciudad ?? '',
  ]
    .map((x) => String(x).trim())
    .filter(Boolean);
  return parts.join(' ');
}

/** Extrae una dirección de cualquier forma */
function extractAddress(v) {
  if (!v) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'object') return buildAddressFromObj(v);
  return '';
}
