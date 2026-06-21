import { Response } from "express";
import { IslandEvent } from "./types.js";

const clients: Response[] = [];

// Periodic SSE heartbeat. Without it, an idle connection (no events for a while)
// is silently dropped by intermediaries (reverse proxy / load balancer / TCP
// idle timeout). The browser keeps reporting the stream as open but never
// receives anything again. A regular comment line keeps the connection warm and
// lets a dead one surface as a write error so it is pruned and the client
// reconnects.
const HEARTBEAT_INTERVAL_MS = 20_000;

setInterval(() => {
  for (const client of [...clients]) {
    try {
      client.write(": ping\n\n");
    } catch {
      removeClient(client);
    }
  }
}, HEARTBEAT_INTERVAL_MS).unref();

export function addClient(res: Response) {
  // Flush SSE headers immediately so the browser EventSource fires `onopen`,
  // then register the connection to receive broadcast events.
  res.flushHeaders();
  res.write(": connected\n\n");
  clients.push(res);
}

export function removeClient(res: Response) {
  const index = clients.indexOf(res);

  if (index > -1) {
    clients.splice(index, 1);
  }
}

export function broadcast(event: IslandEvent) {
  // No `event:` line — a named SSE event only fires addEventListener(name, ...)
  // handlers, never the browser's default EventSource.onmessage, which is what
  // every consumer here actually uses.
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  console.log("Broadcasted:", event.event_type);
}