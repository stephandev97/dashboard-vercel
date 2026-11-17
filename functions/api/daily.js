import PocketBase from "pocketbase";
import { getDailyStatRecordSmart } from "../../stats.js";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const dateKey =
      url.searchParams.get("day") || new Date().toISOString().slice(0, 10);
    const requestedPage = Number.parseInt(url.searchParams.get("ordersPage") || "1", 10);
    const ordersPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const ordersPerPage = 10;

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
    let ordersPagination = { page: ordersPage, totalPages: 1, totalItems: 0 };
    let transferTotals = { delivery: 0, retiro: 0 };
    try {
      const filter = `businessDate = "${dateKey}"`;
      const ordersResult = await pb
        .collection("orders")
        .getList(ordersPage, ordersPerPage, { filter, sort: "-created" });
      orders_detail = ordersResult.items;
      ordersPagination = {
        page: ordersResult.page,
        totalPages: ordersResult.totalPages,
        totalItems: ordersResult.totalItems,
      };

      // El modal de transferencias muestra totales diarios, no solo los 10
      // registros visibles. Pedimos únicamente los campos necesarios.
      const paymentRecords = await pb.collection("orders").getFullList({
        filter,
        fields: "pagoMp,transferencia,mp,mode,modo,orderMode",
      });
      for (const order of paymentRecords) {
        const amount = Number(order.pagoMp ?? order.transferencia ?? order.mp ?? 0) || 0;
        if (amount <= 0) continue;
        const mode = String(order.mode ?? order.modo ?? order.orderMode ?? "").toLowerCase();
        if (mode.includes("retiro")) transferTotals.retiro += amount;
        else if (mode.includes("delivery")) transferTotals.delivery += amount;
      }
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
        ordersPagination,
        transferTotals,
      }),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "*",
        },
      }
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
      ordersPagination: { page: 1, totalPages: 1, totalItems: 0 },
      transferTotals: { delivery: 0, retiro: 0 },
      error: "fallback",
      details: e?.message ?? String(e),
    };
    return new Response(JSON.stringify(fallback), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
      },
    });
  }
}
