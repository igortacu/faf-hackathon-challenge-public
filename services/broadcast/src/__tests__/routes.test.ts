import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

import { createApp } from "../app.js";
import { SseClient } from "./sse-client.js";

let server: http.Server;
let port: number;

before(async () => {
  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function post(path: string, body: unknown) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

/** Connects a listener, posts one event, and returns the first frame it receives. */
async function publishAndReceive(path: string, body: unknown) {
  const client = await SseClient.connect(port);
  try {
    const { status, json } = await post(path, body);
    assert.equal(status, 200, `${path} should respond 200`);
    assert.deepEqual(json, { success: true }, `${path} should ack { success: true }`);

    await client.waitForFrames(1);
    const frame = client.frames[0];

    // The headline regression: every frame must be an unnamed `message` event,
    // otherwise EventSource.onmessage never fires and "no messages arrive".
    assert.equal(frame.event, undefined, "frame must be a default message event");
    return frame.data as Record<string, any>;
  } finally {
    client.close();
  }
}

describe("broadcast routes deliver to the listener", () => {
  it("POST /airport/arrival → airport channel, normalized guest", async () => {
    const data = await publishAndReceive("/airport/arrival", {
      channel: "resort-wide",
      message: "Ada Lovelace arrived",
      sender: "airport-service",
      data: { guest_id: "g-1", name: "Ada", surname: "Lovelace", gate: "EU-1" },
    });

    assert.equal(data.channel, "airport");
    assert.equal(data.event_type, "airport.arrival");
    assert.equal(data.message, "Ada Lovelace arrived");
    assert.equal(data.sender, "airport-service");
    assert.equal(data.guest_id, "g-1");
    assert.equal(data.guest_name, "Ada Lovelace");
    assert.equal(data.data.gate, "EU-1");
    assert.ok(typeof data.id === "string" && data.id.length > 0);
  });

  it("POST /hotel/confirm → hotel channel from { type, payload }", async () => {
    const data = await publishAndReceive("/hotel/confirm", {
      type: "hotel.reservation_confirmed",
      payload: {
        message: "Room confirmed",
        reservation_id: "r-9",
        guest_id: "g-2",
        room_type: "SUITE",
      },
    });

    assert.equal(data.channel, "hotel");
    assert.equal(data.event_type, "hotel.reservation_confirmed");
    assert.equal(data.message, "Room confirmed");
    assert.equal(data.sender, "hotel");
    assert.equal(data.guest_id, "g-2");
    assert.equal(data.data.reservation_id, "r-9");
  });

  it("POST /hotel/cancel → cancellation event", async () => {
    const data = await publishAndReceive("/hotel/cancel", {
      type: "hotel.reservation_cancelled",
      payload: { message: "Booking cancelled", guest_id: "g-3" },
    });

    assert.equal(data.channel, "hotel");
    assert.equal(data.event_type, "hotel.reservation_cancelled");
    assert.equal(data.message, "Booking cancelled");
    assert.equal(data.guest_id, "g-3");
  });

  it("POST /beach/full → beach.activity_full", async () => {
    const data = await publishAndReceive("/beach/full", {
      message: "Surfing is full",
      sender: "beach",
      data: { guest_id: "g-4", activity: "surfing" },
    });

    assert.equal(data.channel, "beach");
    assert.equal(data.event_type, "beach.activity_full");
    assert.equal(data.message, "Surfing is full");
    assert.equal(data.guest_id, "g-4");
  });

  it("POST /beach/available → beach.activity_available (not _full)", async () => {
    const data = await publishAndReceive("/beach/available", {
      message: "Surfing has a free slot",
      sender: "beach",
      data: { activity: "surfing" },
    });

    assert.equal(data.channel, "beach");
    // Regression: this route previously emitted beach.activity_full.
    assert.equal(data.event_type, "beach.activity_available");
    assert.equal(data.message, "Surfing has a free slot");
  });

  it("POST /public → resort-wide announcement from a guest", async () => {
    const data = await publishAndReceive("/public", {
      guestName: "Grace Hopper",
      message: "Lost compiler near the pier",
    });

    assert.equal(data.channel, "resort-wide");
    assert.equal(data.event_type, "public.announcement");
    assert.equal(data.message, "Lost compiler near the pier");
    assert.equal(data.sender, "Grace Hopper");
    assert.equal(data.guest_name, "Grace Hopper");
  });

  it("fans a single event out to multiple connected listeners", async () => {
    const [a, b] = await Promise.all([SseClient.connect(port), SseClient.connect(port)]);
    try {
      await post("/public", { guestName: "Alan Turing", message: "Tea at 4" });
      await Promise.all([a.waitForFrames(1), b.waitForFrames(1)]);

      for (const client of [a, b]) {
        const data = client.frames[0].data as Record<string, any>;
        assert.equal(data.message, "Tea at 4");
        assert.equal(client.frames[0].event, undefined);
      }
    } finally {
      a.close();
      b.close();
    }
  });
});
