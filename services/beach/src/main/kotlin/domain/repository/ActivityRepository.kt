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

    /** Inserts a new activity. Returns false (no-op) if the id already exists. */
    fun create(activity: Activity): Boolean

    /** Deletes the activity by id. Returns false if no activity had that id. */
    fun delete(id: String): Boolean
}
