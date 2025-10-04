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
    } catch (err)
    {
      console.error("Error getDailyStatRecordSmart:", err);
      return res.status(500).json({
        error: "Error al leer daily_stats",
        details: err?.message ?? String(err),
      });
    }

    if (!dailyRecord) {
      // Si no hay estadísticas, igual intentamos buscar pedidos por si acaso.
      // Devolvemos un objeto base para que no falle el frontend.
      dailyRecord = {
        day: dateKey,
        revenue: 0,
        ordersCount: 0,
        itemsCount: {},
        paidByMethod: {},
        revenueByMethod: {},
        ordersByMethod: {},
        ordersByMode: {},
        deliveryByAddress: {},
      };
    }

    // --- Buscar la lista de pedidos detallados para ese día ---
    let orders_detail = [];
    try {
      // --- INICIO DE LA CORRECCIÓN ---
      // Filtramos usando el operador LIKE (`~`) para que coincida con cualquier
      // registro cuya fecha de creación COMIENCE con la fecha seleccionada (ej: "2023-10-26").
      // Esto ignora la parte de la hora y la zona horaria, solucionando el problema.
      orders_detail = await pb.collection('orders').getFullList({
        filter: `created ~ "${dateKey}"`, // Esta es la línea corregida
        sort: 'created',
      });
      // --- FIN DE LA CORRECCIÓN ---
    } catch (err) {
      console.warn(`No se pudieron obtener los detalles de pedidos para el día ${dateKey}:`, err);
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
      orders_detail: orders_detail, // Agregamos la lista de pedidos
    });

  } catch (e) {
    console.error("ERROR API GENERAL:", e);
    return res.status(500).json({ error: "Error interno en la API", details: e?.message ?? String(e) });
  }
}