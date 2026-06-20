package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.domain.repository.VisitorRepository
import com.hackathon.summer.faf.infrastructure.broadcast.ActivityBroadcastPublisher
import com.hackathon.summer.faf.infrastructure.broadcast.NoopActivityBroadcastPublisher


class BookActivityUseCase(
    private val activityRepository: ActivityRepository,
    private val visitorRepository: VisitorRepository,
    private val broadcastPublisher: ActivityBroadcastPublisher = NoopActivityBroadcastPublisher
) {

    fun execute(activityId: String, visitorId: String): String? {

        val activity = activityRepository.findById(activityId)

        val wasFull = activity?.isFull() == true

        activity?.bookedVisitors?.add(visitorId)

        activityRepository.save(activity!!)

        if (!wasFull && activity.isFull()) {
            broadcastPublisher.publishActivityFull(activity)
        }

        return null
    }
}
