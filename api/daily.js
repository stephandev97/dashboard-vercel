// api/daily.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

// Helper para formatear la fecha como lo espera PocketBase ('YYYY-MM-DD HH:mm:ss')
function toPbFilterDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export default async function handler(req, res) {
  try {
    // Es crucial que el cliente siempre envíe la fecha.
    const dateKey = req.query?.day;
    if (!dateKey) {
      // Usamos una fecha local del servidor como fallback, pero lo ideal es que el cliente la envíe.
      const now = new Date();
      const offset = -3; // ART is UTC-3
      const localNow = new Date(now.getTime() + offset * 3600 * 1000);
      dateKey = localNow.toISOString().slice(0, 10);
    }

    // --- Buscamos el registro de estadísticas diarias (sin cambios) ---
    let dailyRecord = await getDailyStatRecordSmart({ dateKey });

    if (!dailyRecord) {
      dailyRecord = { day: dateKey, revenue: 0, ordersCount: 0, itemsCount: {} };
    }

    // --- INICIO DE LA CORRECCIÓN DE ZONA HORARIA ---
    let orders_detail = [];
    try {
      // 1. Creamos un objeto de fecha basado en el día seleccionado (ej: "2025-10-04").
      //    JavaScript lo interpretará como el inicio del día en UTC (T00:00:00.000Z).
      const selectedDate = new Date(dateKey);

      // 2. Ajustamos la zona horaria. Para obtener el inicio del día en Argentina (UTC-3),
      //    sumamos 3 horas a la fecha UTC.
      const startOfLocalDay_UTC = new Date(selectedDate.getTime() + (3 * 60 * 60 * 1000));

      // 3. El fin del día local es 24 horas después del inicio.
      const endOfLocalDay_UTC = new Date(startOfLocalDay_UTC.getTime() + (24 * 60 * 60 * 1000));

      // 4. Construimos el filtro para la base de datos.
      const filter = `created >= "${toPbFilterDate(startOfLocalDay_UTC)}" && created < "${toPbFilterDate(endOfLocalDay_UTC)}"`;

      orders_detail = await pb.collection('orders').getFullList({
        filter: filter,
        sort: 'created',
      });
    } catch (err) {
      console.warn(`No se pudieron obtener los detalles de pedidos para el día ${dateKey}:`, err);
    }
    // --- FIN DE LA CORRECCIÓN ---

    const safe = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {});
    const asNumber = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

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
      orders_detail: orders_detail,
    });

  } catch (e) {
    console.error("ERROR API GENERAL:", e);
    return res.status(500).json({ error: "Error interno en la API", details: e?.message ?? String(e) });
  }
}