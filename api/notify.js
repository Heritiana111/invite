// Vercel serverless function: forwards her answer to your Telegram.
// The bot token and your chat id live in Vercel environment variables, never in the page.
//   TELEGRAM_BOT_TOKEN  the token BotFather gave you
//   TELEGRAM_CHAT_ID    your own chat id with the bot

const MAX = { name: 40, where: 120, when: 120, note: 400 };

// Single line, no control characters, capped length.
function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .trim()
    .slice(0, max);
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Browsers always send Origin on a POST. Accept only calls from this site's own pages.
  const origin = req.headers.origin;
  let sameSite = false;
  try {
    sameSite = !!origin && new URL(origin).host === req.headers.host;
  } catch (e) {
    sameSite = false;
  }
  if (!sameSite) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(500).json({ ok: false, error: "not_configured" });
  }

  const body = readBody(req);
  const name = clean(body.name, MAX.name);
  const where = clean(body.where, MAX.where);
  const when = clean(body.when, MAX.when);
  const note = clean(body.note, MAX.note);
  if (!where || !when) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  const lines = [
    "💌 " + (name || "She") + " said yes!",
    "",
    "Where: " + where,
    "When: " + when
  ];
  if (note) lines.push("Note: " + note);

  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        disable_web_page_preview: true
      })
    });
    if (!r.ok) {
      console.error("telegram status", r.status);
      return res.status(502).json({ ok: false, error: "telegram_error" });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("telegram request failed");
    return res.status(502).json({ ok: false, error: "telegram_unreachable" });
  }
};
