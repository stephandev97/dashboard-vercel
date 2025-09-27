import { getDailyStatRecordSmart } from '../stats.js';

export default async function handler(req, res) {
  try {
    const dateKey = req.query.day || new Date().toISOString().slice(0,10);

    let record = null;
    try {
      record = await getDailyStatRecordSmart({ dateKey });
    } catch (err) {
      console.error('Error leyendo daily_stats:', err);
      return res.status(500).json({ error: 'Error leyendo daily_stats', details: err.message, stack: err.stack });
    }

    if (!record) return res.status(404).json({ error: 'No hay datos para hoy' });

    res.status(200).json(record);
  } catch (e) {
    console.error('ERROR API GENERAL:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}