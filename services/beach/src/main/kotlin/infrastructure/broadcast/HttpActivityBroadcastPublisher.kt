package com.hackathon.summer.faf.infrastructure.broadcast

import com.hackathon.summer.faf.domain.model.Activity
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.time.Instant

// Wire shape expected by the Broadcast service's strict BeachEventSchema
// (message, guest_id, guest_name, activity) — distinct from the internal
// ActivityAvailabilityEvent used for in-process recording/tests.
@Serializable
private data class BeachBroadcastPayload(
    val message: String,
    val activity: String
)

class HttpActivityBroadcastPublisher(
    private val broadcastServiceUrl: String?,
    private val internalSecret: String?,
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(2))
        .build()
) : ActivityBroadcastPublisher {

    private val logger = LoggerFactory.getLogger(HttpActivityBroadcastPublisher::class.java)

    override fun publishActivityFull(activity: Activity, requestId: String) {
        publish("/beach/full", "beach.activity_full", activity, requestId)
    }

    override fun publishActivityAvailable(activity: Activity, requestId: String) {
        publish("/beach/available", "beach.activity_available", activity, requestId)
    }

    private fun publish(path: String, type: String, activity: Activity, requestId: String) {
        val baseUrl = broadcastServiceUrl?.trimEnd('/').orEmpty()
        if (baseUrl.isBlank()) return

        val start = System.nanoTime()
        var status: String = "-"
        try {
            val payload = BeachBroadcastPayload(
                message = if (type == "beach.activity_full")
                    "${activity.name} just reached capacity."
                else
                    "A spot opened up in ${activity.name}.",
                activity = activity.name
            )

            val requestBuilder = HttpRequest.newBuilder()
                .uri(URI.create("$baseUrl$path"))
                .timeout(Duration.ofSeconds(2))
                .header("Content-Type", "application/json")
                .header("X-Request-Id", requestId)
                .POST(HttpRequest.BodyPublishers.ofString(Json.encodeToString(payload)))

            if (!internalSecret.isNullOrBlank()) {
                requestBuilder.header("X-Internal-Key", internalSecret)
            }

            val response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.discarding())
            status = response.statusCode().toString()
        } catch (e: Exception) {
            status = "error"
        } finally {
            val durationMs = (System.nanoTime() - start) / 1_000_000.0
            logger.info(
                "ts=${Instant.now()} level=info service=beach event=outbound_call request_id=$requestId " +
                    "target=broadcast method=POST path=$path status=$status duration_ms=${"%.1f".format(durationMs)}"
            )
        }
    }
}
