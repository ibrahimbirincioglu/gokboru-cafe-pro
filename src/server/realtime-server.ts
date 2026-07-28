import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { WebSocket, WebSocketServer } from "ws";
import { hashQrToken } from "../features/qr/crypto";
import { SESSION_COOKIE_NAME } from "../lib/auth/config";
import { hashSessionToken } from "../lib/auth/tokens";
import {
  hasPermission,
  PERMISSIONS,
} from "../lib/auth/permissions";
import {
  realtimeBus,
  type LiveOrderEvent,
} from "../lib/realtime/events";

type ConnectionContext =
  | { kind: "admin"; sessionHash: string }
  | { kind: "order"; orderId: string };

type LiveSocket = WebSocket & {
  isAlive: boolean;
  context: ConnectionContext;
};

export function attachRealtimeServer(server: {
  on(event: "upgrade", listener: (request: IncomingMessage, socket: Socket, head: Buffer) => void): unknown;
}) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL tanımlı değil.");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 4_096,
    handleProtocols(protocols) {
      if (protocols.has("gokboru.admin.v1")) return "gokboru.admin.v1";
      if (protocols.has("gokboru.order.v1")) return "gokboru.order.v1";
      return false;
    },
  });

  server.on("upgrade", (request, socket, head) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname !== "/ws") return;
      if (!originAllowed(request)) {
        rejectUpgrade(socket);
        return;
      }
      const context = await authenticateUpgrade(prisma, request);
      if (!context) {
        rejectUpgrade(socket);
        return;
      }
      wss.handleUpgrade(request, socket, head, (webSocket) => {
        const liveSocket = webSocket as LiveSocket;
        liveSocket.context = context;
        liveSocket.isAlive = true;
        wss.emit("connection", liveSocket, request);
      });
    })().catch(() => rejectUpgrade(socket));
  });

  wss.on("connection", (socket: LiveSocket) => {
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    socket.on("message", () => {
      // Clients cannot publish domain events. PostgreSQL mutations are the only source.
    });
  });

  const broadcast = (event: LiveOrderEvent) => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      const socket = client as LiveSocket;
      const authorized =
        socket.context.kind === "admin" ||
        (socket.context.kind === "order" &&
          socket.context.orderId === event.orderId);
      if (authorized && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  };
  realtimeBus.on("order-event", broadcast);

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      const socket = client as LiveSocket;
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
      void contextStillValid(prisma, socket.context).then((valid) => {
        if (!valid) socket.terminate();
      });
    }
  }, 25_000);

  return async function closeRealtimeServer() {
    clearInterval(heartbeat);
    realtimeBus.off("order-event", broadcast);
    for (const client of wss.clients) client.terminate();
    wss.close();
    await prisma.$disconnect();
  };
}

async function authenticateUpgrade(
  prisma: PrismaClient,
  request: IncomingMessage,
): Promise<ConnectionContext | null> {
  const protocols = parseProtocols(request);
  if (protocols.includes("gokboru.admin.v1")) {
    const rawToken = parseCookies(request.headers.cookie)[SESSION_COOKIE_NAME];
    if (!rawToken || rawToken.length > 200) return null;
    const sessionHash = hashSessionToken(rawToken);
    const valid = await validateAdminSession(prisma, sessionHash);
    return valid ? { kind: "admin", sessionHash } : null;
  }
  if (protocols.includes("gokboru.order.v1")) {
    const orderToken = extractOrderToken(protocols);
    if (!orderToken) return null;
    const order = await prisma.order.findUnique({
      where: { publicTokenHash: hashQrToken(orderToken) },
      select: { id: true },
    });
    return order ? { kind: "order", orderId: order.id } : null;
  }
  return null;
}

export function extractOrderToken(protocols: string[]) {
  const tokenProtocol = protocols.find((protocol) =>
    /^order\.[A-Za-z0-9_-]{43}$/.test(protocol),
  );
  return tokenProtocol?.slice(6) ?? null;
}

async function contextStillValid(
  prisma: PrismaClient,
  context: ConnectionContext,
) {
  if (context.kind === "order") {
    return Boolean(
      await prisma.order.findUnique({
        where: { id: context.orderId },
        select: { id: true },
      }),
    );
  }
  return validateAdminSession(prisma, context.sessionHash);
}

async function validateAdminSession(
  prisma: PrismaClient,
  sessionHash: string,
) {
  const now = new Date();
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: sessionHash },
    include: {
      user: { select: { role: true, isActive: true } },
    },
  });
  if (!session || !isAdminSocketSessionValid(session, now)) {
    return false;
  }
  const idleExpiresAt = new Date(
    Math.min(session.expiresAt.getTime(), now.getTime() + 30 * 60_000),
  );
  await prisma.userSession.updateMany({
    where: { id: session.id, revokedAt: null },
    data: { lastSeenAt: now, idleExpiresAt },
  });
  return true;
}

export function isAdminSocketSessionValid(
  session: {
    revokedAt: Date | null;
    expiresAt: Date;
    idleExpiresAt: Date;
    user: {
      isActive: boolean;
      role: Parameters<typeof hasPermission>[0];
    };
  },
  now: Date,
) {
  return (
    !session.revokedAt &&
    session.expiresAt > now &&
    session.idleExpiresAt > now &&
    session.user.isActive &&
    hasPermission(session.user.role, PERMISSIONS.ORDERS_MANAGE)
  );
}

export function parseProtocols(request: IncomingMessage) {
  const header = request.headers["sec-websocket-protocol"];
  return typeof header === "string"
    ? header.split(",").map((value) => value.trim())
    : [];
}

export function parseCookies(header: string | undefined) {
  const result: Record<string, string> = {};
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      // Malformed cookie values are ignored.
    }
  }
  return result;
}

function originAllowed(request: IncomingMessage) {
  const origin = request.headers.origin;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return isAllowedOrigin(origin, appUrl);
}

export function isAllowedOrigin(
  origin: string | undefined,
  appUrl: string | undefined,
) {
  if (!origin || !appUrl) return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

function rejectUpgrade(socket: Socket) {
  if (socket.destroyed) return;
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  socket.destroy();
}
