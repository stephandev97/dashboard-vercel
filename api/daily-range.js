// api/daily-range.js (ESM)
import { getDailyStatRecordSmart } from "../stats.js";

function formatDay(d) {
  return d.toISOString().slice(0,10);
}

export default async function handler(req, res) {
  try {
    const days = Math.min(30, Number(req.query.days || 7)); // cap 30
    const end = new Date();
    const out = [];

    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(end);
      dt.setDate(end.getDate() - i);
      const key = formatDay(dt);
      try {
        const rec = await getDailyStatRecordSmart({ dateKey: key });
        out.push({
          day: key,
          revenue: rec ? Number(rec.revenue || 0) : 0,
          ordersCount: rec ? Number(rec.ordersCount || 0) : 0,
          itemsCount: rec ? rec.itemsCount || {} : {},
        });
      } catch (err) {
        // en caso de error puntual, empujamos 0 para que no rompa todo
        out.push({ day: key, revenue: 0, ordersCount: 0, itemsCount: {} });
      }
    }

    res.status(200).json(out);
  } catch (e) {
    console.error("ERROR /api/daily-range:", e);
    res.status(500).json({ error: e?.message ?? String(e) });
  }
}
