package com.hackathon.summer.faf.application.usecase

import com.hackathon.summer.faf.domain.repository.ActivityRepository
import com.hackathon.summer.faf.domain.repository.VisitorRepository
import com.hackathon.summer.faf.infrastructure.broadcast.ActivityBroadcastPublisher
import com.hackathon.summer.faf.infrastructure.broadcast.NoopActivityBroadcastPublisher
import domain.error.ActivityErrors
import domain.error.VisitorErrors


class BookActivityUseCase(
    private val activityRepository: ActivityRepository,
    private val visitorRepository: VisitorRepository,
    private val broadcastPublisher: ActivityBroadcastPublisher = NoopActivityBroadcastPublisher
) {

    // Returns null on success, or an error constant describing why the booking
    // was rejected.
    fun execute(activityId: String, visitorId: String): String? {

        val activity = activityRepository.findById(activityId)
            ?: return ActivityErrors.ACTIVITY_NOT_FOUND

        val visitor = visitorRepository.findById(visitorId)
            ?: return VisitorErrors.VISITOR_NOT_FOUND

        if (!visitor.checkedIn) {
            return VisitorErrors.VISITOR_NOT_CHECKED_IN
        }

        if (visitorId in activity.bookedVisitors) {
            return ActivityErrors.ACTIVITY_ALREADY_BOOKED
        }

        if (activity.isFull()) {
            return ActivityErrors.ACTIVITY_FULL
        }

        activity.bookedVisitors.add(visitorId)
        activityRepository.save(activity)

        if (activity.isFull()) {
            broadcastPublisher.publishActivityFull(activity)
        }

        return null
    }
}
