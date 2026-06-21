import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { runWithRequestId } from './request-context';

/**
 * One logfmt access-log line per request, with a correlation id (X-Request-Id)
 * reused from the caller or freshly generated, echoed back on the response and
 * made available to the rest of the request via AsyncLocalStorage so outbound
 * calls (airport, broadcast) can attach it too. See OBSERVABILITY.md.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('RequestLogger');

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.header('X-Request-Id') || randomUUID();
    res.setHeader('X-Request-Id', requestId);
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.logger.log(
        `ts=${new Date().toISOString()} level=info service=hotel request_id=${requestId} method=${req.method} path=${req.path} status=${res.statusCode} duration_ms=${durationMs.toFixed(1)}`,
      );
    });

    runWithRequestId(requestId, () => next());
  }
}
