package com.hackathon.summer.faf.presentation.controller


import com.hackathon.summer.faf.application.usecase.BookActivityUseCase
import com.hackathon.summer.faf.application.usecase.CancelActivityUseCase
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.presentation.request.VisitorRequest
import com.hackathon.summer.faf.presentation.response.ActivityParticipantsResponse
import com.hackathon.summer.faf.presentation.response.ActivityResponse
import com.hackathon.summer.faf.presentation.response.ErrorResponse
import domain.error.ActivityErrors
import domain.error.VisitorErrors
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*


class ActivityController(
    private val activityRepository: ActivityRepository,
    private val bookActivityUseCase: BookActivityUseCase,
    private val cancelActivityUseCase: CancelActivityUseCase
) {

    suspend fun book(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID)
            )
            return
        }

        val request = call.receive<VisitorRequest>()

        val error = bookActivityUseCase.execute(
            activityId = activityId,
            visitorId = request.id
        )

        if (error != null) {
            call.respond(statusFor(error), ErrorResponse(error))
            return
        }

        call.respond(
            HttpStatusCode.OK,
            mapOf("status" to "booked")
        )
    }

    suspend fun cancel(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID)
            )
            return
        }

        val request = call.receive<VisitorRequest>()

        val error = cancelActivityUseCase.execute(
            activityId = activityId,
            visitorId = request.id
        )

        if (error != null) {
            call.respond(statusFor(error), ErrorResponse(error))
            return
        }

        call.respond(
            HttpStatusCode.OK,
            mapOf("status" to "cancelled")
        )
    }

    suspend fun getActivity(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID)
            )
            return
        }

        val activity = activityRepository.findById(activityId)
        if (activity == null) {
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(ActivityErrors.ACTIVITY_NOT_FOUND)
            )
            return
        }

        call.respond(
            HttpStatusCode.OK,
            ActivityResponse(
                activity_id = activity.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        )
    }

    suspend fun getActivityParticipants(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]
        if (activityId.isNullOrBlank()) {
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(ActivityErrors.MISSING_ACTIVITY_ID)
            )
            return
        }

        val participants = activityRepository.findParticipantsByActivityId(activityId)

        if (participants == null) {
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse("Activity not found")
            )
            return
        }

        call.respond(
            HttpStatusCode.OK,
            ActivityParticipantsResponse(
                activity_id = participants.activityId,
                capacity = participants.capacity,
                participants = participants.participants
            )
        )
    }

    suspend fun getActivities(call: ApplicationCall) {

        val activities = activityRepository.findAll()

        val response = activities.map { activity ->

            ActivityResponse(
                activity_id = activity.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining()
            )
        }

        call.respond(
            HttpStatusCode.OK,
            mapOf("activities" to response)
        )
    }

    // Maps a use-case error constant to the appropriate HTTP status code.
    private fun statusFor(error: String): HttpStatusCode = when (error) {
        ActivityErrors.ACTIVITY_NOT_FOUND,
        VisitorErrors.VISITOR_NOT_FOUND -> HttpStatusCode.NotFound

        ActivityErrors.ACTIVITY_FULL,
        ActivityErrors.ACTIVITY_ALREADY_BOOKED,
        ActivityErrors.ACTIVITY_NOT_BOOKED,
        ActivityErrors.VISITOR_ALREADY_IN_ACTIVITY,
        VisitorErrors.VISITOR_NOT_CHECKED_IN -> HttpStatusCode.Conflict

        else -> HttpStatusCode.BadRequest
    }
}
