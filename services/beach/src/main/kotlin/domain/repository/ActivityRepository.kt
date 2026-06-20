package com.hackathon.summer.faf.domain.repository

import com.hackathon.summer.faf.domain.model.Activity

data class ActivityParticipants(
    val activityId: String,
    val capacity: Int,
    val participants: List<String>
)

interface ActivityRepository {

    fun findAll(): List<Activity>

    fun findById(id: String): Activity?

    fun findParticipantsByActivityId(id: String): ActivityParticipants?

    fun isVisitorBooked(visitorId: String): Boolean

    fun save(activity: Activity)
}
