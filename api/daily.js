// api/daily.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

export default async function handler(req, res) {
  try {
    const dateKey = req.query?.day || new Date().toISOString().slice(0, 10);

    let dailyRecord = await getDailyStatRecordSmart({ dateKey });
    if (!dailyRecord) {
      dailyRecord = { day: dateKey, revenue: 0, ordersCount: 0, itemsCount: {} };
    }

    let orders_detail = [];
    try {
      // --- LÓGICA DE ZONA HORARIA DEFINITIVA ---

      // 1. El inicio de tu día local (ej: 4 de Octubre 00:00 ART) es a las 03:00 UTC.
      //    Construimos el string de la fecha de inicio para la consulta.
      const startRange = `${dateKey} 03:00:00`;

      // 2. Para calcular el día siguiente de forma segura, creamos un objeto Date
      //    y le sumamos un día.
      const startDate = new Date(`${dateKey}T00:00:00.000Z`);
      startDate.setDate(startDate.getDate() + 1);
      const nextDateKey = startDate.toISOString().slice(0, 10);

      // 3. El fin del rango es a las 03:00 UTC del día siguiente.
      const endRange = `${nextDateKey} 03:00:00`;

      // 4. El filtro final. Para el 4 de Octubre, esto será:
      //    created >= "2025-10-04 03:00:00" && created < "2025-10-05 03:00:00"
      //    Este es el rango exacto que necesitas.
      const filter = `created >= "${startRange}" && created < "${endRange}"`;
      
      orders_detail = await pb.collection('orders').getFullList({
        filter: filter,
        sort: 'created',
      });

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