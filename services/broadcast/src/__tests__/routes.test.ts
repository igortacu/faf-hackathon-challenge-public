import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";

import { createApp } from "../app.js";
import { SseClient } from "./sse-client.js";

const ADMIN_PASSCODE = "test-passcode";

let server: http.Server;
let port: number;

before(async () => {
  // Admin routes fail closed unless ADMIN_PASSCODE is configured.
  process.env.ADMIN_PASSCODE = ADMIN_PASSCODE;
  server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

/** Connects a listener, posts one event, and returns the first frame it receives. */
async function publishAndReceive(
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) {
  const client = await SseClient.connect(port);
  try {
    const { status, json } = await post(path, body, headers);
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
  it("POST /airport/arrival → airport channel, spreads extras into data", async () => {
    const data = await publishAndReceive("/airport/arrival", {
      message: "Ada Lovelace arrived",
      guest_id: "g-1",
      guest_name: "Ada Lovelace",
      gate: "EU-1",
      passport_type: "EU",
    });

    assert.equal(data.channel, "airport");
    assert.equal(data.event_type, "airport.arrival");
    assert.equal(data.message, "Ada Lovelace arrived");
    assert.equal(data.sender, "airport");
    assert.equal(data.guest_id, "g-1");
    assert.equal(data.guest_name, "Ada Lovelace");
    assert.equal(data.data.gate, "EU-1");
    assert.equal(data.data.passport_type, "EU");
    assert.ok(typeof data.id === "string" && data.id.length > 0);
  });

  it("POST /hotel/confirm → hotel channel, confirmation event", async () => {
    const data = await publishAndReceive("/hotel/confirm", {
      message: "Room confirmed",
      guest_id: "g-2",
      reservation_id: "r-9",
      room_type: "SUITE",
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
      message: "Booking cancelled",
      guest_id: "g-3",
    });

    assert.equal(data.channel, "hotel");
    assert.equal(data.event_type, "hotel.reservation_cancelled");
    assert.equal(data.message, "Booking cancelled");
    assert.equal(data.guest_id, "g-3");
  });

  it("POST /beach/full → beach.activity_full", async () => {
    const data = await publishAndReceive("/beach/full", {
      message: "Surfing is full",
      guest_id: "g-4",
      activity: "surfing",
    });

    assert.equal(data.channel, "beach");
    assert.equal(data.event_type, "beach.activity_full");
    assert.equal(data.message, "Surfing is full");
    assert.equal(data.guest_id, "g-4");
    assert.equal(data.data.activity, "surfing");
  });

  it("POST /beach/available → beach.activity_available (not _full)", async () => {
    const data = await publishAndReceive("/beach/available", {
      message: "Surfing has a free slot",
      activity: "surfing",
    });

    assert.equal(data.channel, "beach");
    // Regression: the merge had this route emitting beach.activity_full.
    assert.equal(data.event_type, "beach.activity_available");
    assert.equal(data.message, "Surfing has a free slot");
  });

  it("POST /cursed → parrot channel, public profanity notification", async () => {
    const data = await publishAndReceive("/cursed", {
      guest_id: "guest-kiki-0001",
      message: "This damn parrot",
      triggered_word: ["damn"],
    });

    assert.equal(data.channel, "parrot");
    assert.equal(data.event_type, "parrot.cursed");
    assert.equal(data.message, "This damn parrot");
    assert.equal(data.sender, "parrot");
    assert.equal(data.guest_id, "guest-kiki-0001");
    assert.deepEqual(data.data.triggered_word, ["damn"]);
  });

  it("POST /public → broadcast-channel announcement from a guest", async () => {
    const data = await publishAndReceive("/public", {
      guestName: "Grace Hopper",
      message: "Lost compiler near the pier",
    });

    assert.equal(data.channel, "broadcast");
    assert.equal(data.event_type, "public.announcement");
    assert.equal(data.message, "Lost compiler near the pier");
    assert.equal(data.sender, "Grace Hopper");
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

describe("payloads are validated against a concrete schema per message type", () => {
  it("rejects an unknown field on /airport/arrival (400)", async () => {
    const { status, json } = await post("/airport/arrival", {
      message: "Ada Lovelace arrived",
      not_a_real_field: "should be rejected",
    });
    assert.equal(status, 400);
    assert.equal(json.error, "Invalid payload");
  });

  it("rejects an unknown field on /hotel/confirm (400)", async () => {
    const { status } = await post("/hotel/confirm", {
      message: "Room confirmed",
      totally_made_up: 123,
    });
    assert.equal(status, 400);
  });

  it("rejects an unknown field on /beach/full (400)", async () => {
    const { status } = await post("/beach/full", {
      message: "Surfing is full",
      wildcard: { anything: "goes" },
    });
    assert.equal(status, 400);
  });

  it("rejects an unknown field on /crab/order (400)", async () => {
    const { status } = await post("/crab/order", {
      message: "Order placed",
      extra: "nope",
    });
    assert.equal(status, 400);
  });

  it("rejects a wrong-typed field on /crab/order (400)", async () => {
    const { status } = await post("/crab/order", {
      message: "Order placed",
      total: "not-a-number",
    });
    assert.equal(status, 400);
  });

  it("rejects an unknown field on /cursed (400)", async () => {
    const { status } = await post("/cursed", {
      guest_id: "guest-kiki-0001",
      message: "This damn parrot",
      triggered_word: ["damn"],
      extra: "nope",
    });
    assert.equal(status, 400);
  });

  it("rejects a missing required field on /cursed (400)", async () => {
    const { status } = await post("/cursed", {
      message: "This damn parrot",
      triggered_word: ["damn"],
    });
    assert.equal(status, 400);
  });

  it("rejects an unknown field on /public (400)", async () => {
    const { status } = await post("/public", {
      guestName: "Grace Hopper",
      message: "Lost compiler near the pier",
      extra: "nope",
    });
    assert.equal(status, 400);
  });

  it("rejects a missing required field on /public (400)", async () => {
    const { status } = await post("/public", {
      guestName: "Grace Hopper",
    });
    assert.equal(status, 400);
  });
});

describe("admin announcement route is admin-only", () => {
  it("rejects a request without the admin passcode (401)", async () => {
    const { status, json } = await post("/admin/announcement", {
      message: "Storm warning",
    });
    assert.equal(status, 401);
    assert.equal(json.error, "Admin authentication required");
  });

  it("rejects a wrong passcode (401)", async () => {
    const { status } = await post(
      "/admin/announcement",
      { message: "Storm warning" },
      { "X-Admin-Passcode": "wrong" }
    );
    assert.equal(status, 401);
  });

  it("validates that message is required (400)", async () => {
    const { status } = await post(
      "/admin/announcement",
      { sender: "Admin" },
      { "X-Admin-Passcode": ADMIN_PASSCODE }
    );
    assert.equal(status, 400);
  });

  it("rejects an unknown field even with a valid passcode (400)", async () => {
    const { status } = await post(
      "/admin/announcement",
      { message: "Storm warning", channel: "should-not-be-settable" },
      { "X-Admin-Passcode": ADMIN_PASSCODE }
    );
    assert.equal(status, 400);
  });

  it("broadcasts a resort-wide admin announcement with a valid passcode", async () => {
    const data = await publishAndReceive(
      "/admin/announcement",
      { message: "Beach closes at 6pm", sender: "Lifeguard" },
      { "X-Admin-Passcode": ADMIN_PASSCODE }
    );

    assert.equal(data.channel, "resort-wide");
    assert.equal(data.event_type, "admin.announcement");
    assert.equal(data.message, "Beach closes at 6pm");
    assert.equal(data.sender, "Lifeguard");
  });
});
