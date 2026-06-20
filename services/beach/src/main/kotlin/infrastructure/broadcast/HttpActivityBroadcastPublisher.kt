package com.hackathon.summer.faf.infrastructure.broadcast

import com.hackathon.summer.faf.domain.model.Activity
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

class HttpActivityBroadcastPublisher(
    private val broadcastServiceUrl: String?,
    private val internalSecret: String?,
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build()
) : ActivityBroadcastPublisher {

    override fun publishActivityFull(activity: Activity) {
        publish("/beach/full", "beach.activity_full", activity)
    }

    override fun publishActivityAvailable(activity: Activity) {
        publish("/beach/available", "beach.activity_available", activity)
    }

    private fun publish(path: String, type: String, activity: Activity) {
        val baseUrl = broadcastServiceUrl?.trimEnd('/').orEmpty()
        if (baseUrl.isBlank()) return

        runCatching {
            val payload = ActivityAvailabilityEvent(
                type = type,
                activityId = activity.id,
                activityName = activity.name,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )

            val requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create("$baseUrl$path"))
                .timeout(Duration.ofSeconds(2))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(Json.encodeToString(payload)))

            if (!internalSecret.isNullOrBlank()) {
                requestBuilder.header("X-Internal-Key", internalSecret)
            }

            httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.discarding())
        }
    }
}
