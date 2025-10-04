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
      // --- LÓGICA FINAL Y SIMPLIFICADA USANDO "businessDate" ---
      // Filtramos directamente donde el campo businessDate coincida con la fecha seleccionada.
      const filter = `businessDate = "${dateKey}"`;

      orders_detail = await pb.collection('orders').getFullList({
        filter: filter,
        sort: 'created', // Los ordenamos por fecha de creación para verlos en orden
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