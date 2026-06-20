import { Injectable } from '@nestjs/common';
import { AirportArrivalResponseDto } from './dto/airport-arrival-response.dto';

@Injectable()
export class AirportService {
  private readonly airportServiceUrl = process.env.AIRPORT_SERVICE_URL;

  async hasGuestClearedProcessing(guestId: string): Promise<boolean | null> {
    if (!this.airportServiceUrl) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.airportServiceUrl}/arrivals/${guestId}`,
      );

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
      return null;
    }
  }
}
