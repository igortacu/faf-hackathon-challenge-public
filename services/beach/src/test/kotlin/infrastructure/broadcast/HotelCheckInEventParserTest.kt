package com.hackathon.summer.faf.infrastructure.broadcast

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class HotelCheckInEventParserTest {

    @Test
    fun `extracts guest id from current broadcast hotel confirmation event`() {
        val event = """
            {
              "id": "event-1",
              "channel": "hotel",
              "event_type": "hotel.reservation_confirmed",
              "message": "A reservation was confirmed.",
              "sender": "hotel",
              "data": {
                "type": "hotel.reservation_confirmed",
                "payload": {
                  "reservation_id": "res-1",
                  "guest_id": "guest-123"
                }
              }
            }
        """.trimIndent()

        assertEquals("guest-123", HotelCheckInEventParser.guestIdFrom(event))
    }

    @Test
    fun `extracts guest id from hotel reservation confirmed broadcast event`() {
        val event = """
            {
              "id": "event-1",
              "type": "hotel.reservation_confirmed",
              "timestamp": "2026-06-20T10:00:00.000Z",
              "source": "hotel",
              "payload": {
                "type": "hotel.reservation_confirmed",
                "payload": {
                  "reservation_id": "res-1",
                  "guest_id": "guest-123"
                }
              }
            }
        """.trimIndent()

        assertEquals("guest-123", HotelCheckInEventParser.guestIdFrom(event))
    }

    @Test
    fun `ignores non hotel confirmation events`() {
        val event = """
            {
              "id": "event-1",
              "type": "hotel.reservation_cancelled",
              "timestamp": "2026-06-20T10:00:00.000Z",
              "source": "hotel",
              "payload": {
                "type": "hotel.reservation_cancelled",
                "payload": {
                  "reservation_id": "res-1",
                  "guest_id": "guest-123"
                }
              }
            }
        """.trimIndent()

        assertNull(HotelCheckInEventParser.guestIdFrom(event))
    }
}
