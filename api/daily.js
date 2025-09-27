import { getDailyStatRecordSmart } from '../../stats.js';
import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.PB_URL);

// Si tu PB requiere admin auth:
await pb.admins.authWithPassword(
  process.env.PB_ADMIN_EMAIL,
  process.env.PB_ADMIN_PASS
);

export default async function handler(req, res) {
  try {
    const dateKey = req.query.day || new Date().toISOString().slice(0, 10);
    const record = await getDailyStatRecordSmart({ dateKey });

    if (!record) return res.status(404).json({ error: 'No hay datos para hoy' });

    res.status(200).json(record);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener datos' });
  }
}