// api/daily.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

export default async function handler(req, res) {
  try {
    const dateKey = req.query?.day || new Date().toISOString().slice(0, 10);

    let dailyRecord = await getDailyStatRecordSmart({ dateKey });
    if (!dailyRecord) {
      // Si no hay registro, creamos uno por defecto vacío
      dailyRecord = {
        day: dateKey,
        revenue: 0,
        ordersCount: 0,
        itemsCount: {},
        paidByMethod: {},
        revenueByMethod: {},
        ordersByMethod: {},
        ordersByMode: {}, // Es importante tener el valor por defecto
        deliveryByAddress: {},
      };
    }

    // La obtención de la lista de pedidos detallados sigue igual
    let orders_detail = [];
    try {
      const filter = `businessDate = "${dateKey}"`;
      orders_detail = await pb.collection('orders').getFullList({
        filter: filter,
        sort: '-created',
      });
    } catch (err) {
      console.warn(`No se pudieron obtener los detalles de pedidos para el día ${dateKey}:`, err);
    }

    // Funciones helper
    const safe = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {});
    const asNumber = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

    // Simplemente devolvemos los campos del registro, incluyendo ordersByMode
    return res.status(200).json({
      day: dailyRecord.day,
      revenue: asNumber(dailyRecord.revenue),
      ordersCount: asNumber(dailyRecord.ordersCount),
      itemsCount: safe(dailyRecord.itemsCount),
      paidByMethod: safe(dailyRecord.paidByMethod),
      revenueByMethod: safe(dailyRecord.revenueByMethod),
      ordersByMethod: safe(dailyRecord.ordersByMethod),
      ordersByMode: safe(dailyRecord.ordersByMode), // Aquí está el campo clave
      deliveryByAddress: safe(dailyRecord.deliveryByAddress),
      orders_detail: orders_detail,
    });

  } catch (e) {
    console.error("ERROR API GENERAL:", e);
    return res.status(500).json({ error: "Error interno en la API", details: e?.message ?? String(e) });
  }
}