// api/daily.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

export default async function handler(req, res) {
  try {
    const dateKey = req.query?.day || new Date().toISOString().slice(0, 10);

    // --- Buscamos el registro de estadísticas diarias (sin cambios) ---
    let dailyRecord;
    try {
      dailyRecord = await getDailyStatRecordSmart({ dateKey });
    } catch (err) {
      console.error("Error getDailyStatRecordSmart:", err);
      return res.status(500).json({
        error: "Error al leer daily_stats",
        details: err?.message ?? String(err),
      });
    }

    if (!dailyRecord) {
      return res.status(404).json({ error: "No hay datos para este día", day: dateKey });
    }

    // --- NUEVO: Buscar la lista de pedidos detallados para ese día ---
    let orders_detail = [];
    try {
      // Formateamos las fechas para cubrir el día completo (de 00:00:00 a 23:59:59)
      const startOfDay = `${dateKey} 00:00:00.000Z`;
      const endOfDay = `${dateKey} 23:59:59.999Z`;
      
      // Asumimos que la colección se llama 'orders' y filtramos por el campo 'created'
      // Ordenamos por fecha de creación para verlos en orden cronológico
      orders_detail = await pb.collection('orders').getFullList({
        filter: `created >= "${startOfDay}" && created <= "${endOfDay}"`,
        sort: 'created', // Ordena los pedidos del más antiguo al más reciente
      });
    } catch (err) {
      console.warn(`No se pudieron obtener los detalles de pedidos para el día ${dateKey}:`, err);
      // No devolvemos un error, simplemente la lista de pedidos estará vacía
    }

    // --- Normalizamos los datos (sin cambios) ---
    const safe = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {});
    const asNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    // --- Devolvemos la respuesta combinada ---
    return res.status(200).json({
      day: dailyRecord.day,
      revenue: asNumber(dailyRecord.revenue),
      ordersCount: asNumber(dailyRecord.ordersCount),
      itemsCount: safe(dailyRecord.itemsCount),
      paidByMethod: safe(dailyRecord.paidByMethod),
      revenueByMethod: safe(dailyRecord.revenueByMethod),
      ordersByMethod: safe(dailyRecord.ordersByMethod),
      ordersByMode: safe(dailyRecord.ordersByMode),
      deliveryByAddress: safe(dailyRecord.deliveryByAddress),
      orders_detail: orders_detail, // <-- NUEVO: Agregamos la lista de pedidos
    });

  } catch (e) {
    console.error("ERROR API GENERAL:", e);
    return res.status(500).json({ error: "Error interno en la API", details: e?.message ?? String(e) });
  }
}