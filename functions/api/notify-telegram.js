export async function onRequestPost({ request, env }) {
  try {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return new Response(JSON.stringify({ ok: false, error: "missing_env" }), {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const { text } = await request.json().catch(() => ({ text: "" }));
    const payload = {
      chat_id: chatId,
      text: String(text || "").slice(0, 1900),
      parse_mode: "HTML",
    };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    const ok = res.ok;
    return new Response(JSON.stringify({ ok, body }), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: ok ? 200 : 500,
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e?.message ?? String(e) }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
}
