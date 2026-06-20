package com.hackathon.summer.faf.presentation.response

import kotlinx.serialization.Serializable

@Serializable
data class ActivityParticipantsResponse(
    val activity_id: String,
    val capacity: Int,
    val participants: List<String>
)
