import { Response } from "express";
import { ChannelId, IslandEvent } from "./types.js";

interface ConnectedClient {
  res: Response;
  allowedChannels: ReadonlySet<ChannelId>;
}

const clients: ConnectedClient[] = [];

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
      client.res.write(": ping\n\n");
    } catch {
      removeClient(client.res);
    }
  }
}, HEARTBEAT_INTERVAL_MS).unref();

export function addClient(
  res: Response,
  allowedChannels: ReadonlySet<ChannelId>
) {
  // Flush SSE headers immediately so the browser EventSource fires `onopen`,
  // then register the connection to receive broadcast events.
  res.flushHeaders();
  res.write(": connected\n\n");
  clients.push({ res, allowedChannels });
}

export function removeClient(res: Response) {
  const index = clients.findIndex((c) => c.res === res);

  if (index > -1) {
    clients.splice(index, 1);
  }
}

export function broadcast(event: IslandEvent) {
  // No `event:` line — a named SSE event only fires addEventListener(name, ...)
  // handlers, never the browser's default EventSource.onmessage, which is what
  // every consumer here actually uses.
  for (const client of clients) {
    // Per-service access control: a client only ever receives the channels its
    // identity (see serviceAuth.ts) was granted at connect time.
    if (client.allowedChannels.has(event.channel)) {
      client.res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  console.log("Broadcasted:", event.event_type);
}
