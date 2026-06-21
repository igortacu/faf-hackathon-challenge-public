package com.hackathon.summer.faf

import com.hackathon.summer.faf.infrastructure.database.DatabaseFactory
import com.hackathon.summer.faf.infrastructure.broadcast.HotelCheckInBroadcastClient
import com.hackathon.summer.faf.infrastructure.repository.PostgresVisitorRepository
import com.hackathon.summer.faf.plugins.configureHttp
import com.hackathon.summer.faf.plugins.configureMonitoring
import com.hackathon.summer.faf.plugins.configureRouting
import com.hackathon.summer.faf.plugins.configureSerialization
import io.ktor.server.application.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    DatabaseFactory.init(environment.config)

    // Installed before configureHttp()/configureRouting() so the correlation id is
    // available (call.callId) and the access log wraps every request, including
    // ones CORS rejects.
    configureMonitoring()
    configureSerialization()
    configureHttp()
    configureRouting()

    HotelCheckInBroadcastClient(
        broadcastServiceUrl = System.getenv("BROADCAST_SERVICE_URL"),
        visitorRepository = PostgresVisitorRepository(),
        serviceToken = System.getenv("BEACH_TOKEN")
    ).start()
}
