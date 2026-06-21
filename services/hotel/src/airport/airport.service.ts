import { Injectable, Logger } from '@nestjs/common';
import { getRequestId } from '../common/request-context';
import { AirportArrivalResponseDto } from './dto/airport-arrival-response.dto';

@Injectable()
export class AirportService {
  private readonly logger = new Logger(AirportService.name);
  private readonly airportServiceUrl = process.env.AIRPORT_SERVICE_URL;

  async hasGuestClearedProcessing(guestId: string): Promise<boolean | null> {
    if (!this.airportServiceUrl) {
      return null;
    }

    const requestId = getRequestId();
    const path = `/arrivals/${guestId}`;
    const start = process.hrtime.bigint();
    let status: number | string = '-';

    try {
      const response = await fetch(`${this.airportServiceUrl}${path}`, {
        headers: { 'X-Request-Id': requestId },
      });
      status = response.status;

      if (!response.ok) {
        return null;
      }

      const body = JSON.parse(
        await response.text(),
      ) as AirportArrivalResponseDto;

      // The airport service returns a snake_case `status` field; there is no
      // `isProcessed`. A guest has cleared processing only when status is
      // "processed".
      return body.status === 'processed';
    } catch {
      status = 'error';
      return null;
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.logger.log(
        `service=hotel event=outbound_call request_id=${requestId} target=airport method=GET path=${path} status=${status} duration_ms=${durationMs.toFixed(1)}`,
      );
    }
  }
}
