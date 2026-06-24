package com.hackathon.summer.faf.presentation.request

import kotlinx.serialization.Serializable

@Serializable
data class CreateActivityRequest(
    val id: String,
    val name: String,
    val description: String? = null,
    val capacity: Int
)
