import { bootstrap } from "@mercuryworkshop/proxy-bootstrap";
import http from "node:http";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");

const PORT = process.env.PORT || 3030;

// Downloads the prebuilt Scramjet runtime from npm at startup, then gives us
// the route handlers for /sw.js, /bootstrap-init.js, /scram/*, /controller/*,
// /clients/* and the /wisp/ WebSocket endpoint.
let routeRequest = () => false;
let routeUpgrade = () => false;
try {
  ({ routeRequest, routeUpgrade } = await bootstrap());
  console.log("Scramjet runtime ready");
} catch (err) {
  // Keep the site and AI chat up even if the runtime download failed.
  console.error("Scramjet bootstrap FAILED (proxy will not work):", err);
}

const app = express();
app.disable("x-powered-by");

// 1) Scramjet runtime routes
app.use((req, res, next) => {
  if (routeRequest(req, res)) return;
  next();
});

// 2) ESOK AI chat (same behaviour as the old Netlify function)
app.post("/api/chat", express.json({ limit: "64kb" }), async (req, res) => {
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
    return res.status(400).json({ error: "Send between 1 and 40 chat messages." });
  }
  const clean = [];
  for (const m of messages) {
    if (!m || !["user", "assistant"].includes(m.role) ||
        typeof m.content !== "string" || !m.content.trim() || m.content.length > 4000) {
      return res.status(400).json({ error: "A chat message is invalid or too long." });
    }
    clean.push({ role: m.role, content: m.content.trim() });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
  if (!apiKey) {
    return res.status(503).json({
      error: "ESOK AI is not configured yet. Set the OPENAI_API_KEY environment variable on the server."
    });
  }

  try {
    const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are ESOK AI, a helpful, friendly assistant. Explain school subjects clearly, show math steps when useful, handle typos gracefully, and be honest when unsure. Keep answers appropriate for a general audience."
          },
          ...clean
        ],
        max_tokens: 900
      })
    });
    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("AI error:", upstream.status, result?.error?.message || "unknown");
      return res.status(upstream.status === 429 ? 429 : 502).json({
        error: upstream.status === 429
          ? "ESOK AI is busy right now. Please wait a moment and try again."
          : "The online AI service returned an error. Check the API key and model name."
      });
    }
    const reply = result?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "The AI service returned an empty response." });
    }
    res.json({ reply: reply.trim() });
  } catch (err) {
    console.error("ESOK chat failed:", err);
    res.status(502).json({ error: "Could not reach the online AI service. Please try again." });
  }
});

// Wallpaper browser: searches Pexels (free API key in PEXELS_API_KEY) so people can stream 4K wallpapers without downloading them.
app.get("/api/wallpapers", async (req, res) => {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return res.status(503).json({ error: "Wallpaper search is not set up yet. Add a free PEXELS_API_KEY on the server (pexels.com/api)." });
  const type = req.query.type === "image" ? "image" : "video";
  const q = String(req.query.q || "nature").trim().slice(0, 80) || "nature";
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 20);
  const url = type === "video"
    ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(q)}&orientation=landscape&size=large&per_page=12&page=${page}`
    : `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&orientation=landscape&size=large&per_page=12&page=${page}`;
  try {
    const r = await fetch(url, { headers: { Authorization: key } });
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: r.status === 429 ? "Wallpaper search is busy. Try again in a minute." : "The wallpaper service returned an error." });
    const data = await r.json();
    let items;
    if (type === "video") {
      // Only return genuine UHD/4K-or-better MP4 files. Never upscale or label HD as 4K.
      items = (data.videos || []).map(v => {
        const files = (v.video_files || []).filter(f =>
          f.file_type === "video/mp4" && f.link && f.width >= 3840 && f.height >= 2160
        ).sort((a, b) => (b.width * b.height) - (a.width * a.height));
        const best = files[0];
        return best ? {
          id: v.id, kind: "video", name: `Video by ${v.user?.name || "Pexels"}`,
          thumb: v.image, src: best.link, width: best.width, height: best.height,
          resolution: `${best.width}×${best.height}`, credit: v.url
        } : null;
      }).filter(Boolean);
    } else {
      // Pexels' original URL is used unchanged; dimensions are checked before calling it 4K.
      items = (data.photos || []).filter(ph => ph.width >= 3840 && ph.height >= 2160).map(ph => ({
        id: ph.id, kind: "image", name: ph.alt || `Photo by ${ph.photographer}`, thumb: ph.src?.medium,
        src: ph.src?.original, width: ph.width, height: ph.height,
        resolution: `${ph.width}×${ph.height}`, credit: ph.url
      })).filter(ph => ph.src);
    }
    res.set("Cache-Control", "public, max-age=600").json({ items, hasMore: Number(data.total_results || 0) > page * 12, page });
  } catch (err) {
    console.error("Wallpaper search failed:", err);
    res.status(502).json({ error: "Could not reach the wallpaper service." });
  }
});

// 3) Static site (ESOK front end + /scramjet-client/)
app.get("/healthz", (_req, res) => res.send("ok"));
app.use(express.static(publicDir));

const server = http.createServer(app);
server.on("upgrade", (req, socket, head) => {
  if (!routeUpgrade(req, socket, head)) socket.destroy();
});

server.listen(PORT, "0.0.0.0", () => console.log(`ESOK running on port ${PORT}`));
