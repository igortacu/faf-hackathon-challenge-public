import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Response } from "express";

import { addClient, broadcast, removeClient } from "../eventBus.js";
import { ChannelId, EventType, IslandEvent } from "../types.js";

// A fake express Response that records everything written to the stream.
function fakeClient() {
  const writes: string[] = [];
  let flushed = false;
  const res = {
    flushHeaders() {
      flushed = true;
    },
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  } as unknown as Response;
  return {
    res,
    writes,
    get flushed() {
      return flushed;
    },
    get text() {
      return writes.join("");
    },
  };
}

const sampleEvent: IslandEvent = {
  id: "evt-1",
  channel: ChannelId.Airport,
  event_type: EventType.AIRPORT_ARRIVAL,
  message: "Ada Lovelace arrived",
  sender: "airport",
  guest_id: "g-1",
  guest_name: "Ada Lovelace",
  data: { gate: "EU-1" },
};

// Full read access — used by tests that exercise generic delivery, not the
// channel access-control rules themselves (see the dedicated tests below).
const ALL_CHANNELS = new Set(Object.values(ChannelId));

describe("eventBus", () => {
  const registered: Response[] = [];

  afterEach(() => {
    // Detach any clients added during a test so they don't leak into the next.
    registered.splice(0).forEach((res) => removeClient(res));
  });

  function track(res: Response) {
    registered.push(res);
    return res;
  }

  it("flushes headers and primes the stream on connect", () => {
    const c = fakeClient();
    addClient(track(c.res), ALL_CHANNELS);

    assert.equal(c.flushed, true, "headers must flush so EventSource fires onopen");
    assert.ok(c.text.includes(": connected"), "should prime the SSE stream");
  });

  it("delivers a default (unnamed) message frame — regression for named events", () => {
    const c = fakeClient();
    addClient(track(c.res), ALL_CHANNELS);
    c.writes.length = 0; // drop the priming comment

    broadcast(sampleEvent);

    const frame = c.text;
    // The core bug: a named `event:` line makes onmessage never fire.
    assert.ok(!frame.includes("event:"), "frame must NOT carry a named event line");
    assert.ok(frame.startsWith("data:"), "frame must be a default message frame");
    assert.ok(frame.endsWith("\n\n"), "frame must terminate with a blank line");
  });

  it("serializes the full consumer-contract payload in the data line", () => {
    const c = fakeClient();
    addClient(track(c.res), ALL_CHANNELS);
    c.writes.length = 0;

    broadcast(sampleEvent);

    const json = c.text.replace(/^data:\s*/, "").trim();
    assert.deepEqual(JSON.parse(json), sampleEvent);
  });

  it("fans out to every connected client", () => {
    const a = fakeClient();
    const b = fakeClient();
    addClient(track(a.res), ALL_CHANNELS);
    addClient(track(b.res), ALL_CHANNELS);
    a.writes.length = 0;
    b.writes.length = 0;

    broadcast(sampleEvent);

    assert.ok(a.text.includes("evt-1"));
    assert.ok(b.text.includes("evt-1"));
  });

  it("stops delivering after a client is removed", () => {
    const c = fakeClient();
    addClient(c.res, ALL_CHANNELS); // not tracked: we remove it explicitly below
    removeClient(c.res);
    c.writes.length = 0;

    broadcast(sampleEvent);

    assert.equal(c.text, "", "a removed client must receive nothing");
  });

  it("only delivers events on channels the client was granted at connect time", () => {
    const c = fakeClient();
    addClient(track(c.res), new Set([ChannelId.Hotel]));
    c.writes.length = 0;

    broadcast(sampleEvent); // channel: airport — not in this client's grant
    assert.equal(c.text, "", "an airport event must not reach a hotel-only listener");

    broadcast({ ...sampleEvent, channel: ChannelId.Hotel, event_type: EventType.HOTEL_CONFIRM });
    assert.ok(c.text.includes(EventType.HOTEL_CONFIRM), "a granted channel's event must arrive");
  });
});
