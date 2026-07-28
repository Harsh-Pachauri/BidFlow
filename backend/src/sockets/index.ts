import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { setIO } from "./io";

const JWT_SECRET = process.env.JWT_SECRET!;

// Auth happens once at handshake, not per-event -- a socket that skipped
// this would otherwise bypass every REST-layer auth check entirely.
export function initSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") {
      next(new Error("Missing auth token"));
      return;
    }
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("auction:join", (payload: { rfqId: number }) => {
      socket.join(`rfq:${payload.rfqId}`);
    });
    socket.on("auction:leave", (payload: { rfqId: number }) => {
      socket.leave(`rfq:${payload.rfqId}`);
    });
    socket.on("listing:join", () => {
      socket.join("listing");
    });
    socket.on("listing:leave", () => {
      socket.leave("listing");
    });
  });

  setIO(io);
  return io;
}
