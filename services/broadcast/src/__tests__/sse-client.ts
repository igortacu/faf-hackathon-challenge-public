import http from "node:http";

export interface SseFrame {
  /** Named event from an `event:` line, or undefined for a default `message` frame. */
  event?: string;
  /** Parsed JSON from the `data:` line(s). */
  data: unknown;
}

/**
 * Minimal SSE reader used by the route tests. It connects to a running server,
 * buffers the raw stream, and parses frames the same way a browser EventSource
 * would — so a frame with an `event:` line is treated as a *named* event and a
 * frame without one is a default `message` event (the only kind onmessage sees).
 */
export class SseClient {
  readonly frames: SseFrame[] = [];
  raw = "";

  private req?: http.ClientRequest;
  private buffer = "";
  private waiters: Array<() => void> = [];

  static connect(port: number, path = "/events"): Promise<SseClient> {
    const client = new SseClient();
    return new Promise((resolve, reject) => {
      const req = http.get(
        { host: "127.0.0.1", port, path, headers: { Accept: "text/event-stream" } },
        (res) => {
          res.setEncoding("utf8");
          res.on("data", (chunk: string) => client.ingest(chunk));
          resolve(client);
        }
      );
      req.on("error", reject);
      client.req = req;
    });
  }

  private ingest(chunk: string) {
    this.raw += chunk;
    this.buffer += chunk;

    let sep: number;
    // Frames are separated by a blank line.
    while ((sep = this.buffer.indexOf("\n\n")) !== -1) {
      const block = this.buffer.slice(0, sep);
      this.buffer = this.buffer.slice(sep + 2);
      this.parseBlock(block);
    }
  }

  private parseBlock(block: string) {
    const lines = block.split("\n");
    let event: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(":")) continue; // comment, e.g. ": connected"
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }

    if (dataLines.length === 0) return; // nothing but comments/headers

    let data: unknown = dataLines.join("\n");
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      // leave as string
    }

    this.frames.push({ event, data });
    this.waiters.splice(0).forEach((w) => w());
  }

  /** Resolves once at least `count` frames have been received (or rejects on timeout). */
  waitForFrames(count: number, timeoutMs = 2000): Promise<void> {
    if (this.frames.length >= count) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `timed out waiting for ${count} frame(s); got ${this.frames.length}`
          )
        );
      }, timeoutMs);
      const check = () => {
        if (this.frames.length >= count) {
          clearTimeout(timer);
          resolve();
        } else {
          this.waiters.push(check);
        }
      };
      this.waiters.push(check);
    });
  }

  close() {
    this.req?.destroy();
  }
}
