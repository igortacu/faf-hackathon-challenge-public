package com.hackathon.summer.faf.presentation.response

import kotlinx.serialization.Serializable

@Serializable
data class ActivityByGuestResponse(
    val activity_id: String?
)
