import { Injectable, Logger } from '@nestjs/common';
import { getRequestId } from '../common/request-context';
import { HotelBroadcastEvent, HotelBroadcastEventType } from './hotel-events';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private readonly broadcastServiceUrl = process.env.BROADCAST_SERVICE_URL;

  async publishHotelEvent(
    eventType: HotelBroadcastEventType,
    event: HotelBroadcastEvent,
  ): Promise<void> {
    if (!this.broadcastServiceUrl) {
      return;
    }

    const requestId = getRequestId();
    const path = this.getEndpointForEvent(eventType);
    const start = process.hrtime.bigint();
    let status: number | string = '-';

    try {
      const response = await fetch(`${this.broadcastServiceUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Request-Id': requestId,
        },
        body: JSON.stringify(event),
      });
      status = response.status;

      if (!response.ok) {
        this.logger.warn(
          `Failed to publish hotel event ${eventType}: ${response.status}`,
        );
      }
    } catch (error) {
      status = 'error';
      this.logger.warn(`Failed to publish hotel event ${eventType}`, error);
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      this.logger.log(
        `service=hotel event=outbound_call request_id=${requestId} target=broadcast method=POST path=${path} status=${status} duration_ms=${durationMs.toFixed(1)}`,
      );
    }
  }

  private getEndpointForEvent(eventType: HotelBroadcastEventType): string {
    switch (eventType) {
      case HotelBroadcastEventType.ReservationConfirmed:
        return '/hotel/confirm';
      case HotelBroadcastEventType.ReservationCancelled:
        return '/hotel/cancel';
    }
  }
}
