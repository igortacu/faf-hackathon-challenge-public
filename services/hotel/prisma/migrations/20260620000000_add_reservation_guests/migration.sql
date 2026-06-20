-- CreateTable
CREATE TABLE "ReservationGuest" (
    "reservation_id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("reservation_id","guest_id")
);

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
