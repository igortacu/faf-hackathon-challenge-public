package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.repository.ActivityRepository
import domain.error.ActivityErrors

sealed class RemoveActivityResult {
    object Success : RemoveActivityResult()
    data class Invalid(val message: String) : RemoveActivityResult()
    object NotFound : RemoveActivityResult()
}

class RemoveActivityUseCase(
    private val activityRepository: ActivityRepository
) {

    fun execute(activityId: String?): RemoveActivityResult {

        if (activityId.isNullOrBlank()) {
            return RemoveActivityResult.Invalid(ActivityErrors.MISSING_ACTIVITY_ID)
        }

        val deleted = activityRepository.delete(activityId)

        if (!deleted) {
            return RemoveActivityResult.NotFound
        }

        return RemoveActivityResult.Success
    }
}
