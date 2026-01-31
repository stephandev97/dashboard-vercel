import { onRequestGet as __api_daily_js_onRequestGet } from "C:\\stephandev\\dashboard-vercel\\functions\\api\\daily.js"
import { onRequestGet as __api_daily_range_js_onRequestGet } from "C:\\stephandev\\dashboard-vercel\\functions\\api\\daily-range.js"

export const routes = [
    {
      routePath: "/api/daily",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_daily_js_onRequestGet],
    },
  {
      routePath: "/api/daily-range",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_daily_range_js_onRequestGet],
    },
  ]