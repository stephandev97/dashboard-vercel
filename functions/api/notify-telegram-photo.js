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
    const inForm = await request.formData();
    const photo = inForm.get("photo");
    const caption = String(inForm.get("caption") || "");
    if (!photo) {
      return new Response(JSON.stringify({ ok: false, error: "no_photo" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
    const outForm = new FormData();
    outForm.append("chat_id", chatId);
    outForm.append("photo", photo, "pedido.png");
    if (caption) outForm.append("caption", caption);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: outForm,
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
