package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.infrastructure.broadcast.ActivityBroadcastPublisher
import com.hackathon.summer.faf.infrastructure.broadcast.NoopActivityBroadcastPublisher
import domain.error.ActivityErrors


class CancelActivityUseCase(
    private val activityRepository: ActivityRepository,
    private val broadcastPublisher: ActivityBroadcastPublisher = NoopActivityBroadcastPublisher
) {

    // Returns null on success, or an error constant describing why the
    // cancellation was rejected.
    fun execute(activityId: String, visitorId: String): String? {

        val activity = activityRepository.findById(activityId)
            ?: return ActivityErrors.ACTIVITY_NOT_FOUND

        if (visitorId !in activity.bookedVisitors) {
            return ActivityErrors.ACTIVITY_NOT_BOOKED
        }

        val wasFull = activity.isFull()

        activity.bookedVisitors.remove(visitorId)
        activityRepository.save(activity)

        if (wasFull && !activity.isFull()) {
            broadcastPublisher.publishActivityAvailable(activity)
        }

        return null
    }
}
