import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ReservationStatus } from '../../generated/prisma/client.js';
import { AirportService } from '../airport/airport.service';
import { BroadcastService } from '../broadcast/broadcast.service';
import { HotelBroadcastEventType } from '../broadcast/hotel-events';
import { PrismaService } from '../prisma/prisma.service';
import { CancelReservationResponseDto } from './dto/cancel-reservation-response.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationResponseDto } from './dto/reservation-response.dto';

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broadcast: BroadcastService,
    private readonly airport: AirportService,
  ) {}

  async create(
    createReservationDto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    if (
      createReservationDto.check_out_day <= createReservationDto.check_in_day
    ) {
      throw new HttpException(
        { error: 'check_out_day must be greater than check_in_day' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify the guest has cleared airport processing before persisting
    // anything, so a rejected guest never leaves a CONFIRMED reservation
    // orphaned in the database.
    await this.rejectIfGuestHasNotClearedAirport(createReservationDto.guest_id);

    const rooms = await this.prisma.room.findMany({
      where: { type: createReservationDto.room_type },
      orderBy: { id: 'asc' },
    });

    // When a party is specified use its size for capacity checks; fall back to
    // guest_count so existing callers that omit party_guest_ids keep working.
    const partySize =
      createReservationDto.party_guest_ids &&
      createReservationDto.party_guest_ids.length > 0
        ? createReservationDto.party_guest_ids.length
        : createReservationDto.guest_count;

    const maxCapacity = Math.max(...rooms.map((room) => room.capacity));
    if (partySize > maxCapacity) {
      throw new HttpException(
        {
          error: `Room type ${createReservationDto.room_type} supports at most ${maxCapacity} guests`,
        },
        HttpStatus.CONFLICT,
      );
    }

    let availableRoom: (typeof rooms)[number] | null = null;

    for (const room of rooms) {
      if (partySize > room.capacity) {
        continue;
      }

      const overlappingReservationCount = await this.prisma.reservation.count({
        where: {
          room_id: room.id,
          status: ReservationStatus.CONFIRMED,
          check_in_day: { lte: createReservationDto.check_out_day },
          check_out_day: { gte: createReservationDto.check_in_day },
        },
      });

      if (overlappingReservationCount === 0) {
        availableRoom = room;
        break;
      }
    }

    if (!availableRoom) {
      throw new HttpException(
        {
          error: `No available rooms of type ${createReservationDto.room_type} for days ${createReservationDto.check_in_day}-${createReservationDto.check_out_day}`,
        },
        HttpStatus.CONFLICT,
      );
    }

    const party = createReservationDto.party_guest_ids ?? [];

    const reservation = await this.prisma.reservation.create({
      data: {
        guest_id: createReservationDto.guest_id,
        room_id: availableRoom.id,
        guest_count: createReservationDto.guest_count,
        check_in_day: createReservationDto.check_in_day,
        check_out_day: createReservationDto.check_out_day,
        status: ReservationStatus.CONFIRMED,
        guests: {
          create: party.map((guestId) => ({ guest_id: guestId })),
        },
      },
      include: { guests: true },
    });

    await this.broadcast.publishHotelEvent(
      HotelBroadcastEventType.ReservationConfirmed,
      {
        message: 'Hotel reservation confirmed.',
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        room_type: availableRoom.type,
        guest_count: reservation.guest_count,
        check_in_day: reservation.check_in_day,
        check_out_day: reservation.check_out_day,
      },
    );

    return {
      id: reservation.id,
      guest_id: reservation.guest_id,
      room_id: reservation.room_id,
      room_type: availableRoom.type,
      guest_count: reservation.guest_count,
      party_guest_ids: reservation.guests.map((g) => g.guest_id),
      check_in_day: reservation.check_in_day,
      check_out_day: reservation.check_out_day,
      status: reservation.status,
    };
  }

  private async rejectIfGuestHasNotClearedAirport(
    guestId: string,
  ): Promise<void> {
    const hasClearedAirport =
      await this.airport.hasGuestClearedProcessing(guestId);

    if (hasClearedAirport === false) {
      throw new HttpException(
        { error: 'Guest has not cleared airport processing' },
        HttpStatus.CONFLICT,
      );
    }
  }

  async findById(id: string): Promise<ReservationResponseDto> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { room: true, guests: true },
    });

    if (!reservation) {
      throw new HttpException(
        { error: 'Reservation not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      id: reservation.id,
      guest_id: reservation.guest_id,
      room_id: reservation.room_id,
      room_type: reservation.room.type,
      guest_count: reservation.guest_count,
      party_guest_ids: reservation.guests.map((g) => g.guest_id),
      check_in_day: reservation.check_in_day,
      check_out_day: reservation.check_out_day,
      status: reservation.status,
    };
  }

  async findActiveByGuestId(guestId: string): Promise<ReservationResponseDto> {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        guest_id: guestId,
        status: ReservationStatus.CONFIRMED,
      },
      orderBy: { check_in_day: 'desc' },
      include: { room: true, guests: true },
    });

    if (!reservation) {
      throw new HttpException(
        { error: 'Reservation not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      id: reservation.id,
      guest_id: reservation.guest_id,
      room_id: reservation.room_id,
      room_type: reservation.room.type,
      guest_count: reservation.guest_count,
      party_guest_ids: reservation.guests.map((g) => g.guest_id),
      check_in_day: reservation.check_in_day,
      check_out_day: reservation.check_out_day,
      status: reservation.status,
    };
  }

  async cancel(id: string): Promise<CancelReservationResponseDto> {
    const existing = await this.prisma.reservation.findFirst({
      where: { id },
      include: { room: true },
    });

    if (!existing) {
      throw new HttpException(
        { error: 'Reservation not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    // Idempotent: already cancelled — return current state, no event emitted
    if (existing.status === ReservationStatus.CANCELLED) {
      return { id: existing.id, status: existing.status };
    }

    const reservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
      include: { room: true },
    });

    await this.broadcast.publishHotelEvent(
      HotelBroadcastEventType.ReservationCancelled,
      {
        message: 'Hotel reservation cancelled.',
        reservation_id: reservation.id,
        guest_id: reservation.guest_id,
        room_type: reservation.room.type,
        guest_count: reservation.guest_count,
        check_in_day: reservation.check_in_day,
        check_out_day: reservation.check_out_day,
      },
    );

    return {
      id: reservation.id,
      status: reservation.status,
    };
  }
}
