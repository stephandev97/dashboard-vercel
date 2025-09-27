import { getDailyStatRecordSmart } from '../../stats.js';
import { pb } from '../../lib/pb.js';

export default async function handler(req, res) {
  try {
    // 1️⃣ Día que queremos mostrar
    const dateKey = req.query.day || new Date().toISOString().slice(0, 10);

    // 2️⃣ Intentamos leer el registro
    let record = null;
    try {
      record = await getDailyStatRecordSmart({ dateKey });
    } catch (err) {
      console.error('Error leyendo daily_stats:', err);
      return res.status(500).json({ error: 'Error leyendo daily_stats', details: err.message });
    }

    if (!record) {
      return res.status(404).json({ error: 'No hay datos para hoy' });
    }

    // 3️⃣ Devuelve JSON limpio
    res.status(200).json({
      day: record.day,
      revenue: Number(record.revenue || 0),
      ordersCount: Number(record.ordersCount || 0),
      itemsCount: record.itemsCount || {},
      revenueByMethod: record.revenueByMethod || {},
      ordersByMethod: record.ordersByMethod || {},
      ordersByMode: record.ordersByMode || {},
      deliveryByAddress: record.deliveryByAddress || {},
    });
  } catch (e) {
    console.error('ERROR API GENERAL:', e);
    res.status(500).json({ error: 'Error interno en la API', details: e.message });
  }
}