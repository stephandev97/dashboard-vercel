import { getDailyStatRecordSmart } from '../stats.js';

export default async function handler(req, res) {
  try {
    const dateKey = req.query.day || new Date().toISOString().slice(0,10);
    const record = await getDailyStatRecordSmart({ dateKey });

    if (!record) return res.status(404).json({ error: 'No hay datos para hoy' });

    res.status(200).json(record);
  } catch (e) {
    console.error('ERROR API:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
}