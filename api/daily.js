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
      // --- LÓGICA DEFINITIVA USANDO EL CAMPO "hora" ---

      // 1. Calculamos la fecha del día siguiente para el filtro.
      const currentDate = new Date(`${dateKey}T12:00:00.000Z`); // Usamos mediodía para evitar errores de zona horaria
      currentDate.setDate(currentDate.getDate() + 1);
      const nextDateKey = currentDate.toISOString().slice(0, 10);

      // 2. Construimos el filtro que combina dos rangos:
      //    - Parte A: Pedidos de HOY (dateKey) a partir de las 03:00 AM.
      const todayFilter = `(created ~ "${dateKey}" && hora >= "03:00")`;
      
      //    - Parte B: Pedidos de MAÑANA (nextDateKey) antes de las 03:00 AM.
      const tomorrowFilter = `(created ~ "${nextDateKey}" && hora < "03:00")`;

      // 3. Unimos las dos partes con un "OR" (||).
      //    Esto crea la ventana de 24hs desde las 3 AM de un día hasta las 3 AM del siguiente.
      const filter = `${todayFilter} || ${tomorrowFilter}`;

      orders_detail = await pb.collection('orders').getFullList({
        filter: filter,
        sort: 'created', // Ordenamos por el timestamp completo para verlos en orden cronológico
      });

    } catch (err) {
      console.warn(`No se pudieron obtener los detalles de pedidos para el día ${dateKey}:`, err);
    }

    // El resto del código no cambia
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