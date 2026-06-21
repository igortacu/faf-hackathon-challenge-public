package com.hackathon.summer.faf.infrastructure.broadcast

import com.hackathon.summer.faf.domain.model.Activity
import kotlinx.serialization.Serializable

interface ActivityBroadcastPublisher {
    fun publishActivityFull(activity: Activity, requestId: String = "-")

    fun publishActivityAvailable(activity: Activity, requestId: String = "-")
}

@Serializable
data class ActivityAvailabilityEvent(
    val type: String,
    val activityId: String,
    val activityName: String,
    val capacity: Int,
    val remaining: Int
)

object NoopActivityBroadcastPublisher : ActivityBroadcastPublisher {
    override fun publishActivityFull(activity: Activity, requestId: String) = Unit

    override fun publishActivityAvailable(activity: Activity, requestId: String) = Unit
}
