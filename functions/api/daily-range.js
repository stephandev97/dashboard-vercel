import PocketBase from "pocketbase";
import { getDailyStatRecordSmart } from "../../stats.js";

function formatDay(d) {
  return d.toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const days = Math.min(30, Number(url.searchParams.get("days") || 7));

    const pb = new PocketBase(env.PB_URL);
    pb.autoCancellation(false);

    const end = new Date();
    const out = [];

    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(end);
      dt.setDate(end.getDate() - i);
      const key = formatDay(dt);

      try {
        const rec = await getDailyStatRecordSmart({ dateKey: key, pb });
        out.push({
          day: key,
          revenue: rec ? Number(rec.revenue || 0) : 0,
          ordersCount: rec ? Number(rec.ordersCount || 0) : 0,
          revenueByMethod: rec ? rec.revenueByMethod || {} : {},
          ordersByMethod: rec ? rec.ordersByMethod || {} : {},
        });
      } catch {
        out.push({
          day: key,
          revenue: 0,
          ordersCount: 0,
          revenueByMethod: {},
          ordersByMethod: {},
        });
      }
    }

    return new Response(JSON.stringify(out), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
