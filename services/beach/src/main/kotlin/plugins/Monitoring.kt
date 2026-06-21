package com.hackathon.summer.faf.plugins

import io.ktor.http.HttpHeaders
import io.ktor.server.application.*
import io.ktor.server.plugins.callid.*
import io.ktor.server.request.*
import java.time.Instant
import java.util.UUID

/**
 * Correlation id (X-Request-Id) generation/propagation plus a hand-rolled access-log
 * line per request, in the same logfmt schema as every other service — see
 * OBSERVABILITY.md. Ktor 2.3.x's built-in CallLogging plugin doesn't expose elapsed
 * duration cleanly in its format{} callback, so timing+logging is done directly via
 * an intercept instead of fighting that plugin.
 */
fun Application.configureMonitoring() {
    install(CallId) {
        header(HttpHeaders.XRequestId)
        generate { UUID.randomUUID().toString().take(12) }
        verify { it.isNotBlank() }
        replyToHeader(HttpHeaders.XRequestId)
    }

    intercept(ApplicationCallPipeline.Monitoring) {
        val start = System.nanoTime()
        try {
            proceed()
        } finally {
            val durationMs = (System.nanoTime() - start) / 1_000_000.0
            val requestId = call.callId ?: "-"
            call.application.log.info(
                "ts=${Instant.now()} level=info service=beach request_id=$requestId " +
                    "method=${call.request.httpMethod.value} path=${call.request.path()} " +
                    "status=${call.response.status()?.value ?: 0} duration_ms=${"%.1f".format(durationMs)}"
            )
        }
    }
}
