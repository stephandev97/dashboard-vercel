import PocketBase from "pocketbase";

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month"); // formato: YYYY-MM

    let targetDate;
    if (monthParam) {
      targetDate = new Date(monthParam + "-01");
    } else {
      targetDate = new Date();
      if (targetDate.getDate() < 3) {
        targetDate.setMonth(targetDate.getMonth() - 1);
      }
      targetDate.setDate(1);
    }

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;
    const monthStr = String(month).padStart(2, "0");
    const monthKey = `${year}-${monthStr}`;

    const pb = new PocketBase(env.PB_URL);
    pb.autoCancellation(false);

    const firstDay = `${monthKey}-01`;
    const lastDayObj = new Date(year, month, 0);
    const lastDay = `${monthKey}-${String(lastDayObj.getDate()).padStart(2, "0")}`;

    let allOrders = [];
    try {
      const filter = `businessDate >= "${firstDay}" && businessDate <= "${lastDay}"`;
      allOrders = await pb.collection("orders").getFullList({ filter, sort: "created" });
    } catch (e) {
      allOrders = [];
    }

    const getOrderTotal = (order) => {
      const keys = ["total", "pago", "pago_total", "montoTotal", "monto_total", "totalAmount", "importe", "price", "precio"];
      for (const k of keys) {
        if (order[k] !== undefined && order[k] !== null) {
          const v = order[k];
          if (typeof v === "number" && !Number.isNaN(v)) return v;
          if (typeof v === "string") {
            const cleaned = v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(/,/g, ".");
            const n = Number(cleaned);
            if (!Number.isNaN(n)) return n;
          }
        }
      }
      return 0;
    };

    // Horas del negocio: 12 a 02 (considerando que 00-02 es el día siguiente en horario local argentino)
    // Definimos 14 slots: 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 00, 01
    const hourSlots = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1];
    const hourlyStats = {};
    
    for (const hour of hourSlots) {
      const label = hour === 0 ? "00" : String(hour).padStart(2, "0");
      hourlyStats[hour] = { orders: 0, revenue: 0, label: `${label}:00` };
    }

    const TIMEZONE_OFFSET = -3; // Servidor UTC, Argentina UTC-3

    for (const order of allOrders) {
      const serverDate = new Date(order.created);
      // Convertir hora del servidor a hora local argentina restando el offset
      const localHour = serverDate.getHours() + TIMEZONE_OFFSET;
      
      // Normalizar hora (si es negativo, sumar 24 y ajustar al día anterior si es necesario)
      let adjustedHour = localHour;
      if (adjustedHour < 0) adjustedHour += 24;
      
      if (hourlyStats[adjustedHour] !== undefined) {
        hourlyStats[adjustedHour].orders += 1;
        hourlyStats[adjustedHour].revenue += getOrderTotal(order);
      }
    }

    // Convertir a array ordenado
    const result = hourSlots.map(hour => ({
      hour,
      label: hourlyStats[hour].label,
      orders: hourlyStats[hour].orders,
      revenue: Math.round(hourlyStats[hour].revenue)
    }));

    // Totales
    const totalOrders = result.reduce((sum, h) => sum + h.orders, 0);
    const totalRevenue = result.reduce((sum, h) => sum + h.revenue, 0);

    // Meses para comparar
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const prevFirstDay = `${prevMonthStr}-01`;
    const prevLastDayObj = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0);
    const prevLastDay = `${prevMonthStr}-${String(prevLastDayObj.getDate()).padStart(2, "0")}`;

    let prevMonthOrders = 0;
    let prevMonthRevenue = 0;

    try {
      const filter = `businessDate >= "${prevFirstDay}" && businessDate <= "${prevLastDay}"`;
      const prevOrders = await pb.collection("orders").getFullList({ filter });
      prevMonthOrders = prevOrders.length;
      for (const order of prevOrders) {
        prevMonthRevenue += getOrderTotal(order);
      }
      prevMonthRevenue = Math.round(prevMonthRevenue);
    } catch (e) {
      // ignore
    }

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthName = monthNames[month - 1];

    return new Response(
      JSON.stringify({
        month: monthKey,
        monthName: `${monthName} ${year}`,
        totalOrders,
        totalRevenue,
        hourlyData: result,
        prevMonthOrders,
        prevMonthRevenue,
        ordersGrowth: prevMonthOrders > 0 ? Math.round(((totalOrders - prevMonthOrders) / prevMonthOrders) * 100) : 0,
        revenueGrowth: prevMonthRevenue > 0 ? Math.round(((totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : 0,
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: true,
        details: e?.message ?? String(e),
      }),
      { headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
}
