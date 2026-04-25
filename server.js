/**
 * Production-ready server.
 * Serves the Vite-built static files from dist/ AND proxies API requests
 * through the handler in api/index.js.
 */
import "dotenv/config";
import http from "http";
import handler, { recalculateAllRoles } from "./api/index.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const ROLE_RECALC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const server = http.createServer(async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("Unhandled error:", error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error." }));
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Server running at http://${HOST}:${PORT}`);

  // Start periodic role recalculation (every 1 hour)
  setInterval(() => {
    console.log("🔄 Running periodic role recalculation...");
    recalculateAllRoles();
  }, ROLE_RECALC_INTERVAL_MS);
});
