package com.hackathon.summer.faf.presentation.controller


import com.hackathon.summer.faf.application.usecase.BookActivityUseCase
import com.hackathon.summer.faf.application.usecase.CancelActivityUseCase
import com.hackathon.summer.faf.application.usecase.CreateActivityResult
import com.hackathon.summer.faf.application.usecase.CreateActivityUseCase
import com.hackathon.summer.faf.application.usecase.RemoveActivityResult
import com.hackathon.summer.faf.application.usecase.RemoveActivityUseCase
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.presentation.auth.AdminAuth
import com.hackathon.summer.faf.presentation.request.CreateActivityRequest
import com.hackathon.summer.faf.presentation.request.VisitorRequest
import com.hackathon.summer.faf.presentation.response.ActivityResponse
import com.hackathon.summer.faf.presentation.response.ErrorResponse
import domain.error.ActivityErrors
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*


class ActivityController(
    private val activityRepository: ActivityRepository,
    private val bookActivityUseCase: BookActivityUseCase,
    private val cancelActivityUseCase: CancelActivityUseCase,
    private val createActivityUseCase: CreateActivityUseCase,
    private val removeActivityUseCase: RemoveActivityUseCase
) {

    suspend fun book(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]


        val request = call.receive<VisitorRequest>()

        val error = bookActivityUseCase.execute(
            activityId = activityId!!,
            visitorId = request.id
        )

        println(error)

        call.respond(
            HttpStatusCode.OK,
            mapOf("status" to "booked")
        )
    }

    suspend fun cancel(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]


        val request = call.receive<VisitorRequest>()

        val error = cancelActivityUseCase.execute(
            activityId = activityId!!,
            visitorId = request.id
        )

        println(error)


        call.respond(
            HttpStatusCode.OK,
            mapOf("status" to "cancelled")
        )
    }

    suspend fun getActivity(call: ApplicationCall) {

        val activityId = call.parameters["activity_id"]


        val activity = activityRepository.findById(activityId!!)

        call.respond(
            HttpStatusCode.OK,
            ActivityResponse(
                activity_id = activity!!.id,
                activity_name = activity.name,
                description = activity.description,
                capacity = activity.capacity,
                remaining = activity.remaining()
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

    suspend fun create(call: ApplicationCall) {

        if (!AdminAuth.isAuthorized(call)) {
            call.respond(HttpStatusCode.Unauthorized, ErrorResponse(ActivityErrors.UNAUTHORIZED))
            return
        }

        val request = call.receive<CreateActivityRequest>()

        when (val result = createActivityUseCase.execute(request)) {
            is CreateActivityResult.Success -> call.respond(
                HttpStatusCode.Created,
                ActivityResponse(
                    activity_id = result.activity.id,
                    activity_name = result.activity.name,
                    description = result.activity.description,
                    capacity = result.activity.capacity,
                    remaining = result.activity.remaining()
                )
            )

            is CreateActivityResult.Invalid ->
                call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))

            is CreateActivityResult.AlreadyExists ->
                call.respond(HttpStatusCode.Conflict, ErrorResponse(ActivityErrors.ACTIVITY_ALREADY_EXISTS))
        }
    }

    suspend fun remove(call: ApplicationCall) {

        if (!AdminAuth.isAuthorized(call)) {
            call.respond(HttpStatusCode.Unauthorized, ErrorResponse(ActivityErrors.UNAUTHORIZED))
            return
        }

        val activityId = call.parameters["activity_id"]

        when (val result = removeActivityUseCase.execute(activityId)) {
            is RemoveActivityResult.Success ->
                call.respond(HttpStatusCode.OK, mapOf("status" to "removed"))

            is RemoveActivityResult.Invalid ->
                call.respond(HttpStatusCode.BadRequest, ErrorResponse(result.message))

            is RemoveActivityResult.NotFound ->
                call.respond(HttpStatusCode.NotFound, ErrorResponse(ActivityErrors.ACTIVITY_NOT_FOUND))
        }
    }
}