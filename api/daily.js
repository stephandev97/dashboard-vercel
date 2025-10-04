// api/daily.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

// Helper para formatear la fecha como lo espera PocketBase ('YYYY-MM-DD HH:mm:ss')
function toPbFilterDate(date) {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export default async function handler(req, res) {
  try {
    const dateKey = req.query?.day || new Date().toISOString().slice(0, 10);

    let dailyRecord = await getDailyStatRecordSmart({ dateKey });
    if (!dailyRecord) {
      dailyRecord = { day: dateKey, revenue: 0, ordersCount: 0, itemsCount: {} };
    }

    let orders_detail = [];
    try {
      // --- INICIO DE LA CORRECCIÓN FINAL DE ZONA HORARIA ---

      // 1. Creamos una fecha para el día seleccionado, asegurando que sea UTC.
      //    Ej: "2025-10-04" se convierte en 2025-10-04T00:00:00.000Z.
      const selectedDayUTC = new Date(`${dateKey}T00:00:00.000Z`);

      // 2. CORRECCIÓN: Para encontrar el inicio de tu día local (ART, UTC-3),
      //    debemos RESTAR 3 horas a la fecha del día siguiente en UTC.
      //    El día 4 de Octubre en Argentina comienza a las 21:00 UTC del 3 de Octubre.
      const startOfLocalDay_UTC = new Date(selectedDayUTC.getTime() - (3 * 60 * 60 * 1000));

      // 3. El fin del día local es 24 horas después del inicio.
      const endOfLocalDay_UTC = new Date(startOfLocalDay_UTC.getTime() + (24 * 60 * 60 * 1000));

      // 4. Construimos el filtro. Esto ahora buscará desde las 21:00 UTC de un día
      //    hasta las 21:00 UTC del día siguiente, cubriendo exactamente tu día local.
      const filter = `created >= "${toPbFilterDate(startOfLocalDay_UTC)}" && created < "${toPbFilterDate(endOfLocalDay_UTC)}"`;
      
      orders_detail = await pb.collection('orders').getFullList({
        filter: filter,
        sort: 'created',
      });
      // --- FIN DE LA CORRECCIÓN ---

    } catch (err) {
      console.warn(`No se pudieron obtener los detalles de pedidos para el día ${dateKey}:`, err);
    }

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