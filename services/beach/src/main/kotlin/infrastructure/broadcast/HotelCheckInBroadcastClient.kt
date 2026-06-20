package com.hackathon.summer.faf.infrastructure.broadcast

import com.hackathon.summer.faf.domain.repository.VisitorRepository
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.concurrent.atomic.AtomicBoolean

class HotelCheckInBroadcastClient(
    private val broadcastServiceUrl: String?,
    private val visitorRepository: VisitorRepository,
    private val httpClient: HttpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build(),
    private val reconnectDelayMillis: Long = 2_000
) {
    private val started = AtomicBoolean(false)

    fun start() {
        val baseUrl = broadcastServiceUrl?.trimEnd('/').orEmpty()
        if (baseUrl.isBlank() || !started.compareAndSet(false, true)) {
            return
        }

        Thread {
            while (!Thread.currentThread().isInterrupted) {
                runCatching {
                    listen("$baseUrl/events")
                }.onFailure { error ->
                    println("Hotel check-in broadcast listener disconnected: ${error.message}")
                    Thread.sleep(reconnectDelayMillis)
                }
            }
        }.apply {
            name = "hotel-check-in-broadcast-listener"
            isDaemon = true
            start()
        }
    }

    private fun listen(eventsUrl: String) {
        val request = HttpRequest.newBuilder()
            .uri(URI.create(eventsUrl))
            .timeout(Duration.ofSeconds(30))
            .GET()
            .build()

        val response = httpClient.send(request, HttpResponse.BodyHandlers.ofLines())
        if (response.statusCode() !in 200..299) {
            error("Broadcast stream returned ${response.statusCode()}")
        }

        response.body().use { lines ->
            lines.forEach { line ->
                if (line.startsWith("data:")) {
                    handleEvent(line.removePrefix("data:").trim())
                }
            }
        }
    }

    private fun handleEvent(rawEvent: String) {
        val guestId = HotelCheckInEventParser.guestIdFrom(rawEvent) ?: return
        visitorRepository.markCheckedIn(guestId)
    }
}
