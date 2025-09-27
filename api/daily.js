// api/daily.js (debug — reemplazar temporalmente)
import { getDailyStatRecordSmart } from "../stats.js";
import { pb } from "../lib/pb.js";

export default async function handler(req, res) {
  try {
    // Mostrar info básica
    console.log("API /api/daily invoked. NODE env:", process.env.NODE_ENV);
    console.log("PB_URL env:", !!process.env.PB_URL);

    const dateKey = req.query?.day || new Date().toISOString().slice(0, 10);
    console.log("dateKey ->", dateKey);

    // Test básico: intentar listar 1 item para comprobar conexión con PocketBase
    try {
      console.log("Probando conexión PocketBase -> intentando listar 1 registro de daily_stats...");
      // getList en vez de getFirstListItem para capturar mejor el error
      const testList = await pb.collection("daily_stats").getList(1, 1, { filter: `day="${dateKey}"` });
      console.log("PocketBase testList OK:", Array.isArray(testList.items) ? testList.items.length : typeof testList);
    } catch (connErr) {
      console.error("FALLA CONEXIÓN POCKETBASE:", connErr);
      return res.status(502).json({
        error: "Falla conectando a PocketBase",
        message: connErr?.message ?? String(connErr),
        stack: connErr?.stack?.slice?.(0, 2000),
        pbUrl: process.env.PB_URL ?? null
      });
    }

    // Llamada normal
    let record;
    try {
      record = await getDailyStatRecordSmart({ dateKey });
    } catch (err) {
      console.error("Error getDailyStatRecordSmart:", err);
      return res.status(500).json({
        error: "Error al leer daily_stats",
        message: err?.message ?? String(err),
        stack: err?.stack?.slice?.(0, 2000)
      });
    }

    if (!record) return res.status(404).json({ error: "No hay datos para este día", day: dateKey });

    return res.status(200).json({
      day: record.day,
      revenue: Number(record.revenue || 0),
      ordersCount: Number(record.ordersCount || 0),
      itemsCount: record.itemsCount || {},
    });
  } catch (e) {
    console.error("ERROR API GENERAL:", e);
    return res.status(500).json({ error: "Error interno", message: e?.message ?? String(e), stack: e?.stack?.slice?.(0,2000) });
  }
}