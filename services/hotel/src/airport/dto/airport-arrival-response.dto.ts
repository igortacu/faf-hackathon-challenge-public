export type AirportArrivalStatus = 'queued' | 'processing' | 'processed';

// Mirrors the airport service's GET /arrivals/:guest_id response (snake_case).
export class AirportArrivalResponseDto {
  guest_id: string;
  status: AirportArrivalStatus;
  gate: string | null;
  position: number | null;
  queued_at: number;
  processed_at: number | null;
  wait_time_seconds: number;
}
