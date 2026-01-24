import PocketBase from "pocketbase";
import { getDailyStatRecordSmart } from "../../stats.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const dateKey =
      url.searchParams.get("day") || new Date().toISOString().slice(0, 10);

    const pb = new PocketBase(env.PB_URL);
    pb.autoCancellation(false);

    let dailyRecord = null;
    try {
      dailyRecord = await getDailyStatRecordSmart({ dateKey, pb });
    } catch {
      dailyRecord = null;
    }
    if (!dailyRecord) {
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

    let orders_detail = [];
    try {
      const filter = `businessDate = "${dateKey}"`;
      orders_detail = await pb
        .collection("orders")
        .getFullList({ filter, sort: "-created" });
    } catch (err) {
      // no rompemos por esto
    }

    const safe = (v) =>
      v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};
    const asNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    return new Response(
      JSON.stringify({
        day: dailyRecord.day,
        revenue: asNumber(dailyRecord.revenue),
        ordersCount: asNumber(dailyRecord.ordersCount),
        itemsCount: safe(dailyRecord.itemsCount),
        paidByMethod: safe(dailyRecord.paidByMethod),
        revenueByMethod: safe(dailyRecord.revenueByMethod),
        ordersByMethod: safe(dailyRecord.ordersByMethod),
        ordersByMode: safe(dailyRecord.ordersByMode),
        deliveryByAddress: safe(dailyRecord.deliveryByAddress),
        orders_detail,
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e) {
    const fallback = {
      day: new Date().toISOString().slice(0, 10),
      revenue: 0,
      ordersCount: 0,
      itemsCount: {},
      paidByMethod: {},
      revenueByMethod: {},
      ordersByMethod: {},
      ordersByMode: {},
      deliveryByAddress: {},
      orders_detail: [],
      error: "fallback",
      details: e?.message ?? String(e),
    };
    return new Response(JSON.stringify(fallback), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
