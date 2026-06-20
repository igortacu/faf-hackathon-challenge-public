package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.infrastructure.broadcast.ActivityBroadcastPublisher
import com.hackathon.summer.faf.infrastructure.broadcast.NoopActivityBroadcastPublisher


class CancelActivityUseCase(
    private val activityRepository: ActivityRepository,
    private val broadcastPublisher: ActivityBroadcastPublisher = NoopActivityBroadcastPublisher
) {

    fun execute(activityId: String, visitorId: String): String? {

        val activity = activityRepository.findById(activityId)

        val wasFull = activity?.isFull() == true

        activity?.bookedVisitors?.remove(visitorId)

        activityRepository.save(activity!!)

        if (wasFull && !activity.isFull()) {
            broadcastPublisher.publishActivityAvailable(activity)
        }

        return null
    }
}
