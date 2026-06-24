package com.hackathon.summer.faf.plugins

import io.ktor.server.application.*
import io.ktor.http.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.response.*
import kotlin.time.Duration.Companion.seconds
import io.ktor.server.plugins.swagger.*
import io.ktor.server.routing.*

fun Application.configureHttp() {
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.Authorization)
        // Required so POST bodies (Content-Type: application/json) and the
        // admin/internal credentials are not rejected by CORS with a 403.
        allowHeader(HttpHeaders.ContentType)
        allowHeader("X-Admin-Secret")
        allowHeader("X-Internal-Key")
        allowHeader("MyCustomHeader")
        anyHost()
    }
    routing {
        swaggerUI(path = "openapi") {
            /*
             Documentation source configuration goes here.
    
             This can be from file (documentation.yaml), or it can be served dynamically from your sources using the
             `describe {}` API on routes.  When `openApi` enabled in Gradle, these calls will be automatically injected
             based on your code and comments.
             */
        }
    }
}
