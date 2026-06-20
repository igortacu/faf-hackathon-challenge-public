package com.hackathon.summer.faf.infrastructure.broadcast

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

object HotelCheckInEventParser {
    private const val HOTEL_CONFIRM_EVENT = "hotel.reservation_confirmed"

    fun guestIdFrom(rawEvent: String): String? {
        val event = runCatching {
            Json.parseToJsonElement(rawEvent).jsonObject
        }.getOrNull() ?: return null

        val eventType = event.string("event_type")
            ?: event.string("type")
            ?: event.obj("data")?.string("type")
            ?: event.obj("payload")?.string("type")

        if (eventType != HOTEL_CONFIRM_EVENT) {
            return null
        }

        return event.string("guest_id")
            ?: event.obj("data")?.string("guest_id")
            ?: event.obj("data")?.obj("payload")?.string("guest_id")
            ?: event.obj("payload")?.string("guest_id")
            ?: event.obj("payload")?.obj("payload")?.string("guest_id")
    }

    private fun JsonObject.string(key: String): String? =
        this[key]?.jsonPrimitive?.contentOrNull()

    private fun JsonObject.obj(key: String): JsonObject? =
        (this[key] as? JsonObject)

    private fun kotlinx.serialization.json.JsonPrimitive.contentOrNull(): String? =
        runCatching { content }.getOrNull()
}
