import { Response } from "express";
import { IslandEvent } from "./types.js";

const clients: Response[] = [];

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
  clients.forEach((client) => {
    client.write(
      `event: ${event.type}\n` +
      `data: ${JSON.stringify(event)}\n\n`
    );
  });

  console.log("Broadcasted:", event.type);
}