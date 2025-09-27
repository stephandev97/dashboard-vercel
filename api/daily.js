// api/daily.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

export default async function handler(req, res) {
  try {
    const dateKey = req.query?.day || new Date().toISOString().slice(0, 10);

    let record;
    try {
      record = await getDailyStatRecordSmart({ dateKey });
    } catch (err) {
      console.error("Error getDailyStatRecordSmart:", err);
      return res.status(500).json({
        error: "Error al leer daily_stats",
        details: err?.message ?? String(err),
      });
    }

    if (!record) {
      return res.status(404).json({ error: "No hay datos para este día", day: dateKey });
    }

    // Normalizamos y garantizamos objetos
    const safe = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {});
    const asNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    return res.status(200).json({
      day: record.day,
      revenue: asNumber(record.revenue),
      ordersCount: asNumber(record.ordersCount),
      itemsCount: safe(record.itemsCount),
      paidByMethod: safe(record.paidByMethod),
      revenueByMethod: safe(record.revenueByMethod),
      ordersByMethod: safe(record.ordersByMethod),
      ordersByMode: safe(record.ordersByMode),
      deliveryByAddress: safe(record.deliveryByAddress),
    });
  } catch (e) {
    console.error("ERROR API GENERAL:", e);
    return res.status(500).json({ error: "Error interno en la API", details: e?.message ?? String(e) });
  }
}
