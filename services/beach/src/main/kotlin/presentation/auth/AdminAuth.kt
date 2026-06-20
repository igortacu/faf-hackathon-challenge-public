package com.hackathon.summer.faf.presentation.auth

import io.ktor.server.application.*

/**
 * Authorizes admin-only endpoints. Two independent credentials are accepted:
 * X-Admin-Secret (human admins, via the frontend) and X-Internal-Key (trusted
 * service-to-service calls, matching the convention already used between
 * beach and the broadcast service). Fails closed: if neither secret is
 * configured server-side, no request is authorized.
 */
object AdminAuth {

    fun isAuthorized(call: ApplicationCall): Boolean {
        val adminSecret = System.getenv("ADMIN_SECRET")
        val providedAdminSecret = call.request.headers["X-Admin-Secret"]
        if (!adminSecret.isNullOrBlank() && providedAdminSecret == adminSecret) {
            return true
        }

        val internalSecret = System.getenv("INTERNAL_SECRET")
        val providedInternalKey = call.request.headers["X-Internal-Key"]
        if (!internalSecret.isNullOrBlank() && providedInternalKey == internalSecret) {
            return true
        }

        return false
    }
}
