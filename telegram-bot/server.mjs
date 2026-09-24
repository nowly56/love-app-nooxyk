import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadDotEnv();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
const WEB_APP_URL =
  process.env.TELEGRAM_WEB_APP_URL?.trim() ||
  (railwayDomain ? `https://${railwayDomain}` : "");
const PORT = Number(process.env.PORT || 8787);
const WEBHOOK_SECRET =
  process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ||
  crypto.randomBytes(24).toString("hex");
const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
const DIST_DIR = path.resolve(
  fileURLToPath(new URL("../dist/", import.meta.url)),
);
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

if (!BOT_TOKEN || !WEB_APP_URL) {
  console.error(
    "Нужны TELEGRAM_BOT_TOKEN и публичный домен приложения. Заполните .env или Variables в Railway.",
  );
  process.exit(1);
}

try {
  if (new URL(WEB_APP_URL).protocol !== "https:") throw new Error();
} catch {
  console.error("TELEGRAM_WEB_APP_URL должен быть публичным HTTPS-адресом.");
  process.exit(1);
}

const telegramApi = async (method, payload = {}) => {
  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const result = await response.json();
  if (!result.ok)
    throw new Error(result.description || `Telegram API error: ${method}`);
  return result.result;
};

const json = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": WEB_APP_URL,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  response.end(JSON.stringify(payload));
};

const serveWebApp = (request, response, pathname) => {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const relativePath =
    requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = path.resolve(DIST_DIR, relativePath);
  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    const resolvedPath =
      !statError && stats.isFile()
        ? filePath
        : path.join(DIST_DIR, "index.html");
    fs.readFile(resolvedPath, (readError, content) => {
      if (readError) {
        response.writeHead(503, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end("Web app is not built. Run npm run build:web first.");
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          CONTENT_TYPES[path.extname(resolvedPath)] ||
          "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": resolvedPath.endsWith("index.html")
          ? "no-cache"
          : "public, max-age=31536000, immutable",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    });
  });
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const timingSafeEqualHex = (expectedHex, receivedHex) => {
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex || "", "hex");
  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
};

/**
 * Проверка подписи Telegram Web App по правилам:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
const validateInitData = (initData) => {
  if (typeof initData !== "string" || !initData) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!receivedHash || !Number.isFinite(authDate)) return null;

  if (
    Math.abs(Math.floor(Date.now() / 1000) - authDate) >
    INIT_DATA_MAX_AGE_SECONDS
  ) {
    return null;
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  if (!timingSafeEqualHex(expectedHash, receivedHash)) return null;

  const userValue = params.get("user");
  if (!userValue) return null;

  try {
    return JSON.parse(userValue);
  } catch {
    return null;
  }
};

const appendInvite = (inviteCode) => {
  if (!inviteCode) return WEB_APP_URL;
  const separator = WEB_APP_URL.includes("?") ? "&" : "?";
  return `${WEB_APP_URL}${separator}invite=${encodeURIComponent(inviteCode)}`;
};

const botKeyboard = (inviteCode) => ({
  inline_keyboard: [
    [
      {
        text: inviteCode ? "Принять приглашение 💛" : "Открыть Love Archive 💛",
        web_app: { url: appendInvite(inviteCode) },
      },
    ],
  ],
});

const handleMessage = async (message) => {
  const text = message?.text || "";
  if (!text.startsWith("/start") && !text.startsWith("/help")) return;

  const commandParts = text.trim().split(/\s+/);
  const inviteCode = commandParts[0] === "/start" ? commandParts[1] : null;
  const greeting = inviteCode
    ? "Вас пригласили в общую историю. Откройте приложение, чтобы принять приглашение."
    : "Добро пожаловать в Love Archive — ваше приватное пространство для общей истории.";

  await telegramApi("sendMessage", {
    chat_id: message.chat.id,
    text: greeting,
    reply_markup: botKeyboard(inviteCode),
  });
};

const handleUpdate = async (update) => {
  if (update?.message) await handleMessage(update.message);
};

const startPolling = async () => {
  let offset = 0;
  while (true) {
    try {
      const updates = await telegramApi("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    } catch (error) {
      console.error("Ошибка Telegram polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url || "/",
    `http://${request.headers.host || "localhost"}`,
  );

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    json(response, 200, { ok: true, service: "love-archive-telegram-bot" });
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    serveWebApp(request, response, url.pathname);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/telegram/auth") {
    try {
      const payload = JSON.parse(await readBody(request));
      const user = validateInitData(payload?.initData);
      if (!user) {
        json(response, 401, { ok: false, error: "INVALID_TELEGRAM_INIT_DATA" });
        return;
      }
      json(response, 200, { ok: true, user });
    } catch {
      json(response, 400, { ok: false, error: "INVALID_REQUEST" });
    }
    return;
  }

  if (
    request.method === "POST" &&
    url.pathname === `/telegram/webhook/${WEBHOOK_SECRET}`
  ) {
    try {
      await handleUpdate(JSON.parse(await readBody(request)));
      json(response, 200, { ok: true });
    } catch {
      json(response, 400, { ok: false });
    }
    return;
  }

  response.writeHead(404);
  response.end("Not found");
});

server.listen(PORT, "0.0.0.0", async () => {
  console.log(`Love Archive bot server started on port ${PORT}`);
  try {
    await telegramApi("setMyCommands", {
      commands: [
        { command: "start", description: "Открыть Love Archive" },
        { command: "help", description: "Помощь" },
      ],
    });
    await telegramApi("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "Love Archive",
        web_app: { url: WEB_APP_URL },
      },
    });
    console.log("Команды и кнопка меню Telegram настроены");
  } catch (error) {
    console.error("Не удалось настроить меню Telegram:", error.message);
  }

  if (process.env.TELEGRAM_USE_WEBHOOK === "true") {
    console.log(
      "Webhook-режим включён: настройте Telegram_WEBHOOK_URL и вызовите setWebhook отдельно.",
    );
  } else {
    startPolling();
  }
});

function loadDotEnv() {
  const filePaths = [
    fileURLToPath(new URL("../.env", import.meta.url)),
    fileURLToPath(new URL("./.env", import.meta.url)),
  ];
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}
