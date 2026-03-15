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

    // Obtener primer y último día del mes
    const firstDay = `${monthKey}-01`;
    const lastDayObj = new Date(year, month, 0);
    const lastDay = `${monthKey}-${String(lastDayObj.getDate()).padStart(2, "0")}`;

    // Fetchear todos los daily_stats del mes
    let dailyStats = [];
    try {
      const filter = `day >= "${firstDay}" && day <= "${lastDay}"`;
      dailyStats = await pb.collection("daily_stats").getFullList({ filter });
    } catch (e) {
      dailyStats = [];
    }

    const asNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const safe = (v) => (v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {});

    // Calcular métricas
    let totalRevenue = 0;
    let totalOrders = 0;
    let bestDayOrders = { day: "", count: 0 };
    let bestDayRevenue = { day: "", revenue: 0 };
    let itemsCount = {};
    let paidByMethod = { efectivo: 0, transferencia: 0, debito: 0 };

    for (const stat of dailyStats) {
      totalRevenue += asNumber(stat.revenue);
      totalOrders += asNumber(stat.ordersCount);

      const dayRevenue = asNumber(stat.revenue);
      const dayOrders = asNumber(stat.ordersCount);

      if (dayOrders > bestDayOrders.count) {
        bestDayOrders = { day: stat.day, count: dayOrders };
      }
      if (dayRevenue > bestDayRevenue.revenue) {
        bestDayRevenue = { day: stat.day, revenue: dayRevenue };
      }

      // Agregar itemsCount
      const statItems = safe(stat.itemsCount);
      for (const [name, qty] of Object.entries(statItems)) {
        itemsCount[name] = (itemsCount[name] || 0) + asNumber(qty);
      }

      // Agregar paidByMethod
      const statPayments = safe(stat.paidByMethod);
      paidByMethod.efectivo += asNumber(statPayments.efectivo);
      paidByMethod.transferencia += asNumber(statPayments.transferencia);
      paidByMethod.debito += asNumber(statPayments.debito);
    }

    // Top productos
    const topProducts = Object.entries(itemsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, qty]) => ({ name, qty }));

    // Promedios
    const daysWithData = dailyStats.length;
    const avgRevenue = daysWithData > 0 ? Math.round(totalRevenue / daysWithData) : 0;
    const avgOrders = daysWithData > 0 ? Math.round((totalOrders / daysWithData) * 10) / 10 : 0;
    const ticketPromedio = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Total métodos de pago
    const totalPayments = paidByMethod.efectivo + paidByMethod.transferencia + paidByMethod.debito;
    const pctEfectivo = totalPayments > 0 ? Math.round((paidByMethod.efectivo / totalPayments) * 100) : 0;
    const pctTransfer = totalPayments > 0 ? Math.round((paidByMethod.transferencia / totalPayments) * 100) : 0;
    const pctDebito = totalPayments > 0 ? Math.round((paidByMethod.debito / totalPayments) * 100) : 0;

    // Mes anterior para comparar (mismos días del mes)
    let prevMonthRevenue = 0;
    let prevMonthOrders = 0;
    const prevMonthDate = new Date(year, month - 2, 1);
    const prevFirstDay = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
    
    // Si es mes actual, usar el día de hoy; si no, usar el último día del mes
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const compareDay = isCurrentMonth ? Math.min(today.getDate(), lastDayOfMonth) : lastDayOfMonth;
    const prevLastDay = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-${String(compareDay).padStart(2, "0")}`;

    try {
      const prevFilter = `day >= "${prevFirstDay}" && day <= "${prevLastDay}"`;
      const prevStats = await pb.collection("daily_stats").getFullList({ filter: prevFilter });
      for (const stat of prevStats) {
        prevMonthRevenue += asNumber(stat.revenue);
        prevMonthOrders += asNumber(stat.ordersCount);
      }
    } catch (e) {
      // ignore
    }

    const revGrowth = prevMonthRevenue > 0 
      ? Math.round(((totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) 
      : 0;
    const ordersGrowth = prevMonthOrders > 0 
      ? Math.round(((totalOrders - prevMonthOrders) / prevMonthOrders) * 100) 
      : 0;

    // Nombre del mes en español
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthName = monthNames[month - 1];

    return new Response(
      JSON.stringify({
        month: monthKey,
        monthName: `${monthName} ${year}`,
        totalRevenue,
        totalOrders,
        bestDayOrders,
        bestDayRevenue,
        topProducts,
        avgRevenue,
        avgOrders,
        ticketPromedio,
        paidByMethod,
        paymentPct: { efectivo: pctEfectivo, transferencia: pctTransfer, debito: pctDebito },
        prevMonthRevenue,
        prevMonthOrders,
        revGrowth,
        ordersGrowth,
        daysWithData,
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
