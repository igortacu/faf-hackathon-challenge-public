package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.presentation.request.CreateActivityRequest
import domain.error.ActivityErrors

sealed class CreateActivityResult {
    data class Success(val activity: Activity) : CreateActivityResult()
    data class Invalid(val message: String) : CreateActivityResult()
    object AlreadyExists : CreateActivityResult()
}

class CreateActivityUseCase(
    private val activityRepository: ActivityRepository
) {

    fun execute(request: CreateActivityRequest): CreateActivityResult {

        if (request.id.isBlank()) {
            return CreateActivityResult.Invalid(ActivityErrors.MISSING_ACTIVITY_ID)
        }

        if (request.name.isBlank()) {
            return CreateActivityResult.Invalid(ActivityErrors.MISSING_ACTIVITY_NAME)
        }

        if (request.capacity <= 0) {
            return CreateActivityResult.Invalid(ActivityErrors.INVALID_CAPACITY)
        }

        val activity = Activity(
            id = request.id,
            name = request.name,
            description = request.description,
            capacity = request.capacity
        )

        val created = activityRepository.create(activity)

        if (!created) {
            return CreateActivityResult.AlreadyExists
        }

        return CreateActivityResult.Success(activity)
    }
}
