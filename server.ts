import "dotenv/config";

import { createServer } from "node:http";
import next from "next";
import { attachRealtimeServer } from "./src/server/realtime-server";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const handleUpgrade = app.getUpgradeHandler();

await app.prepare();

const server = createServer((request, response) => {
  void handle(request, response);
});
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (url.pathname !== "/ws") {
    void handleUpgrade(request, socket, head);
  }
});
const closeRealtime = attachRealtimeServer(server);

server.listen(port, hostname, () => {
  console.info(`Gökbörü Cafe server ${hostname}:${port} üzerinde hazır.`);
});

async function shutdown() {
  await closeRealtime();
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
