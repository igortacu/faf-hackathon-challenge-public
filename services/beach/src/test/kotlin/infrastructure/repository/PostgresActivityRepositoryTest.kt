package com.hackathon.summer.faf.infrastructure.repository

import com.hackathon.summer.faf.domain.model.Activity
import com.hackathon.summer.faf.domain.repository.ActivityParticipants
import com.hackathon.summer.faf.infrastructure.database.table.ActivityBookingsTable
import com.hackathon.summer.faf.infrastructure.database.table.ActivityTable
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.SchemaUtils
import org.jetbrains.exposed.sql.deleteAll
import org.jetbrains.exposed.sql.transactions.transaction
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals

class PostgresActivityRepositoryTest {

    private val repository = PostgresActivityRepository()

    @BeforeTest
    fun setUp() {
        Database.connect(
            url = "jdbc:h2:mem:beach-activities;DB_CLOSE_DELAY=-1;",
            driver = "org.h2.Driver"
        )

        transaction {
            SchemaUtils.create(ActivityTable, ActivityBookingsTable)
            ActivityBookingsTable.deleteAll()
            ActivityTable.deleteAll()
        }
    }

    @Test
    fun `save persists booked visitors and findParticipants returns them`() {
        repository.save(
            Activity(
                id = "ACT001",
                name = "Beach Volleyball",
                description = "Competitive beach volleyball tournament.",
                capacity = 2,
                bookedVisitors = mutableSetOf("user-1", "user-2")
            )
        )

        val participants = repository.findParticipantsByActivityId("ACT001")

        assertEquals(
            ActivityParticipants(
                activityId = "ACT001",
                capacity = 2,
                participants = listOf("user-1", "user-2")
            ),
            participants
        )
    }

    @Test
    fun `findById includes persisted booked visitors`() {
        repository.save(
            Activity(
                id = "ACT001",
                name = "Beach Volleyball",
                description = "Competitive beach volleyball tournament.",
                capacity = 2,
                bookedVisitors = mutableSetOf("user-1", "user-2")
            )
        )

        assertEquals(
            setOf("user-1", "user-2"),
            repository.findById("ACT001")?.bookedVisitors?.toSet()
        )
    }
}
