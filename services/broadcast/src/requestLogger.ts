import { NextFunction, Request, Response } from "express";
import { v4 as uuid } from "uuid";

/**
 * One logfmt access-log line per request, with a correlation id (X-Request-Id)
 * reused from the caller or freshly generated, echoed back on the response. See
 * OBSERVABILITY.md. Broadcast is a terminal sink (no outbound calls to other
 * services), so there's no outbound_call logging here — just the access log.
 *
 * /events is a long-lived SSE stream: "finish" only fires on disconnect, so its
 * line reports the connection's full lifetime as duration_ms, not request latency.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.header("X-Request-Id") || uuid();
    res.setHeader("X-Request-Id", requestId);
    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(
        `ts=${new Date().toISOString()} level=info service=broadcast request_id=${requestId} method=${req.method} path=${req.path} status=${res.statusCode} duration_ms=${durationMs.toFixed(1)}`,
      );
    });

    next();
  };
}
